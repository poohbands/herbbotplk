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

export type QueryIntent =
  | "ddi" // อันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน -> Tier 1 (CPG 2568) เท่านั้น
  | "substitution" // การใช้สมุนไพรทดแทนยาแผนปัจจุบัน -> Tier 2 (32 รายการ) หลัก + Tier 7 (19 รายการ) เสริม
  | "clinical_flowchart" // แผนภูมิการตัดสินใจ, เกณฑ์ส่งต่อ, ICD-10 -> Tier 3 หลัก + Tier 1 (Monographs) & Tier 6 (10 อาการ) เสริม
  | "nlem_update" // บัญชียาหลักแห่งชาติ 2568 ฉบับที่ 2 -> Tier 4 หลัก + Tier 1 เสริม
  | "disease_education" // ชุดความรู้ 10 กลุ่มโรคพบบ่อย -> Tier 5 หลัก + Tier 6 เสริม
  | "poster_symptoms" // เจาะจงแผ่นภาพ 10 กลุ่มอาการ A5 บุรีรัมย์ -> Tier 6 หลัก + Tier 3 เสริม
  | "poster_substitution" // เจาะจงแผ่นภาพ 19 ยาทดแทน A5 บุรีรัมย์ -> Tier 7 หลัก + Tier 2 เสริม
  | "general"; // คำถามทั่วไป -> ค้นหาตามลำดับ 1 ถึง 7

export function classifyQueryIntent(query: string): QueryIntent {
  const qLower = (query || "").trim().toLowerCase();
  if (isHerbDrugInteractionQuery(qLower)) {
    return "ddi";
  }
  if (/(?:cd\s*10.*a5|10\s*กลุ่มอาการ.*a5|แผ่นภาพ.*10\s*กลุ่มอาการ|โปสเตอร์.*10\s*กลุ่มอาการ)/i.test(qLower)) {
    return "poster_symptoms";
  }
  if (/(?:ยาทดแทน.*19|19\s*รายการ.*a5|แผ่นภาพ.*19|โปสเตอร์.*19)/i.test(qLower)) {
    return "poster_substitution";
  }
  if (/(?:ฉบับที่\s*2|2568_2|ปรับปรุงใหม่\s*29|29\s*รายการ)/i.test(qLower)) {
    return "nlem_update";
  }
  if (/(?:ทดแทน|แทน(?:ยา)?|ใช้แทน|เปลี่ยนจากยา|กินแทน|กินแทนยา|มียาอะไรแทน|แทน\s*[a-zA-Z]+)/i.test(qLower)) {
    return "substitution";
  }
  if (/(?:icd[- ]?10|icd[- ]?10[- ]?tm|รหัสโรค|ปฐมภูมิ|แผนภูมิการตัดสินใจ|เกณฑ์ส่งต่อ)/i.test(qLower)) {
    return "clinical_flowchart";
  }
  if (/(?:cd\s*10\s*กลุ่มโรค|common\s*diseases|การ์ด\s*10\s*กลุ่มโรค|บัตรความรู้)/i.test(qLower)) {
    return "disease_education";
  }
  return "general";
}

/** ตรวจสอบว่าคำถามเป็นคำถามเกี่ยวกับอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบันหรือไม่ */
export function isHerbDrugInteractionQuery(query: string): boolean {
  const qLower = (query || "").toLowerCase();
  return /(?:อันตรกิริยา|ตีกัน|ยาตี|กินร่วม|ร่วมกับ|กินคู่|ทานคู่|พร้อมยา|กับยา|ห้ามกินกับ|ห้ามใช้ร่วม|ใช้ร่วมกับ|มีผลต่อยา|ปฏิกิริยาต่อกัน|drug[- ]?herb|herb[- ]?drug|interaction|ddi|hdi)/i.test(
    qLower
  );
}

export interface TieredSearchResult {
  items: HerbBookItem[]; // รายการจาก Tier หลัก (คงความเข้ากันได้เดิม)
  primaryItems: HerbBookItem[]; // รายการจาก Tier หลัก
  supplementaryItems: HerbBookItem[]; // รายการจาก Tier เสริมที่ไม่ขัดแย้ง
  matchedTier: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
  allMatchedTiers: (1 | 2 | 3 | 4 | 5 | 6 | 7)[];
  sourceFile: string | null;
  apaCitation: string | null;
  allApaCitations: string[]; // รายการอ้างอิง APA 7th Edition ของทุกแหล่งที่นำมาใช้ตอบ (แหล่งหลักอันดับแรก ตามด้วยแหล่งเสริม)
  intent: QueryIntent;
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
  if (isNlemEdition2 && item.tier !== 4 && item.tier !== 1) return 0;
  if (isPosterA5Symptoms && item.tier !== 6 && item.tier !== 3) return 0;
  if (isPosterA5Substitution && item.tier !== 7 && item.tier !== 2) return 0;
  if (isCd10Cards && item.tier !== 5 && item.tier !== 6) return 0;
  if (isPrimaryCareIcd && item.tier !== 3 && item.tier !== 1 && item.tier !== 6) return 0;
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
 * ค้นหาข้อมูลจากคลังหนังสือความรู้ 7 แหล่งตาม Intent-Driven Hierarchy
 * - จัดลำดับ Tier หลัก (Primary Authority Source) สำหรับประเด็นคำถามหลัก
 * - ดึงข้อมูลจาก Tier เสริมที่เกี่ยวข้อง (Supplementary Sources) เพื่อเสริมประเด็น โดยคำตอบห้ามขัดแย้งกัน
 * - รวบรวมรายการอ้างอิง APA 7th Edition ของทุกแหล่งที่นำมาใช้ตอบจริง (แหล่งหลักอยู่อันดับแรก)
 */
export function searchHerbBooksTiered(
  query: string,
  maxResults = 3
): TieredSearchResult {
  const qLower = (query || "").trim().toLowerCase();
  const emptyResult: TieredSearchResult = {
    items: [],
    primaryItems: [],
    supplementaryItems: [],
    matchedTier: null,
    allMatchedTiers: [],
    sourceFile: null,
    apaCitation: null,
    allApaCitations: [],
    intent: "general",
  };

  if (!qLower) return emptyResult;

  const qNorm = normalizeQuery(qLower);
  const intent = classifyQueryIntent(qLower);
  const isDdiIntent = intent === "ddi";

  // กำหนดคู่ลำดับ Primary และ Allowed Supplementary ตาม Intent
  let primaryTierOrder: number[] = [1, 2, 3, 4, 5, 6, 7];
  let allowedSupplementaryTiers: number[] = [];

  switch (intent) {
    case "ddi":
      // คำถามยาตีกัน / DDI -> ใช้เฉพาะ Tier 1 (CPG 2568) เท่านั้นอย่างเคร่งครัด ไม่มี Tier เสริม
      primaryTierOrder = [1];
      allowedSupplementaryTiers = [];
      break;
    case "substitution":
      // ยาสมุนไพรทดแทนยาแผนปัจจุบัน -> Tier 2 เป็นหลัก, Tier 7 (แผ่นภาพ 19 รายการ) เป็นเสริม
      primaryTierOrder = [2, 7];
      allowedSupplementaryTiers = [7];
      break;
    case "clinical_flowchart":
      // แผนภูมิการตัดสินใจและ ICD-10 -> Tier 3 เป็นหลัก, Tier 1 (Monographs) และ Tier 6 (10 กลุ่มอาการ) เป็นเสริม
      primaryTierOrder = [3];
      allowedSupplementaryTiers = [1, 6];
      break;
    case "nlem_update":
      // ปรับปรุงบัญชียาหลัก 2568 ฉบับที่ 2 -> Tier 4 เป็นหลัก, Tier 1 เป็นเสริม
      primaryTierOrder = [4];
      allowedSupplementaryTiers = [1];
      break;
    case "disease_education":
      // ชุดความรู้ 10 กลุ่มโรค -> Tier 5 เป็นหลัก, Tier 6 เป็นเสริม
      primaryTierOrder = [5];
      allowedSupplementaryTiers = [6];
      break;
    case "poster_symptoms":
      // แผ่นภาพ 10 กลุ่มอาการ สสจ.บุรีรัมย์ -> Tier 6 เป็นหลัก, Tier 3 เป็นเสริม
      primaryTierOrder = [6];
      allowedSupplementaryTiers = [3];
      break;
    case "poster_substitution":
      // แผ่นภาพ 19 ยาทดแทน สสจ.บุรีรัมย์ -> Tier 7 เป็นหลัก, Tier 2 เป็นเสริม
      primaryTierOrder = [7];
      allowedSupplementaryTiers = [2];
      break;
    case "general":
    default:
      primaryTierOrder = [1, 2, 3, 4, 5, 6, 7];
      allowedSupplementaryTiers = [1, 2, 3, 4, 5, 6, 7];
      break;
  }

  // 1. ค้นหา Primary Tier ตามลำดับ priority
  let matchedPrimaryTier: (1 | 2 | 3 | 4 | 5 | 6 | 7) | null = null;
  let primaryItems: HerbBookItem[] = [];

  for (const t of primaryTierOrder) {
    const tierItems = HERB_BOOKS_DATA.filter((i) => i.tier === t);
    const scoredTierItems: { item: HerbBookItem; score: number }[] = [];

    for (const item of tierItems) {
      const score = scoreHerbBookItem(item, qLower, qNorm, isDdiIntent);
      if (score >= 25) {
        scoredTierItems.push({ item, score });
      }
    }

    if (scoredTierItems.length > 0) {
      scoredTierItems.sort((a, b) => b.score - a.score);
      primaryItems = scoredTierItems.slice(0, maxResults).map((s) => s.item);
      matchedPrimaryTier = t as (1 | 2 | 3 | 4 | 5 | 6 | 7);
      break;
    }
  }

  if (!matchedPrimaryTier || primaryItems.length === 0) {
    return emptyResult;
  }

  // 2. ค้นหา Supplementary Tier ที่อนุญาต (ถ้าไม่ใช่ DDI) เพื่อนำมาเสริมประเด็น
  const supplementaryItems: HerbBookItem[] = [];
  const supplementaryTiersMatched: (1 | 2 | 3 | 4 | 5 | 6 | 7)[] = [];

  if (!isDdiIntent && allowedSupplementaryTiers.length > 0) {
    for (const st of allowedSupplementaryTiers) {
      if (st === matchedPrimaryTier) continue;
      const tierItems = HERB_BOOKS_DATA.filter((i) => i.tier === st);
      const scored: { item: HerbBookItem; score: number }[] = [];

      for (const item of tierItems) {
        const score = scoreHerbBookItem(item, qLower, qNorm, false);
        if (score >= 25) {
          scored.push({ item, score });
        }
      }

      if (scored.length > 0) {
        scored.sort((a, b) => b.score - a.score);
        // เลือกไม่เกิน 2 รายการต่อ Tier เสริมเพื่อไม่ให้ล้น context
        supplementaryItems.push(...scored.slice(0, 2).map((s) => s.item));
        supplementaryTiersMatched.push(st as (1 | 2 | 3 | 4 | 5 | 6 | 7));
      }
    }
  }

  // รวบรวมทุก Tier ที่นำมาใช้
  const allMatchedTiers: (1 | 2 | 3 | 4 | 5 | 6 | 7)[] = [
    matchedPrimaryTier,
    ...supplementaryTiersMatched,
  ];

  // รวบรวมและเรียงลำดับรายการอ้างอิง APA 7th Edition:
  // แหล่งข้อมูลหลักอยู่อันดับแรก ตามด้วยแหล่งข้อมูลเสริมทั้งหมด
  const allApaCitations: string[] = [];
  const seenApa = new Set<string>();

  const primaryMeta = HERB_BOOK_CATEGORIES.find((c) => c.tier === matchedPrimaryTier);
  const primaryApa = primaryMeta?.apa || primaryItems[0]?.apaCitation;
  if (primaryApa) {
    allApaCitations.push(primaryApa);
    seenApa.add(primaryApa);
  }

  for (const item of supplementaryItems) {
    const sMeta = HERB_BOOK_CATEGORIES.find((c) => c.tier === item.tier);
    const sApa = sMeta?.apa || item.apaCitation;
    if (sApa && !seenApa.has(sApa)) {
      allApaCitations.push(sApa);
      seenApa.add(sApa);
    }
  }

  return {
    items: primaryItems,
    primaryItems,
    supplementaryItems,
    matchedTier: matchedPrimaryTier,
    allMatchedTiers,
    sourceFile: primaryItems[0].sourceFile,
    apaCitation: primaryApa || primaryItems[0].apaCitation,
    allApaCitations,
    intent,
  };
}

/** ค้นหาหนังสือข้อมูลความรู้ (เรียกใช้ searchHerbBooksTiered ภายใต้กฎ Short-Circuit) */
export function searchHerbBooks(query: string, maxResults = 3): HerbBookItem[] {
  const result = searchHerbBooksTiered(query, maxResults);
  return result.items;
}

export function formatHerbBooksForAiContext(
  items: HerbBookItem[],
  supplementaryItems: HerbBookItem[] = []
): string {
  if ((!items || items.length === 0) && (!supplementaryItems || supplementaryItems.length === 0)) {
    return "";
  }

  let out = "";

  if (items && items.length > 0) {
    const tier = items[0]?.tier;
    const sourceFile = items[0]?.sourceFile;
    out += `\n[หนังสือและเอกสารข้อมูลความรู้ด้านยาและเวชปฏิบัติ — แหล่งข้อมูลหลักลำดับที่ ${tier}: ${sourceFile}]\n`;
    out += `*คำสั่งสำคัญ: ให้ใช้ข้อมูลจากลำดับที่ ${tier} นี้เป็นแกนหลักในการตอบประเด็นคำถามหลักอย่างเคร่งครัด*\n`;

    items.forEach((item, idx) => {
      out += `\n--- รายการหลักที่ ${idx + 1}: ${item.title} (ลำดับที่ ${item.tier}: ${item.sourceFile}) ---\n`;
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
  }

  if (supplementaryItems && supplementaryItems.length > 0) {
    const suppTiers = Array.from(new Set(supplementaryItems.map((s) => s.tier))).join(", ");
    out += `\n[หนังสือและเอกสารข้อมูลความรู้ด้านยาและเวชปฏิบัติ — แหล่งข้อมูลเสริมลำดับที่ ${suppTiers}]\n`;
    out += `*กฎเหล็กเรื่องความไม่ขัดแย้ง: ข้อมูลเสริมนี้ใช้เสริมประเด็นเพิ่มเติมได้ แต่ห้ามขัดแย้ง คัดง้าง หรือทำให้สับสนกับข้อมูลหลักข้างต้นโดยเด็ดขาด หากมีจุดใดต่างกันให้ยึดข้อมูลหลักเป็นข้อยุติ*\n`;

    supplementaryItems.forEach((item, idx) => {
      out += `\n--- รายการเสริมที่ ${idx + 1}: ${item.title} (ลำดับที่ ${item.tier}: ${item.sourceFile}) ---\n`;
      out += `• แหล่งอ้างอิง: ${item.bookTitle} (${item.chapter})\n`;
      if (item.modernDrugs && item.modernDrugs.length > 0) {
        out += `• ยาแผนปัจจุบันที่เกี่ยวข้อง/ใช้ทดแทน: ${item.modernDrugs.join(", ")}\n`;
      }
      if (item.icdCodes && item.icdCodes.length > 0) {
        out += `• รหัสโรคที่เกี่ยวข้อง (ICD-10 / ICD-10-TM): ${item.icdCodes.join(", ")}\n`;
      }
      out += `• รายละเอียดข้อมูลเสริม: ${item.content}\n`;
      out += `• เอกสารอ้างอิง (APA 7th Edition): ${item.apaCitation}\n`;
    });
  }

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

