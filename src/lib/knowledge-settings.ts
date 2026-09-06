/**
 * จัดการการตั้งค่าแหล่งข้อมูลสำหรับ AI (Knowledge Base & External Sources Settings)
 * ควบคุมการเปิด-ปิดการใช้ฐานข้อมูลภายในเว็บ และการดึงงานวิจัยภายนอกพร้อมระบบอ้างอิง APA 7
 */

export type KnowledgeSettings = {
  /**
   * เปิด-ปิดการดึงข้อมูลงานวิจัยภายนอก (PubMed & ThaiJO)
   * พร้อมสร้างเอกสารอ้างอิงตามมาตรฐาน APA 7th Edition และระบบตรวจสอบความถูกต้อง
   */
  enable_external_research: boolean;

  /**
   * เปิด-ปิดการใช้ข้อมูลจากฐานข้อมูลภายในเว็บ (สมุนไพรเดี่ยว, ตำรับยาไทย, เอกสารความรู้ สสจ.พิษณุโลก)
   */
  enable_internal_db: boolean;
};

export const DEFAULT_KNOWLEDGE_SETTINGS: KnowledgeSettings = {
  enable_external_research: true,
  enable_internal_db: true,
};

const STORAGE_KEY = "plk_knowledge_source_settings";
export const KNOWLEDGE_SETTINGS_EVENT = "plk_knowledge_settings_changed";

/** ดึงการตั้งค่าแหล่งข้อมูลปัจจุบัน */
export function getKnowledgeSettings(): KnowledgeSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_KNOWLEDGE_SETTINGS };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_KNOWLEDGE_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      enable_external_research:
        typeof parsed.enable_external_research === "boolean"
          ? parsed.enable_external_research
          : DEFAULT_KNOWLEDGE_SETTINGS.enable_external_research,
      enable_internal_db:
        typeof parsed.enable_internal_db === "boolean"
          ? parsed.enable_internal_db
          : DEFAULT_KNOWLEDGE_SETTINGS.enable_internal_db,
    };
  } catch (e) {
    console.warn("Failed to read knowledge settings from localStorage:", e);
    return { ...DEFAULT_KNOWLEDGE_SETTINGS };
  }
}

/** บันทึกการตั้งค่าแหล่งข้อมูล */
export function saveKnowledgeSettings(
  updates: Partial<KnowledgeSettings>
): KnowledgeSettings {
  const current = getKnowledgeSettings();
  const next: KnowledgeSettings = {
    ...current,
    ...updates,
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(
        new CustomEvent(KNOWLEDGE_SETTINGS_EVENT, { detail: next })
      );
    } catch (e) {
      console.error("Failed to save knowledge settings to localStorage:", e);
    }
  }

  return next;
}
