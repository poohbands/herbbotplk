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

  it("clears stored analytics properly", () => {
    trackPageView("/");
    expect(getStoredAnalytics().length).toBe(1);

    clearStoredAnalytics();
    expect(getStoredAnalytics().length).toBe(0);
  });
});
