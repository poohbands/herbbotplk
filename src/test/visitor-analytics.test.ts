import { describe, it, expect, beforeEach } from "vitest";
import {
  trackPageView,
  getStoredAnalytics,
  computeAnalyticsSummary,
  clearStoredAnalytics,
  detectDeviceType,
  detectBrowser,
  detectOS,
  getOrCreateVisitorId,
  getOrCreateSessionId,
} from "../lib/analytics-service";

describe("Visitor & Technical Analytics Service (PDPA Compliant)", () => {
  beforeEach(() => {
    clearStoredAnalytics();
  });

  it("generates anonymous visitor ID and session ID without PII", () => {
    const vid = getOrCreateVisitorId();
    const { sessionId } = getOrCreateSessionId();

    expect(vid).toBeDefined();
    expect(vid.startsWith("vid_")).toBe(true);
    expect(sessionId).toBeDefined();
    expect(sessionId.startsWith("sid_")).toBe(true);
  });

  it("tracks pageviews and saves event with device & browser metadata", () => {
    const event = trackPageView("/herbs", "สมุนไพรและตำรับยาไทย");

    expect(event.path).toBe("/herbs");
    expect(event.title).toBe("สมุนไพรและตำรับยาไทย");
    expect(["mobile", "tablet", "desktop"]).toContain(event.deviceType);
    expect(typeof event.browser).toBe("string");
    expect(typeof event.os).toBe("string");
    expect(typeof event.screenResolution).toBe("string");

    const stored = getStoredAnalytics();
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe(event.id);
  });

  it("computes accurate analytics summary across multiple pageviews", () => {
    trackPageView("/", "หน้าแรก - หมอยาพิษณุโลก");
    trackPageView("/herbs", "สมุนไพร");
    trackPageView("/admin", "แอดมิน");

    const summary = computeAnalyticsSummary();

    expect(summary.totalPageviews).toBe(3);
    expect(summary.uniqueVisitors).toBeGreaterThanOrEqual(1);
    expect(summary.totalSessions).toBeGreaterThanOrEqual(1);
    expect(summary.topPages.length).toBe(3);
    expect(summary.deviceBreakdown.length).toBeGreaterThan(0);
    expect(summary.browserBreakdown.length).toBeGreaterThan(0);
    expect(summary.dailyVisitors.length).toBe(7);
  });

  it("supports configurable daily visitor windows (7, 30, 90, 180, 360 days)", () => {
    trackPageView("/", "หน้าแรก - หมอยาพิษณุโลก");

    const summary7 = computeAnalyticsSummary(7);
    expect(summary7.dailyVisitors.length).toBe(7);

    const summary30 = computeAnalyticsSummary(30);
    expect(summary30.dailyVisitors.length).toBe(30);

    const summary90 = computeAnalyticsSummary(90);
    expect(summary90.dailyVisitors.length).toBe(90);

    const summary180 = computeAnalyticsSummary(180);
    expect(summary180.dailyVisitors.length).toBe(180);

    const summary360 = computeAnalyticsSummary(360);
    expect(summary360.dailyVisitors.length).toBe(360);

    expect(summary30.dailyVisitors[0].date).toBeDefined();
    expect(summary30.dailyVisitors[0].fullDate).toBeDefined();
  });

  it("clears stored analytics properly", () => {
    trackPageView("/");
    expect(getStoredAnalytics().length).toBe(1);

    clearStoredAnalytics();
    expect(getStoredAnalytics().length).toBe(0);
  });

  it("correlates daily visitor analytics with 1692 questions, 829 sessions, and monthly trend", async () => {
    const { ensureCorrelatedVisitorData } = await import("../lib/analytics-service");
    localStorage.clear();

    const monthlyData = [
      { month: "พ.ค.", total: 11 },
      { month: "มิ.ย.", total: 51 },
      { month: "ก.ค.", total: 116 },
      { month: "ส.ค.", total: 114 },
      { month: "ก.ย.", total: 584 },
      { month: "ต.ค.", total: 707 },
    ];

    ensureCorrelatedVisitorData(true, {
      totalQuestions: 1692,
      totalSessions: 829,
      monthlyData,
    });

    const summary7 = computeAnalyticsSummary(7);
    expect(summary7.totalSessions).toBe(829);
    // Recent 7 days must show active visitor activity correlated with current traffic
    const last7Pageviews = summary7.dailyVisitors.reduce((sum, d) => sum + d.pageviews, 0);
    expect(last7Pageviews).toBeGreaterThan(0);

    // Monthly trend correlation: October sessions > September sessions > July sessions > May sessions
    const stored = getStoredAnalytics();
    const countUniqueSessionsInMonth = (ym: string) =>
      new Set(stored.filter((e) => e.timestamp.startsWith(ym)).map((e) => e.sessionId)).size;

    const octSessions = countUniqueSessionsInMonth("2026-10");
    const sepSessions = countUniqueSessionsInMonth("2026-09");
    const julSessions = countUniqueSessionsInMonth("2026-07");
    const maySessions = countUniqueSessionsInMonth("2026-05");

    expect(octSessions).toBeGreaterThan(sepSessions);
    expect(sepSessions).toBeGreaterThan(julSessions);
    expect(julSessions).toBeGreaterThan(maySessions);
  });
});
