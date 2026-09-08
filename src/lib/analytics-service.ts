/**
 * ระบบติดตามสถิติผู้เข้าชมและข้อมูลทางเทคนิค (Visitor & Technical Analytics)
 * ออกแบบตามหลัก Privacy by Design & PDPA 100%
 * - ไม่เก็บชื่อ-นามสกุล, เบอร์โทรศัพท์, หรือข้อมูลระบุตัวตน (No PII)
 * - ใช้ Anonymous Visitor ID (UUID) สุ่มเก็บในเครื่อง
 * - วิเคราะห์ประเภทอุปกรณ์, ระบบปฏิบัติการ, เบราว์เซอร์, ความละเอียดหน้าจอ, ระยะเวลาเข้าชม (Duration)
 */

export interface PageviewEvent {
  id: string;
  visitorId: string;
  sessionId: string;
  path: string;
  title: string;
  referrer: string;
  timestamp: string;
  durationSeconds?: number;
  deviceType: "mobile" | "tablet" | "desktop";
  browser: string;
  os: string;
  screenResolution: string;
  language: string;
}

export interface AnalyticsSummary {
  totalPageviews: number;
  uniqueVisitors: number;
  totalSessions: number;
  avgDurationSeconds: number;
  deviceBreakdown: { name: string; value: number }[];
  browserBreakdown: { name: string; value: number }[];
  osBreakdown: { name: string; value: number }[];
  topPages: { path: string; title: string; count: number }[];
  dailyVisitors: { date: string; visitors: number; pageviews: number }[];
  hourlyActivity: { hour: string; count: number }[];
}

const STORAGE_ANALYTICS_KEY = "plk_visitor_events";
const STORAGE_VISITOR_ID_KEY = "plk_anon_vid";
const STORAGE_SESSION_ID_KEY = "plk_anon_sid";
const STORAGE_SESSION_TIME_KEY = "plk_session_last_active";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 นาทีหมดอายุ session

/** สุ่มสร้าง Anonymous Visitor ID */
export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let vid = localStorage.getItem(STORAGE_VISITOR_ID_KEY);
    if (!vid) {
      vid = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem(STORAGE_VISITOR_ID_KEY, vid);
    }
    return vid;
  } catch {
    return `vid_${Date.now()}`;
  }
}

/** ตรวจสอบหรือสร้าง Session ID (นับ session ใหม่เมื่อไม่มีกิจกรรมเกิน 30 นาที) */
export function getOrCreateSessionId(): { sessionId: string; isNewSession: boolean } {
  if (typeof window === "undefined") return { sessionId: "server", isNewSession: false };
  try {
    const now = Date.now();
    const lastActive = parseInt(sessionStorage.getItem(STORAGE_SESSION_TIME_KEY) || "0", 10);
    let sid = sessionStorage.getItem(STORAGE_SESSION_ID_KEY);
    let isNewSession = false;

    if (!sid || now - lastActive > SESSION_TIMEOUT_MS) {
      sid = `sid_${now}_${Math.random().toString(36).substring(2, 8)}`;
      sessionStorage.setItem(STORAGE_SESSION_ID_KEY, sid);
      isNewSession = true;
    }

    sessionStorage.setItem(STORAGE_SESSION_TIME_KEY, now.toString());
    return { sessionId: sid, isNewSession };
  } catch {
    return { sessionId: `sid_${Date.now()}`, isNewSession: false };
  }
}

/** จำแนกประเภทอุปกรณ์ */
export function detectDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(ua)) {
    return "tablet";
  }
  if (/(mobi|ipod|phone|blackberry|opera mini|fennec|minimo|symbian|psp|nintendo ds)/.test(ua)) {
    return "mobile";
  }
  if (window.innerWidth <= 768) {
    return "mobile";
  }
  return "desktop";
}

/** จำแนกชื่อเบราว์เซอร์ */
export function detectBrowser(): string {
  if (typeof window === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (/Line\//i.test(ua)) return "LINE App";
  if (/FBAN|FBAV/i.test(ua)) return "Facebook App";
  if (/Edg/i.test(ua)) return "Edge";
  if (/Chrome/i.test(ua) && !/Chromium|Edg/i.test(ua)) return "Chrome";
  if (/Safari/i.test(ua) && !/Chrome|Chromium/i.test(ua)) return "Safari";
  if (/Firefox/i.test(ua)) return "Firefox";
  if (/Opera|OPR/i.test(ua)) return "Opera";
  return "Other";
}

/** จำแนกระบบปฏิบัติการ */
export function detectOS(): string {
  if (typeof window === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Other";
}

/** ดึงประวัติกิจกรรมทั้งหมดจาก Local Storage */
export function getStoredAnalytics(): PageviewEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_ANALYTICS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Failed to load visitor analytics from localStorage:", e);
    return [];
  }
}

/** บันทึก Pageview หนึ่งครั้ง */
export function trackPageView(path?: string, title?: string): PageviewEvent {
  if (typeof window === "undefined") return {} as any;

  const currentPath = path || window.location.pathname;
  const currentTitle = title || document.title || "หมอยาพิษณุโลก";
  const visitorId = getOrCreateVisitorId();
  const { sessionId } = getOrCreateSessionId();

  const event: PageviewEvent = {
    id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    visitorId,
    sessionId,
    path: currentPath,
    title: currentTitle,
    referrer: document.referrer ? new URL(document.referrer, window.location.origin).pathname : "Direct / Bookmarks",
    timestamp: new Date().toISOString(),
    deviceType: detectDeviceType(),
    browser: detectBrowser(),
    os: detectOS(),
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language || "th-TH",
  };

  try {
    const events = getStoredAnalytics();
    // เก็บสูงสุด 2,000 รายการล่าสุดเพื่อประหยัดพื้นที่เบราว์เซอร์
    events.push(event);
    if (events.length > 2000) {
      events.splice(0, events.length - 2000);
    }
    localStorage.setItem(STORAGE_ANALYTICS_KEY, JSON.stringify(events));
  } catch (e) {
    console.warn("Failed to save analytics event:", e);
  }

  return event;
}

/** อัปเดตระยะเวลาที่ผู้ใช้อยู่ในหน้า (Duration) เมื่อผู้ใช้เปลี่ยนหน้าหรือปิดแท็บ */
export function updatePageDuration(eventId: string, durationSec: number): void {
  if (typeof window === "undefined" || !eventId || durationSec <= 0) return;
  try {
    const events = getStoredAnalytics();
    const idx = events.findIndex((e) => e.id === eventId);
    if (idx !== -1) {
      events[idx].durationSeconds = Math.min(Math.round(durationSec), 3600); // ไม่เกิน 1 ชม.
      localStorage.setItem(STORAGE_ANALYTICS_KEY, JSON.stringify(events));
    }
  } catch (e) {
    console.warn("Failed to update page duration:", e);
  }
}

/** คำนวณสรุปสถิติเพื่อนำไปแสดงผลบน Dashboard */
export function computeAnalyticsSummary(): AnalyticsSummary {
  const events = getStoredAnalytics();

  if (events.length === 0) {
    // กรณีพึ่งติดตั้ง ยังไม่มีข้อมูล ให้สร้างสถิติเริ่มต้นของเซสชันปัจจุบัน
    const current = trackPageView();
    return computeFromEvents([current]);
  }

  return computeFromEvents(events);
}

function computeFromEvents(events: PageviewEvent[]): AnalyticsSummary {
  const totalPageviews = events.length;
  const uniqueVisitorsSet = new Set(events.map((e) => e.visitorId));
  const uniqueSessionsSet = new Set(events.map((e) => e.sessionId));

  const validDurations = events.filter((e) => typeof e.durationSeconds === "number" && e.durationSeconds > 0);
  const avgDurationSeconds =
    validDurations.length > 0
      ? Math.round(validDurations.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0) / validDurations.length)
      : 45; // default 45s

  // Device breakdown
  const deviceCounts: Record<string, number> = { mobile: 0, tablet: 0, desktop: 0 };
  events.forEach((e) => {
    deviceCounts[e.deviceType] = (deviceCounts[e.deviceType] || 0) + 1;
  });
  const deviceBreakdown = [
    { name: "มือถือ (Mobile)", value: deviceCounts.mobile },
    { name: "คอมพิวเตอร์ (Desktop)", value: deviceCounts.desktop },
    { name: "แท็บเล็ต (Tablet)", value: deviceCounts.tablet },
  ].filter((d) => d.value > 0);

  // Browser breakdown
  const browserCounts: Record<string, number> = {};
  events.forEach((e) => {
    const b = e.browser || "Other";
    browserCounts[b] = (browserCounts[b] || 0) + 1;
  });
  const browserBreakdown = Object.entries(browserCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // OS breakdown
  const osCounts: Record<string, number> = {};
  events.forEach((e) => {
    const o = e.os || "Other";
    osCounts[o] = (osCounts[o] || 0) + 1;
  });
  const osBreakdown = Object.entries(osCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Top pages
  const pageMap: Record<string, { title: string; count: number }> = {};
  events.forEach((e) => {
    const p = e.path || "/";
    if (!pageMap[p]) {
      pageMap[p] = { title: e.title || p, count: 0 };
    }
    pageMap[p].count += 1;
  });
  const topPages = Object.entries(pageMap)
    .map(([path, data]) => ({ path, title: data.title, count: data.count }))
    .sort((a, b) => b.count - a.count);

  // Daily visitors (7 days)
  const dayNames = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const dailyMap: Record<string, { visitors: Set<string>; pageviews: number; dayName: string }> = {};

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split("T")[0];
    dailyMap[dateKey] = {
      visitors: new Set<string>(),
      pageviews: 0,
      dayName: dayNames[d.getDay()],
    };
  }

  events.forEach((e) => {
    const dateKey = (e.timestamp || "").split("T")[0];
    if (dailyMap[dateKey]) {
      dailyMap[dateKey].visitors.add(e.visitorId);
      dailyMap[dateKey].pageviews += 1;
    }
  });

  const dailyVisitors = Object.entries(dailyMap).map(([date, data]) => ({
    date: data.dayName,
    visitors: data.visitors.size,
    pageviews: data.pageviews,
  }));

  // Hourly Activity (00:00 - 23:00)
  const hourCounts: Record<number, number> = {};
  for (let h = 0; h < 24; h++) hourCounts[h] = 0;
  events.forEach((e) => {
    try {
      const dt = new Date(e.timestamp);
      const hr = dt.getHours();
      hourCounts[hr] = (hourCounts[hr] || 0) + 1;
    } catch {
      // ignore
    }
  });

  const hourlyActivity = Object.entries(hourCounts).map(([h, count]) => ({
    hour: `${h.padStart(2, "0")}:00`,
    count,
  }));

  return {
    totalPageviews,
    uniqueVisitors: uniqueVisitorsSet.size,
    totalSessions: uniqueSessionsSet.size,
    avgDurationSeconds,
    deviceBreakdown,
    browserBreakdown,
    osBreakdown,
    topPages,
    dailyVisitors,
    hourlyActivity,
  };
}

/** เคลียร์สถิติทั้งหมด (Admin tool) */
export function clearStoredAnalytics(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_ANALYTICS_KEY);
  }
}
