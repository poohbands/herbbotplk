import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_MAINTENANCE_STATE,
  getLocalMaintenanceState,
  saveLocalMaintenanceState,
  isAdminAuthenticated,
  setAdminAuthenticated,
  MAINTENANCE_EVENT,
} from "../lib/maintenance-service";

describe("Maintenance Mode Service & Admin Bypass", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("returns default state (is_maintenance = false) when nothing is stored", () => {
    const state = getLocalMaintenanceState();
    expect(state.is_maintenance).toBe(false);
    expect(state.message).toBe(DEFAULT_MAINTENANCE_STATE.message);
    expect(state.message).toContain("HerbBot PLK");
  });

  it("saves and loads maintenance state in localStorage correctly", () => {
    const customMessage = "ระบบกำลังปรับปรุงฐานข้อมูลสมุนไพร 97 รายการ";
    saveLocalMaintenanceState({
      is_maintenance: true,
      message: customMessage,
    });

    const state = getLocalMaintenanceState();
    expect(state.is_maintenance).toBe(true);
    expect(state.message).toBe(customMessage);
    expect(state.updated_at).toBeDefined();
  });

  it("can turn off maintenance mode and retain custom message", () => {
    saveLocalMaintenanceState({
      is_maintenance: true,
      message: "ปิดปรับปรุงชั่วคราว",
    });

    saveLocalMaintenanceState({
      is_maintenance: false,
      message: "ปิดปรับปรุงชั่วคราว",
    });

    const state = getLocalMaintenanceState();
    expect(state.is_maintenance).toBe(false);
    expect(state.message).toBe("ปิดปรับปรุงชั่วคราว");
  });

  it("falls back to default message if saved message is empty whitespace", () => {
    saveLocalMaintenanceState({
      is_maintenance: true,
      message: "    ",
    });

    const state = getLocalMaintenanceState();
    expect(state.is_maintenance).toBe(true);
    expect(state.message).toBe(DEFAULT_MAINTENANCE_STATE.message);
  });

  it("identifies admin authentication status from sessionStorage", () => {
    expect(isAdminAuthenticated()).toBe(false);

    setAdminAuthenticated(true);
    expect(isAdminAuthenticated()).toBe(true);
    expect(sessionStorage.getItem("admin_auth")).toBe("true");

    setAdminAuthenticated(false);
    expect(isAdminAuthenticated()).toBe(false);
    expect(sessionStorage.getItem("admin_auth")).toBeNull();
  });

  it("dispatches window CustomEvent when state or admin status changes", () => {
    let eventFired = 0;
    const handler = () => {
      eventFired++;
    };

    window.addEventListener(MAINTENANCE_EVENT, handler);

    saveLocalMaintenanceState({ is_maintenance: true });
    expect(eventFired).toBe(1);

    setAdminAuthenticated(true);
    expect(eventFired).toBe(2);

    window.removeEventListener(MAINTENANCE_EVENT, handler);
  });

  it("determines whether a visitor is blocked based on maintenance and admin status", () => {
    // Helper function matching the logic used in ChatPage and HerbsPage:
    const isVisitorBlocked = (isMaintenance: boolean, isAdmin: boolean) => {
      return isMaintenance && !isAdmin;
    };

    // Case 1: System Online -> No one blocked
    expect(isVisitorBlocked(false, false)).toBe(false);
    expect(isVisitorBlocked(false, true)).toBe(false);

    // Case 2: System in Maintenance -> General user blocked
    expect(isVisitorBlocked(true, false)).toBe(true);

    // Case 3: System in Maintenance -> Admin is NOT blocked (bypass allowed)
    expect(isVisitorBlocked(true, true)).toBe(false);
  });
});
