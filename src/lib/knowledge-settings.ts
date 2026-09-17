/**
 * จัดการการตั้งค่าแหล่งข้อมูลและการแสดงผลอ้างอิงสำหรับ AI (Knowledge Base & Citation Display Settings)
 * ควบคุมการเปิด-ปิดการใช้ฐานข้อมูลภายในเว็บ งานวิจัยภายนอก หนังสือ CPG
 * และควบคุมการเปิด-ปิดการแสดงผล "เมนูแหล่งอ้างอิงที่ตรวจสอบได้" และ "รูปแบบการอ้างอิง (APA 7th Edition) ด้านล่าง"
 */

import { supabase } from "@/integrations/supabase/client";

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

  /**
   * เปิด-ปิดการใช้ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน (ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ ม.มหิดล)
   */
  enable_mahidol_ddi: boolean;

  /**
   * เปิด-ปิดการใช้ฐานข้อมูลข้อควรระวังอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน (ศ. ดร.ภญ.อรุณพร อิฐรัตน์ ม.ธรรมศาสตร์)
   */
  enable_tu_ddi: boolean;

  /**
   * เปิด-ปิดการใช้หนังสือข้อมูลความรู้ด้านยาและแนวทางเวชปฏิบัติ (CPG กรมการแพทย์ 2568, ยาทดแทน 32 รายการ สธ., แผนภูมิปฐมภูมิ ICD-10, บัญชียาหลัก 2568)
   */
  enable_herb_books: boolean;

  /**
   * เปิด-ปิดการแสดงผล "เมนูแหล่งอ้างอิงที่ตรวจสอบได้" ท้ายคำตอบของ AI ในหน้าแชท
   */
  show_verifiable_sources: boolean;

  /**
   * เปิด-ปิดการแสดงผล "รูปแบบการอ้างอิง (APA 7th Edition)" ด้านล่าง และในเนื้อหาคำตอบของ AI
   */
  show_apa_citations: boolean;
};

export const DEFAULT_KNOWLEDGE_SETTINGS: KnowledgeSettings = {
  enable_external_research: true,
  enable_internal_db: true,
  enable_mahidol_ddi: true,
  enable_tu_ddi: true,
  enable_herb_books: true,
  show_verifiable_sources: true,
  show_apa_citations: true,
};

const STORAGE_KEY = "plk_knowledge_source_settings";
export const KNOWLEDGE_SETTINGS_EVENT = "plk_knowledge_settings_changed";
const SUPABASE_SETTINGS_DOC_TITLE = "SYSTEM_KNOWLEDGE_SETTINGS_CONFIG";

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
      enable_mahidol_ddi:
        typeof parsed.enable_mahidol_ddi === "boolean"
          ? parsed.enable_mahidol_ddi
          : DEFAULT_KNOWLEDGE_SETTINGS.enable_mahidol_ddi,
      enable_tu_ddi:
        typeof parsed.enable_tu_ddi === "boolean"
          ? parsed.enable_tu_ddi
          : DEFAULT_KNOWLEDGE_SETTINGS.enable_tu_ddi,
      enable_herb_books:
        typeof parsed.enable_herb_books === "boolean"
          ? parsed.enable_herb_books
          : DEFAULT_KNOWLEDGE_SETTINGS.enable_herb_books,
      show_verifiable_sources:
        typeof parsed.show_verifiable_sources === "boolean"
          ? parsed.show_verifiable_sources
          : DEFAULT_KNOWLEDGE_SETTINGS.show_verifiable_sources,
      show_apa_citations:
        typeof parsed.show_apa_citations === "boolean"
          ? parsed.show_apa_citations
          : DEFAULT_KNOWLEDGE_SETTINGS.show_apa_citations,
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

  syncKnowledgeSettingsToSupabase(next).catch(() => {});

  return next;
}

/** ซิงค์ค่าการตั้งค่าไปยัง Supabase เพื่อให้อุปกรณ์และผู้ใช้ทุกคนรับทราบพร้อมกัน */
async function syncKnowledgeSettingsToSupabase(settings: KnowledgeSettings): Promise<void> {
  try {
    if (!supabase) return;
    const { data: existing } = await supabase
      .from("knowledge_documents")
      .select("id")
      .eq("title", SUPABASE_SETTINGS_DOC_TITLE)
      .maybeSingle();

    const payload = {
      title: SUPABASE_SETTINGS_DOC_TITLE,
      category: "system_setting",
      content: JSON.stringify(settings),
      tags: ["system", "knowledge_settings"],
      is_published: true,
      source: "HerbBot System Admin",
    };

    if (existing?.id) {
      await supabase.from("knowledge_documents").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("knowledge_documents").insert(payload);
    }
  } catch (e) {
    // ละเว้นกรณีออฟไลน์หรือไม่มีสิทธิ์เขียน
  }
}

/** ดึงค่าการตั้งค่าจาก Supabase Cloud เพื่ออัปเดต LocalStorage */
export async function fetchRemoteKnowledgeSettings(): Promise<KnowledgeSettings | null> {
  try {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("content, updated_at")
      .eq("title", SUPABASE_SETTINGS_DOC_TITLE)
      .maybeSingle();

    if (error || !data?.content) return null;
    const parsed = JSON.parse(data.content);
    if (!parsed || typeof parsed !== "object") return null;

    const validated: KnowledgeSettings = {
      enable_external_research:
        typeof parsed.enable_external_research === "boolean"
          ? parsed.enable_external_research
          : DEFAULT_KNOWLEDGE_SETTINGS.enable_external_research,
      enable_internal_db:
        typeof parsed.enable_internal_db === "boolean"
          ? parsed.enable_internal_db
          : DEFAULT_KNOWLEDGE_SETTINGS.enable_internal_db,
      enable_mahidol_ddi:
        typeof parsed.enable_mahidol_ddi === "boolean"
          ? parsed.enable_mahidol_ddi
          : DEFAULT_KNOWLEDGE_SETTINGS.enable_mahidol_ddi,
      enable_tu_ddi:
        typeof parsed.enable_tu_ddi === "boolean"
          ? parsed.enable_tu_ddi
          : DEFAULT_KNOWLEDGE_SETTINGS.enable_tu_ddi,
      enable_herb_books:
        typeof parsed.enable_herb_books === "boolean"
          ? parsed.enable_herb_books
          : DEFAULT_KNOWLEDGE_SETTINGS.enable_herb_books,
      show_verifiable_sources:
        typeof parsed.show_verifiable_sources === "boolean"
          ? parsed.show_verifiable_sources
          : DEFAULT_KNOWLEDGE_SETTINGS.show_verifiable_sources,
      show_apa_citations:
        typeof parsed.show_apa_citations === "boolean"
          ? parsed.show_apa_citations
          : DEFAULT_KNOWLEDGE_SETTINGS.show_apa_citations,
    };

    if (typeof window !== "undefined") {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current !== JSON.stringify(validated)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
        window.dispatchEvent(
          new CustomEvent(KNOWLEDGE_SETTINGS_EVENT, { detail: validated })
        );
      }
    }
    return validated;
  } catch (e) {
    return null;
  }
}
