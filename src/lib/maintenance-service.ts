import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MaintenanceState = {
  is_maintenance: boolean;
  message: string;
  updated_at?: string;
};

export const DEFAULT_MAINTENANCE_STATE: MaintenanceState = {
  is_maintenance: false,
  message: "ขณะนี้ระบบ HerbBot PLK (หมอยาพิษณุโลก) อยู่ระหว่างการปรับปรุงและอัปเดตข้อมูลระบบ เพื่อเพิ่มประสิทธิภาพในการให้บริการ ขออภัยในความไม่สะดวก โปรดกลับมาใหม่อีกครั้งในภายหลังครับ",
};

const STORAGE_KEY = "plk_maintenance_mode";
export const MAINTENANCE_EVENT = "plk_maintenance_changed";
const SUPABASE_DOC_TITLE = "SYSTEM_MAINTENANCE_CONFIG";

/** ตรวจสอบว่าผู้ใช้ปัจจุบันได้เข้าสู่ระบบ Admin แล้วหรือไม่ */
export function isAdminAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem("admin_auth") === "true";
  } catch {
    return false;
  }
}

/** ตั้งค่าสถานะการเข้าสู่ระบบของ Admin */
export function setAdminAuthenticated(auth: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (auth) {
      sessionStorage.setItem("admin_auth", "true");
    } else {
      sessionStorage.removeItem("admin_auth");
    }
    window.dispatchEvent(new CustomEvent(MAINTENANCE_EVENT));
  } catch (e) {
    console.warn("Failed to set admin_auth in sessionStorage:", e);
  }
}

/** อ่านค่า Maintenance State จาก LocalStorage (พร้อม fallback) */
export function getLocalMaintenanceState(): MaintenanceState {
  if (typeof window === "undefined") {
    return { ...DEFAULT_MAINTENANCE_STATE };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MAINTENANCE_STATE };
    const parsed = JSON.parse(raw);
    return {
      is_maintenance: Boolean(parsed.is_maintenance),
      message: typeof parsed.message === "string" && parsed.message.trim() ? parsed.message.trim() : DEFAULT_MAINTENANCE_STATE.message,
      updated_at: parsed.updated_at || undefined,
    };
  } catch (e) {
    console.warn("Failed to parse maintenance state from localStorage:", e);
    return { ...DEFAULT_MAINTENANCE_STATE };
  }
}

/** บันทึกค่า Maintenance State ลง LocalStorage และส่ง Event แจ้งทุก Component */
export function saveLocalMaintenanceState(updates: Partial<MaintenanceState>): MaintenanceState {
  const current = getLocalMaintenanceState();
  const next: MaintenanceState = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("Failed to save maintenance state to localStorage:", e);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MAINTENANCE_EVENT, { detail: next }));
  }

  // พยายามซิงค์ไปยัง Supabase knowledge_documents แบบ background
  syncMaintenanceToSupabase(next).catch((err) => {
    console.warn("Supabase maintenance sync skipped:", err);
  });

  return next;
}

/** ซิงค์ค่า Maintenance ไปยัง Supabase เพื่อให้อุปกรณ์/ผู้ใช้ทุกคนรับทราบพร้อมกัน */
async function syncMaintenanceToSupabase(state: MaintenanceState): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("knowledge_documents")
      .select("id")
      .eq("title", SUPABASE_DOC_TITLE)
      .maybeSingle();

    const payload = {
      title: SUPABASE_DOC_TITLE,
      category: "system_setting",
      content: JSON.stringify(state),
      tags: ["system", "maintenance"],
      is_published: true,
      source: "HerbBot System Admin",
    };

    if (existing?.id) {
      await supabase.from("knowledge_documents").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("knowledge_documents").insert(payload);
    }
  } catch (e) {
    // Ignore if offline / table not available
  }
}

/** ดึงค่า Maintenance จาก Supabase เพื่ออัปเดต LocalStorage */
export async function fetchRemoteMaintenanceState(): Promise<MaintenanceState | null> {
  try {
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("content, updated_at")
      .eq("title", SUPABASE_DOC_TITLE)
      .maybeSingle();

    if (error || !data?.content) return null;

    const parsed = JSON.parse(data.content);
    const remoteState: MaintenanceState = {
      is_maintenance: Boolean(parsed.is_maintenance),
      message: parsed.message || DEFAULT_MAINTENANCE_STATE.message,
      updated_at: data.updated_at || parsed.updated_at,
    };

    // อัปเดตลง LocalStorage เพื่อให้ครั้งถัดไปแสดงผลได้ทันที
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteState));
      window.dispatchEvent(new CustomEvent(MAINTENANCE_EVENT, { detail: remoteState }));
    } catch {}

    return remoteState;
  } catch {
    return null;
  }
}

/** React Hook สำหรับติดตามสถานะ Maintenance Mode และสิทธิ์ Admin */
export function useMaintenanceMode() {
  const [state, setState] = useState<MaintenanceState>(() => getLocalMaintenanceState());
  const [isAdmin, setIsAdmin] = useState<boolean>(() => isAdminAuthenticated());

  useEffect(() => {
    // 1. ดึงข้อมูลจาก Cloud Supabase เมื่อ Component Mount
    fetchRemoteMaintenanceState().then((remote) => {
      if (remote) {
        setState(remote);
      }
    });

    // 2. ฟัง Event การเปลี่ยนแปลงจากแท็บอื่นๆ หรือ Component อื่น
    const handleUpdate = () => {
      setState(getLocalMaintenanceState());
      setIsAdmin(isAdminAuthenticated());
    };

    window.addEventListener(MAINTENANCE_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener(MAINTENANCE_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const setMaintenance = useCallback((is_maintenance: boolean, message?: string) => {
    const next = saveLocalMaintenanceState({
      is_maintenance,
      ...(message !== undefined ? { message } : {}),
    });
    setState(next);
  }, []);

  const toggleMaintenance = useCallback(() => {
    const next = saveLocalMaintenanceState({
      is_maintenance: !state.is_maintenance,
    });
    setState(next);
  }, [state.is_maintenance]);

  return {
    isMaintenance: state.is_maintenance,
    message: state.message,
    updatedAt: state.updated_at,
    isAdmin,
    setIsAdmin: (auth: boolean) => {
      setAdminAuthenticated(auth);
      setIsAdmin(auth);
    },
    setMaintenance,
    toggleMaintenance,
  };
}
