import dataset from "@/data/herb-books-dataset.json";

export interface HerbBookItem {
  id: string;
  tier: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  sourceFile: string;
  bookCategory:
    | "cpg_medical_services_2568"
    | "substitution_modern_drugs_2567"
    | "primary_care_flowchart_icd10"
    | "nlem_updates_2568"
    | "common_diseases_10"
    | "cd10_symptoms_poster"
    | "substitution_19_poster";
  bookCategoryTitle: string;
  bookTitle: string;
  chapter: string;
  title: string;
  summary: string;
  content: string;
  herbs: string[];
  modernDrugs?: string[];
  icdCodes?: string[];
  evidenceLevel?: string;
  apaCitation: string;
  sourceUrl?: string;
}

export const HERB_BOOKS_DATA: HerbBookItem[] = dataset as HerbBookItem[];

export interface HerbBookCategoryMeta {
  id: HerbBookItem["bookCategory"];
  tier: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  sourceFile: string;
  title: string;
  shortTitle: string;
  count: number;
  description: string;
  apa: string;
}

export const HERB_BOOK_CATEGORIES: HerbBookCategoryMeta[] = [
  {
    id: "cpg_medical_services_2568",
    tier: 1,
    sourceFile: "25680421113642AM_คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ.pdf",
    title: "1. 25680421113642AM_คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ.pdf (CPG กรมการแพทย์ 2568)",
    shortTitle: "1. คู่มือเวชปฏิบัติ CPG 2568",
    count: HERB_BOOKS_DATA.filter((i) => i.tier === 1).length,
    description: "13 บทแนวทางเวชปฏิบัติทางคลินิก และข้อมูลยาสมุนไพร 17 รายการเชิงลึก พร้อมระดับหลักฐาน ก1, ก2 และอันตรกิริยา DDI ทั้งหมด",
    apa: "กรมการแพทย์. (2568). คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ. กระทรวงสาธารณสุข.",
  },
  {
    id: "substitution_modern_drugs_2567",
    tier: 2,
    sourceFile: "สมุนไพรในบัญชียาหลักที่ใช้ทดแทนยาแผนปัจ 11-12-67.pdf",
    title: "2. สมุนไพรในบัญชียาหลักที่ใช้ทดแทนยาแผนปัจ 11-12-67.pdf (สธ. ธ.ค. 2567)",
    shortTitle: "2. ยาสมุนไพรทดแทนยาแผนปัจจุบัน",
    count: HERB_BOOKS_DATA.filter((i) => i.tier === 2).length,
    description: "32 รายการยาสมุนไพรทดแทนยาแผนปัจจุบันใน 10 กลุ่มโรคสำคัญ (เช่น ขมิ้นชัน แทน Omeprazole, เถาวัลย์เปรียง แทน NSAIDs)",
    apa: "กรมการแพทย์แผนไทยและการแพทย์ทางเลือก. (2567). แนวทางการใช้ยาสมุนไพรในบัญชียาหลักแห่งชาติทดแทนยาแผนปัจจุบันใน 10 กลุ่มโรคสำคัญ. กระทรวงสาธารณสุข.",
  },
  {
    id: "primary_care_flowchart_icd10",
    tier: 3,
    sourceFile: "แนวทางการรักษาอาการเจ็บป่วยด้วยยาสมุนไพร.pdf",
    title: "3. แนวทางการรักษาอาการเจ็บป่วยด้วยยาสมุนไพร.pdf (ปฐมภูมิ & ICD-10)",
    shortTitle: "3. แผนภูมิปฐมภูมิ & ICD-10",
    count: HERB_BOOKS_DATA.filter((i) => i.tier === 3).length,
    description: "แนวทางการรักษาอาการเจ็บป่วย 11 กลุ่มอาการ แผนภูมิการตัดสินใจ เกณฑ์ส่งต่อแพทย์แผนปัจจุบัน และรหัสโรค ICD-10 / ICD-10-TM",
    apa: "กรมการแพทย์แผนไทยและการแพทย์ทางเลือก. (2567). แนวทางการรักษาอาการเจ็บป่วยด้วยยาสมุนไพรในระบบบริการปฐมภูมิ. กระทรวงสาธารณสุข.",
  },
  {
    id: "nlem_updates_2568",
    tier: 4,
    sourceFile: "2568_2.pdf และ 2568_2_summary.pdf",
    title: "4. 2568_2.pdf และ 2568_2_summary.pdf (บัญชียาหลัก 2568 ฉบับที่ 2)",
    shortTitle: "4. บัญชียาหลัก 2568 ฉบับที่ 2",
    count: HERB_BOOKS_DATA.filter((i) => i.tier === 4).length,
    description: "สรุป 29 รายการยาปรับปรุงใหม่ปี 2568 (7 รายการใหม่, 5 ขยายข้อบ่งใช้, 17 ปรับปรุงข้อกำหนด) ตามประกาศราชกิจจานุเบกษา",
    apa: "คณะกรรมการพัฒนาระบบยาแห่งชาติ. (2568). ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (ฉบับที่ 2) พ.ศ. 2568. ราชกิจจานุเบกษา.",
  },
  {
    id: "common_diseases_10",
    tier: 5,
    sourceFile: "CD 10 กลุ่มโรค",
    title: "5. CD 10 กลุ่มโรค (Common Diseases Cards 10 กลุ่มโรคพบบ่อย)",
    shortTitle: "5. CD 10 กลุ่มโรค",
    count: HERB_BOOKS_DATA.filter((i) => i.tier === 5).length,
    description: "ชุดข้อมูลความรู้สำหรับประชาชนและหน่วยบริการปฐมภูมิใน 10 กลุ่มโรคและอาการพบบ่อย (ไฟล์ CD 10 กลุ่มโรค)",
    apa: "กรมการแพทย์แผนไทยและการแพทย์ทางเลือก. (2567). ชุดข้อมูลความรู้การใช้ยาสมุนไพรใน 10 กลุ่มโรคและกลุ่มอาการพบบ่อย. กระทรวงสาธารณสุข.",
  },
  {
    id: "cd10_symptoms_poster",
    tier: 6,
    sourceFile: "CD 10 กลุ่มอาการ A5.png",
    title: "6. CD 10 กลุ่มอาการ A5.png (กลุ่มอาการของโรคที่พบบ่อย สสจ.บุรีรัมย์)",
    shortTitle: "6. CD 10 กลุ่มอาการ A5",
    count: HERB_BOOKS_DATA.filter((i) => i.tier === 6).length,
    description: "แผ่นภาพความรู้สรุปการใช้ยาสมุนไพรในบัญชียาหลักแห่งชาติสำหรับ 10 กลุ่มอาการของโรคที่พบบ่อย",
    apa: "กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก สำนักงานสาธารณสุขจังหวัดบุรีรัมย์. (2567). กลุ่มอาการของโรคที่พบบ่อยกับการใช้ยาสมุนไพรในบัญชียาหลักแห่งชาติ [แผ่นภาพความรู้ A5]. กระทรวงสาธารณสุข.",
  },
  {
    id: "substitution_19_poster",
    tier: 7,
    sourceFile: "ยาทดแทน 19 รายการ A5.png",
    title: "7. ยาทดแทน 19 รายการ A5.png (ยาสมุนไพรทดแทนยาแผนปัจจุบัน 19 รายการ สสจ.บุรีรัมย์)",
    shortTitle: "7. ยาทดแทน 19 รายการ A5",
    count: HERB_BOOKS_DATA.filter((i) => i.tier === 7).length,
    description: "แผ่นภาพความรู้สรุปรายละเอียดวิธีใช้ ขนาดยา ข้อห้าม และยาแผนปัจจุบันที่ถูกทดแทน 19 รายการ",
    apa: "กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก สำนักงานสาธารณสุขจังหวัดบุรีรัมย์. (2567). ยาสมุนไพรในกลุ่มอาการที่พบบ่อย ยาทดแทน 19 รายการ [แผ่นภาพความรู้ A5]. กระทรวงสาธารณสุข.",
  },
];

function normalizeQuery(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[่้๊๋็์]/g, "")
    .replace(/\s+/g, "");
}

/** ตรวจสอบว่าคำถามเป็นคำถามเกี่ยวกับอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบันหรือไม่ */
export function isHerbDrugInteractionQuery(query: string): boolean {
  const qLower = (query || "").toLowerCase();
  return /(?:อันตรกิริยา|ตีกัน|ยาตี|กินร่วม|ร่วมกับ|กินคู่|ทานคู่|พร้อมยา|กับยา|ห้ามกินกับ|ห้ามใช้ร่วม|ใช้ร่วมกับ|มีผลต่อยา|ปฏิกิริยาต่อกัน|drug[- ]?herb|herb[- ]?drug|interaction|ddi|hdi)/i.test(
    qLower
  );
}

export interface TieredSearchResult {
  items: HerbBookItem[];
  matchedTier: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
  sourceFile: string | null;
  apaCitation: string | null;
}

const STOP_WORDS = new Set([
  "พ.ศ.", "พ.ศ", "2568", "2567", "2566", "สมุนไพร", "การใช้", "สำหรับ", "หรือ", "และ",
  "ใน", "ของ", "ที่", "มี", "เป็น", "ได้", "ให้", "เพื่อ", "กับ", "จาก", "อย่าง", "อย่างไร",
  "บ้าง", "อะไร", "ไหม", "หรือไม่", "ครับ", "ค่ะ", "คุณ", "ด้าน", "เรื่อง", "ตาม", "ฉบับ"
]);

/**
 * คำนวณคะแนนความเกี่ยวข้องของเอกสารกับคำถาม
 */
export function scoreHerbBookItem(
  item: HerbBookItem,
  qLower: string,
  qNorm: string,
  isDdiIntent: boolean
): number {
  // ตรวจสอบ Intent พิเศษที่เฉพาะเจาะจงกับแต่ละ Tier
  const isSubstitutionIntent =
    /(?:ทดแทน|แทน(?:ยา)?|ใช้แทน|เปลี่ยนจากยา|กินแทน|กินแทนยา|มียาอะไรแทน|แทน\s*[a-zA-Z]+)/i.test(
      qLower
    );
  const isNlemEdition2 = /(?:ฉบับที่\s*2|2568_2|ปรับปรุงใหม่\s*29)/i.test(qLower);
  const isPosterA5Symptoms = /(?:cd\s*10.*a5|10\s*กลุ่มอาการ.*a5|แผ่นภาพ.*10\s*กลุ่มอาการ|โปสเตอร์.*10\s*กลุ่มอาการ)/i.test(qLower);
  const isPosterA5Substitution = /(?:ยาทดแทน.*19|19\s*รายการ.*a5|แผ่นภาพ.*19|โปสเตอร์.*19)/i.test(qLower);
  const isCd10Cards = /(?:cd\s*10\s*กลุ่มโรค|common\s*diseases|การ์ด\s*10\s*กลุ่มโรค|บัตรความรู้)/i.test(qLower);
  const isPrimaryCareIcd = /(?:icd[- ]?10|icd[- ]?10[- ]?tm|รหัสโรค|ปฐมภูมิ|แผนภูมิการตัดสินใจ|เกณฑ์ส่งต่อ)/i.test(qLower);

  // กฎ Exclusivity ตามความประสงค์ที่เฉพาะเจาะจง
  if (isDdiIntent && item.tier !== 1) return 0;
  if (isNlemEdition2 && item.tier !== 4) return 0;
  if (isPosterA5Symptoms && item.tier !== 6) return 0;
  if (isPosterA5Substitution && item.tier !== 7) return 0;
  if (isCd10Cards && item.tier !== 5) return 0;
  if (isPrimaryCareIcd && item.tier !== 3) return 0;
  if (isSubstitutionIntent && !isDdiIntent && item.tier === 1) return 0;

  let score = 0;

  // 1. ตรวจสอบชื่อยาแผนปัจจุบัน (Modern Drugs)
  if (item.modernDrugs && item.modernDrugs.length > 0) {
    for (const drug of item.modernDrugs) {
      const drugLow = drug.toLowerCase();
      if (qLower.includes(drugLow)) {
        if (isSubstitutionIntent && !isDdiIntent && item.tier === 1) {
          continue;
        }
        score += 50;
      }
    }
  }

  // 2. ตรวจสอบชื่อสมุนไพร (Herbs)
  if (item.herbs && item.herbs.length > 0) {
    for (const herb of item.herbs) {
      const herbLow = herb.toLowerCase();
      const herbNorm = normalizeQuery(herb);
      if (qLower.includes(herbLow) || (herbNorm.length >= 3 && qNorm.includes(herbNorm))) {
        score += 35;
      }
    }
  }

  // 3. ตรวจสอบรหัสโรค (ICD Codes)
  if (item.icdCodes && item.icdCodes.length > 0) {
    for (const icd of item.icdCodes) {
      if (qLower.includes(icd.toLowerCase())) {
        score += 40;
      }
    }
  }

  // 4. ตรวจสอบหัวข้อและเนื้อหา (กรอง Stop Words ออกเพื่อไม่ให้จับคู่ พ.ศ., 2568 หรือคำทั่วไปแบบหลอกตา)
  const titleLow = item.title.toLowerCase();
  const chapterLow = item.chapter.toLowerCase();
  const summaryLow = item.summary.toLowerCase();

  const queryWords = qLower.split(/\s+/).filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  for (const w of queryWords) {
    if (titleLow.includes(w)) score += 15;
    if (chapterLow.includes(w)) score += 12;
    if (summaryLow.includes(w)) score += 10;
  }

  // 5. โบนัสเจตนา
  if (isDdiIntent && item.tier === 1) {
    score += 80;
  }
  if (isSubstitutionIntent && (item.tier === 2 || item.tier === 7)) {
    score += 50;
  }
  if (isPrimaryCareIcd && item.tier === 3) {
    score += 50;
  }
  if (isNlemEdition2 && item.tier === 4) {
    score += 60;
  }
  if (isCd10Cards && item.tier === 5) {
    score += 50;
  }
  if (isPosterA5Symptoms && item.tier === 6) {
    score += 60;
  }
  if (isPosterA5Substitution && item.tier === 7) {
    score += 60;
  }

  return score;
}

/**
 * ค้นหาข้อมูลจากหนังสือความรู้ตามลำดับความสำคัญ 1 ถึง 7 อย่างเคร่งครัด
 * หากพบข้อมูลที่เกี่ยวข้องในลำดับใดแล้ว ให้หยุดการค้นหาทันที (Short-Circuit)
 */
export function searchHerbBooksTiered(
  query: string,
  maxResults = 3
): TieredSearchResult {
  const qLower = (query || "").trim().toLowerCase();
  if (!qLower) {
    return { items: [], matchedTier: null, sourceFile: null, apaCitation: null };
  }

  const qNorm = normalizeQuery(qLower);
  const isDdiIntent = isHerbDrugInteractionQuery(qLower);

  // วนลูปตรวจสอบทีละลำดับความสำคัญ 1 ถึง 7 อย่างเคร่งครัด
  for (let t = 1; t <= 7; t++) {
    const tierItems = HERB_BOOKS_DATA.filter((i) => i.tier === t);
    const scoredTierItems: { item: HerbBookItem; score: number }[] = [];

    for (const item of tierItems) {
      const score = scoreHerbBookItem(item, qLower, qNorm, isDdiIntent);
      // เกณฑ์คะแนนที่ถือว่าพบข้อมูลที่เกี่ยวข้อง
      if (score >= 25) {
        scoredTierItems.push({ item, score });
      }
    }

    // หากพบข้อมูลในลำดับ t ให้หยุดการค้นหาลำดับถัดไปทันที (Short-Circuit Rule)
    if (scoredTierItems.length > 0) {
      scoredTierItems.sort((a, b) => b.score - a.score);
      const topItems = scoredTierItems.slice(0, maxResults).map((s) => s.item);
      return {
        items: topItems,
        matchedTier: t as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        sourceFile: topItems[0].sourceFile,
        apaCitation: topItems[0].apaCitation,
      };
    }
  }

  return { items: [], matchedTier: null, sourceFile: null, apaCitation: null };
}

/** ค้นหาหนังสือข้อมูลความรู้ (เรียกใช้ searchHerbBooksTiered ภายใต้กฎ Short-Circuit) */
export function searchHerbBooks(query: string, maxResults = 3): HerbBookItem[] {
  const result = searchHerbBooksTiered(query, maxResults);
  return result.items;
}

export function formatHerbBooksForAiContext(items: HerbBookItem[]): string {
  if (!items || items.length === 0) return "";

  const tier = items[0]?.tier;
  const sourceFile = items[0]?.sourceFile;
  let out = `\n[หนังสือและเอกสารข้อมูลความรู้ด้านยาและเวชปฏิบัติ — ลำดับความสำคัญที่ ${tier}: ${sourceFile}]\n`;
  out += `*หมายเหตุตามระเบียบระบบ: พบข้อมูลจากแหล่งข้อมูลลำดับที่ ${tier} ระบบหยุดค้นหาจากแหล่งอื่น และใช้อ้างอิงจากแหล่งนี้เท่านั้น*\n`;

  items.forEach((item, idx) => {
    out += `\n--- รายการที่ ${idx + 1}: ${item.title} (ลำดับที่ ${item.tier}: ${item.sourceFile}) ---\n`;
    out += `• แหล่งอ้างอิง: ${item.bookTitle} (${item.chapter})\n`;
    if (item.evidenceLevel) {
      out += `• ระดับหลักฐานเชิงประจักษ์: ${item.evidenceLevel}\n`;
    }
    if (item.modernDrugs && item.modernDrugs.length > 0) {
      out += `• ยาแผนปัจจุบันที่เกี่ยวข้อง/ใช้ทดแทน: ${item.modernDrugs.join(", ")}\n`;
    }
    if (item.icdCodes && item.icdCodes.length > 0) {
      out += `• รหัสโรคที่เกี่ยวข้อง (ICD-10 / ICD-10-TM): ${item.icdCodes.join(", ")}\n`;
    }
    out += `• รายละเอียดทางวิชาการ: ${item.content}\n`;
    out += `• เอกสารอ้างอิง (APA 7th Edition): ${item.apaCitation}\n`;
  });

  return out;
}

/** ค้นหาข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาจากคู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ กรมการแพทย์ พ.ศ. 2568 โดยเฉพาะ (Tier 1) */
export function searchCpgHerbDrugInteractions(
  query: string,
  maxResults = 3
): HerbBookItem[] {
  const qLower = (query || "").trim().toLowerCase();
  const cpgDdiItems = HERB_BOOKS_DATA.filter(
    (item) =>
      item.tier === 1 &&
      (item.chapter.includes("อันตรกิริยา") ||
        item.title.includes("อันตรกิริยา") ||
        item.content.includes("อันตรกิริยาระหว่างสมุนไพรกับยา"))
  );

  if (!qLower) return cpgDdiItems.slice(0, maxResults);

  const scored = cpgDdiItems.map((item) => {
    let score = 0;
    // ตรวจชื่อสมุนไพร
    if (item.herbs?.some((h) => qLower.includes(h.toLowerCase()))) {
      score += 50;
    }
    // ตรวจชื่อยาแผนปัจจุบัน
    if (item.modernDrugs?.some((d) => qLower.includes(d.toLowerCase()))) {
      score += 40;
    }
    // ตรวจเนื้อหาและหัวข้อ
    if (item.title.toLowerCase().split(/\s+/).some((w) => w.length >= 3 && qLower.includes(w))) {
      score += 20;
    }
    if (item.content.toLowerCase().split(/\s+/).some((w) => w.length >= 4 && qLower.includes(w))) {
      score += 10;
    }
    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0).slice(0, maxResults).map((s) => s.item);
}

