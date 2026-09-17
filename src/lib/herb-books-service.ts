import dataset from "@/data/herb-books-dataset.json";

export interface HerbBookItem {
  id: string;
  bookCategory:
    | "cpg_medical_services_2568"
    | "substitution_modern_drugs_2567"
    | "primary_care_flowchart_icd10"
    | "nlem_updates_2568"
    | "common_diseases_10";
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
  title: string;
  shortTitle: string;
  count: number;
  description: string;
  apa: string;
}

export const HERB_BOOK_CATEGORIES: HerbBookCategoryMeta[] = [
  {
    id: "cpg_medical_services_2568",
    title: "1. คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ กรมการแพทย์ (CPG เม.ย. 2568)",
    shortTitle: "CPG กรมการแพทย์ 2568",
    count: HERB_BOOKS_DATA.filter((i) => i.bookCategory === "cpg_medical_services_2568").length,
    description: "13 บทแนวทางเวชปฏิบัติทางคลินิก และข้อมูลยาสมุนไพร 17 รายการเชิงลึก พร้อมระดับหลักฐาน ก1, ก2",
    apa: "กรมการแพทย์. (2568). คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ. กระทรวงสาธารณสุข.",
  },
  {
    id: "substitution_modern_drugs_2567",
    title: "2. ยาสมุนไพรในบัญชียาหลักที่ใช้ทดแทนยาแผนปัจจุบัน (สธ. ธ.ค. 2567)",
    shortTitle: "ยาสมุนไพรทดแทนยาแผนปัจจุบัน",
    count: HERB_BOOKS_DATA.filter((i) => i.bookCategory === "substitution_modern_drugs_2567").length,
    description: "32 รายการยาสมุนไพรทดแทนยาแผนปัจจุบันใน 10 กลุ่มโรคสำคัญ (เช่น ขมิ้นชัน แทน Omeprazole, เถาวัลย์เปรียง แทน NSAIDs, ฟ้าทะลายโจร แทน ยาไข้หวัด/Viral infection)",
    apa: "กรมการแพทย์แผนไทยและการแพทย์ทางเลือก. (2567). แนวทางการใช้ยาสมุนไพรในบัญชียาหลักแห่งชาติทดแทนยาแผนปัจจุบันใน 10 กลุ่มโรคสำคัญ. กระทรวงสาธารณสุข.",
  },
  {
    id: "primary_care_flowchart_icd10",
    title: "3. แผนภูมิการรักษาปฐมภูมิและรหัสโรค ICD-10 / ICD-10-TM (2567)",
    shortTitle: "แผนภูมิปฐมภูมิ & ICD-10",
    count: HERB_BOOKS_DATA.filter((i) => i.bookCategory === "primary_care_flowchart_icd10").length,
    description: "แนวทางการรักษาอาการเจ็บป่วย 11 กลุ่มอาการ แผนภูมิการตัดสินใจ เกณฑ์ส่งต่อแพทย์แผนปัจจุบัน และรหัสโรค ICD-10 / ICD-10-TM",
    apa: "กรมการแพทย์แผนไทยและการแพทย์ทางเลือก. (2567). แนวทางการรักษาอาการเจ็บป่วยด้วยยาสมุนไพรในระบบบริการปฐมภูมิ. กระทรวงสาธารณสุข.",
  },
  {
    id: "nlem_updates_2568",
    title: "4. ประกาศบัญชียาหลักแห่งชาติด้านสมุนไพร พ.ศ. 2566 และ ฉบับที่ 2 พ.ศ. 2568",
    shortTitle: "บัญชียาหลัก 2568 ฉบับที่ 2",
    count: HERB_BOOKS_DATA.filter((i) => i.bookCategory === "nlem_updates_2568").length,
    description: "สรุป 29 รายการยาปรับปรุงใหม่ปี 2568 (7 รายการใหม่, 5 ขยายข้อบ่งใช้, 17 ปรับปรุงข้อกำหนด) ตามประกาศราชกิจจานุเบกษา",
    apa: "คณะกรรมการพัฒนาระบบยาแห่งชาติ. (2568). ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (ฉบับที่ 2) พ.ศ. 2568. ราชกิจจานุเบกษา.",
  },
  {
    id: "common_diseases_10",
    title: "5. ชุดความรู้ 10 กลุ่มโรคและกลุ่มอาการพบบ่อย (Common Diseases Cards)",
    shortTitle: "ชุดความรู้ 10 กลุ่มโรค",
    count: HERB_BOOKS_DATA.filter((i) => i.bookCategory === "common_diseases_10").length,
    description: "ชุดข้อมูลความรู้สำหรับประชาชนและหน่วยบริการปฐมภูมิใน 10 กลุ่มโรคและอาการพบบ่อย",
    apa: "กรมการแพทย์แผนไทยและการแพทย์ทางเลือก. (2567). ชุดข้อมูลความรู้การใช้ยาสมุนไพรใน 10 กลุ่มโรคและกลุ่มอาการพบบ่อย. กระทรวงสาธารณสุข.",
  },
];

function normalizeQuery(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[่้๊๋็์]/g, "")
    .replace(/\s+/g, "");
}

export function searchHerbBooks(query: string, maxResults = 3): HerbBookItem[] {
  const qLower = (query || "").trim().toLowerCase();
  if (!qLower) return [];

  const qNorm = normalizeQuery(qLower);
  const isSubstitutionIntent =
    /(?:ทดแทน|แทน(?:ยา)?|ใช้แทน|เปลี่ยนจากยา|กินแทน|กินแทนยา|มียาอะไรแทน|แทน\s*[a-zA-Z]+)/i.test(
      qLower
    );
  const isCpgIntent = /(?:cpg|เวชปฏิบัติ|กรมการแพทย์|แนวทางรักษา|ก1|ก2|หลักฐาน)/i.test(
    qLower
  );
  const isIcdIntent = /(?:icd|รหัสโรค|ปฐมภูมิ|ส่งต่อ)/i.test(qLower);
  const isNlemIntent = /(?:บัญชียาหลัก|2568|ฉบับที่\s*2|ปรับปรุง|ราชกิจจา)/i.test(
    qLower
  );

  const scoredItems: { item: HerbBookItem; score: number }[] = [];

  for (const item of HERB_BOOKS_DATA) {
    let score = 0;

    // 1. ตรวจสอบชื่อยาแผนปัจจุบัน (Modern Drugs)
    if (item.modernDrugs && item.modernDrugs.length > 0) {
      for (const drug of item.modernDrugs) {
        const drugLow = drug.toLowerCase();
        if (qLower.includes(drugLow)) {
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

    // 4. ตรวจสอบหัวข้อและเนื้อหา
    const titleLow = item.title.toLowerCase();
    const chapterLow = item.chapter.toLowerCase();
    const summaryLow = item.summary.toLowerCase();

    if (qLower.split(/\s+/).some((w) => w.length >= 3 && titleLow.includes(w))) {
      score += 15;
    }
    if (qLower.split(/\s+/).some((w) => w.length >= 3 && chapterLow.includes(w))) {
      score += 12;
    }
    if (qLower.split(/\s+/).some((w) => w.length >= 3 && summaryLow.includes(w))) {
      score += 10;
    }

    // 5. โบนัสเจตนา
    if (isSubstitutionIntent && item.bookCategory === "substitution_modern_drugs_2567") {
      score += 30;
    }
    if (isCpgIntent && item.bookCategory === "cpg_medical_services_2568") {
      score += 25;
    }
    if (isIcdIntent && item.bookCategory === "primary_care_flowchart_icd10") {
      score += 25;
    }
    if (isNlemIntent && item.bookCategory === "nlem_updates_2568") {
      score += 25;
    }

    if (score > 0) {
      scoredItems.push({ item, score });
    }
  }

  scoredItems.sort((a, b) => b.score - a.score);

  return scoredItems.slice(0, maxResults).map((s) => s.item);
}

export function formatHerbBooksForAiContext(items: HerbBookItem[]): string {
  if (!items || items.length === 0) return "";

  let out = "\n[หนังสือข้อมูลความรู้ด้านยาและแนวทางเวชปฏิบัติ (Drug Reference Books & Clinical Guidelines)]\n";
  items.forEach((item, idx) => {
    out += `\n--- รายการที่ ${idx + 1}: ${item.title} ---\n`;
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
