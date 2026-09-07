import dataset from "@/data/herbs97-dataset.json";

export interface Herb97Item {
  id: string;
  index: number;
  name: string;
  dosage_form: string;
  category: string;
  ingredients: string;
  indication: string;
  dosage_usage: string;
  precautions_contraindications: string;
  side_effects: string;
  drug_interaction: string;
  evidence_level: string;
  references: string;
}

export const HERBS_97_DATA: Herb97Item[] = dataset as Herb97Item[];

/**
 * ตัดคำนำหน้า "ยา", "ยาน้ำมัน", "ยาสเปรย์", "ยาทา" และช่องว่างเพื่อเทียบชื่อยาพื้นฐาน
 */
export function normalizeDrugName(name: string): string {
  return name
    .trim()
    .replace(/^ยา(น้ำมัน|สเปรย์|ทา|ขี้ผึ้ง|สารสกัด(จาก)?)?/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * ค้นหาข้อมูลยาจากไฟล์ 97 herb.xlsx (sheet ทั้งหมด 97 รายการ)
 * โดยเน้นการค้นหาชื่อยาใน Column A (name) ทั้งแบบตรงทุกตัวอักษรและชื่อใกล้เคียง
 */
export function searchHerbs97ByName(query: string, maxResults = 5): Herb97Item[] {
  if (!query || typeof query !== "string") return [];

  const rawQ = query.trim().toLowerCase();
  const cleanQ = rawQ.replace(/[\s\-_,()]+/g, "");
  const normalizedQ = normalizeDrugName(rawQ);

  const exactMatches: Herb97Item[] = [];
  const strongMatches: Herb97Item[] = [];
  const closeMatches: Herb97Item[] = [];

  for (const item of HERBS_97_DATA) {
    const rawName = item.name.toLowerCase();
    const cleanName = rawName.replace(/[\s\-_,()]+/g, "");
    const baseName = normalizeDrugName(rawName);

    // 1. ตรงทุกตัวอักษร หรือคำถามมีชื่อยาเต็มตรงเป๊ะ
    if (rawQ === rawName || rawQ.includes(rawName) || cleanQ.includes(cleanName)) {
      exactMatches.push(item);
      continue;
    }

    // 2. ตรงกับชื่อยาหลังตัดคำนำหน้า "ยา..." (เช่น ผู้ใช้ถาม "เทพจิตร", "ศุขไสยาศน์", "ขมิ้นชัน", "เบญจกูล")
    if (baseName.length >= 3 && (rawQ.includes(baseName) || cleanQ.includes(baseName))) {
      strongMatches.push(item);
      continue;
    }

    // 3. คำถามมีส่วนหนึ่งของชื่อยาตรงกับชื่อใน Column A (Substring/Close match)
    if (cleanName.length >= 4 && cleanQ.length >= 4) {
      if (cleanName.includes(cleanQ) || cleanQ.includes(cleanName)) {
        closeMatches.push(item);
        continue;
      }
    }

    // 4. เปรียบเทียบความใกล้เคียงด้วยการซ้อนทับของกลุ่มคำ (Prefix / Stem)
    if (baseName.length >= 4) {
      const prefix = baseName.slice(0, Math.min(baseName.length, 5));
      if (prefix.length >= 4 && (cleanQ.includes(prefix) || normalizedQ.includes(prefix))) {
        closeMatches.push(item);
      }
    }
  }

  // รวมผลลัพธ์โดยให้ความสำคัญกับ Exact Match -> Strong Match -> Close Match
  const result: Herb97Item[] = [];
  const seenIds = new Set<string>();

  for (const item of [...exactMatches, ...strongMatches, ...closeMatches]) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      result.push(item);
      if (result.length >= maxResults) break;
    }
  }

  return result;
}

/**
 * จัดรูปแบบข้อมูลจาก 97 herb.xlsx ให้พร้อมใส่ใน Context สำหรับ AI
 */
export function formatHerb97ForAiContext(items: Herb97Item[]): string {
  if (!items || items.length === 0) return "";

  let out = "\n[ข้อมูลเฉพาะจากบัญชียาสมุนไพร 97 รายการ (ไฟล์ 97 herb.xlsx)]:\n";
  for (const item of items) {
    out += `\n--- ข้อมูลยา: ${item.name} (ลำดับที่ ${item.index} ในไฟล์ 97 herb.xlsx) ---\n`;
    if (item.dosage_form) out += `• รูปแบบยา: ${item.dosage_form}\n`;
    if (item.category) out += `• บัญชีย่อย: ${item.category}\n`;
    if (item.indication) out += `• สรรพคุณ/ข้อบ่งใช้: ${item.indication}\n`;
    if (item.ingredients) out += `• สูตรตำรับ/ส่วนประกอบ: ${item.ingredients}\n`;
    if (item.dosage_usage) out += `• ขนาดและวิธีใช้: ${item.dosage_usage}\n`;
    if (item.precautions_contraindications) out += `• ข้อห้ามใช้/ข้อควรระวัง: ${item.precautions_contraindications}\n`;
    if (item.side_effects && item.side_effects !== "ไม่ระบุในเอกสาร") out += `• อาการไม่พึงประสงค์: ${item.side_effects}\n`;
    if (item.drug_interaction) out += `• ปฏิกิริยาระหว่างยา (Drug Interaction): ${item.drug_interaction}\n`;
    if (item.evidence_level) out += `• ฐานหลักฐาน DDI: ${item.evidence_level}\n`;
    if (item.references) out += `• แหล่งอ้างอิง DDI: ${item.references}\n`;
  }

  return out;
}
