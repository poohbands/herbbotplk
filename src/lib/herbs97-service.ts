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
  has_cannabis?: boolean;
}

export const HERBS_97_DATA: Herb97Item[] = dataset as Herb97Item[];

/**
 * รายการคำเรียกเสมือน (Aliases), สัญลักษณ์, และคีย์เวิร์ดของตำรับยากัญชาทางการแพทย์ทั้ง 11 ตำรับ
 */
export interface CannabisAliasDefinition {
  index: number;
  aliases: string[];
  tokens: string[];
}

export const CANNABIS_ALIASES: CannabisAliasDefinition[] = [
  {
    index: 26,
    aliases: [
      "ยาทาขมิ้นชันและกัญชา",
      "ทาขมิ้นชันและกัญชา",
      "ยาทากัญชา",
      "ขมิ้นชันกัญชา",
      "ขมิ้นชันและกัญชา",
      "ยาทาสมุนไพรกัญชา",
    ],
    tokens: ["ขมิ้นชัน", "กัญชา", "ยาทา"],
  },
  {
    index: 31,
    aliases: [
      "ยาน้ำมันสารสกัดกัญชา THC",
      "น้ำมันสารสกัดกัญชา THC",
      "น้ำมันกัญชา THC",
      "น้ำมันกัญชา delta-9",
      "น้ำมันกัญชาเดลต้า9",
      "น้ำมันกัญชา 0.5",
      "น้ำมันกัญชา 3",
      "น้ำมันกัญชาหยด",
      "THC 0.5",
      "THC 3",
      "THC หยด",
    ],
    tokens: ["thc", "delta-9", "เดลต้า", "0.5", "3"],
  },
  {
    index: 58,
    aliases: ["ยาแก้ลมแก้เส้น", "แก้ลมแก้เส้น", "ลมแก้เส้น"],
    tokens: ["แก้ลม", "แก้เส้น", "ลมแก้เส้น"],
  },
  {
    index: 64,
    aliases: ["ยาทำลายพระสุเมรุ", "ทำลายพระสุเมรุ", "พระสุเมรุ"],
    tokens: ["ทำลายพระสุเมรุ", "พระสุเมรุ"],
  },
  {
    index: 66,
    aliases: [
      "ยาน้ำมันกัญชาทั้งห้า",
      "น้ำมันกัญชาทั้งห้า",
      "กัญชาทั้งห้า",
      "น้ำมันทั้งห้า",
      "ทั้งห้า",
    ],
    tokens: ["ทั้งห้า", "กัญชาทั้งห้า"],
  },
  {
    index: 67,
    aliases: [
      "ยาน้ำมันสารสกัดกัญชา 1:1",
      "น้ำมันกัญชา 1:1",
      "น้ำมันกัญชา 1 ต่อ 1",
      "กัญชา 1:1",
      "กัญชา 1 ต่อ 1",
      "THC:CBD 1:1",
      "CBD:THC 1:1",
      "THC CBD 1:1",
      "สารสกัดกัญชา 1:1",
      "น้ำมันสารสกัดกัญชา 1:1",
      "1:1",
      "1 ต่อ 1",
    ],
    tokens: ["1:1", "1ต่อ1", "thc", "cbd"],
  },
  {
    index: 79,
    aliases: [
      "ยาอัมฤตย์โอสถ",
      "อัมฤตย์โอสถ",
      "อมฤตโอสถ",
      "อัมฤตโอสถ",
      "อมฤตย์โอสถ",
    ],
    tokens: ["อัมฤต", "อมฤต", "โอสถ"],
  },
  {
    index: 94,
    aliases: [
      "ยาน้ำมันสารสกัดกัญชา CBD 20:1",
      "น้ำมันกัญชา CBD 20:1",
      "กัญชา CBD 20:1",
      "น้ำมันกัญชา CBD",
      "CBD:THC 20:1",
      "CBD 20:1",
      "CBD 100",
      "CBD 100 มิลลิกรัม",
      "CBD 100 mg",
      "กัญชา 20:1",
      "กัญชา 20 ต่อ 1",
      "น้ำมันกัญชา 20 ต่อ 1",
      "20:1",
      "20 ต่อ 1",
    ],
    tokens: ["20:1", "20ต่อ1", "cbd", "100"],
  },
  {
    index: 95,
    aliases: [
      "ยาน้ำมันกัญชาที่ผลิตจากช่อดอก",
      "น้ำมันกัญชาช่อดอก",
      "กัญชาช่อดอก",
      "น้ำมันช่อดอก",
      "ช่อดอกกัญชา",
      "THC 2.0",
      "THC 2",
      "น้ำมันกัญชา THC 2",
    ],
    tokens: ["ช่อดอก", "2.0", "2มก"],
  },
  {
    index: 96,
    aliases: ["ยาประสะกัญชา", "ประสะกัญชา"],
    tokens: ["ประสะกัญชา", "ประสะ"],
  },
  {
    index: 97,
    aliases: [
      "ยาศุขไสยาศน์",
      "ศุขไสยาศน์",
      "สุขไสยาศน์",
      "ศุขไสยาสน์",
      "สุขไสยาสน์",
      "ยาแก้การนอนไม่หลับกัญชา",
    ],
    tokens: ["ศุขไสยาศน์", "สุขไสยาศน์", "ศุขไสยาสน์", "สุขไสยาสน์", "ศุขไสย", "สุขไสย"],
  },
];

/**
 * รายชื่อตำรับยาที่มีส่วนผสมของกัญชาทั้งหมดจาก 97 รายการ (11 ตำรับ)
 */
export function getCannabisMedicines(): Herb97Item[] {
  return HERBS_97_DATA.filter((item) => item.has_cannabis === true);
}

/**
 * แปลงตัวสะกดภาษาไทยตามเสียงอ่าน เพื่อรองรับคำที่มีความหลากหลายในการสะกด (Phonetic normalization)
 * เช่น ศ/ษ -> ส, ฤ -> รึ, ภ -> พ, ธ/ฑ/ฒ -> ท
 */
export function normalizePhoneticThai(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[ศษ]/g, "ส")
    .replace(/ฤๅ?/g, "รึ")
    .replace(/[ภ]/g, "พ")
    .replace(/[ธฑฒ]/g, "ท")
    .replace(/[ฌ]/g, "ช")
    .replace(/[ญ]/g, "ย")
    .replace(/[ฎ]/g, "ด")
    .replace(/[ฏ]/g, "ต")
    .replace(/[ฐ]/g, "ท")
    .replace(/[ณ]/g, "น")
    .replace(/[ฆ]/g, "ค")
    .replace(/.[์\u0E4C]/g, "") // ตัดพยัญชนะที่มีทัณฑฆาตกำกับ เช่น น์, ย์, ร์
    .replace(/[์่้๊๋็]/g, "") // ตัดวรรณยุกต์และไม้ไต่คู้
    .replace(/[\s\-_,()/:.]+/g, "");
}

/**
 * ตัดคำนำหน้า "ยา", "ยาน้ำมัน", "ยาสเปรย์", "ยาทา" และช่องว่างเพื่อเทียบชื่อยาพื้นฐาน
 */
export function normalizeDrugName(name: string): string {
  return name
    .trim()
    .replace(/^ยา(น้ำมัน|สารสกัด|สเปรย์|ทา|ขี้ผึ้ง|สารสกัด(จาก)?)?/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * ค้นหาข้อมูลยาจากไฟล์ 97 herb.xlsx (sheet ทั้งหมด 97 รายการ)
 * โดยเน้นการค้นหาชื่อยาใน Column A (name) ทั้งแบบตรงทุกตัวอักษร, ชื่อย่อ, ชื่อทางเลือก (Aliases),
 * และการสะกดคำแบบคล้ายเสียง (Phonetic Matching)
 * พิเศษ: หากมีการถามคำถามเกี่ยวกับ "กัญชา" ระบบจะปลดล็อกเพดานจำกัดเพื่อให้ได้รับข้อมูลครบทุกตำรับ ไม่ตกหล่น
 */
export function searchHerbs97ByName(query: string, maxResults = 6): Herb97Item[] {
  if (!query || typeof query !== "string") return [];

  const rawQ = query.trim().toLowerCase();
  const cleanQ = rawQ.replace(/[\s\-_,()/:.]+/g, "");
  const phoneticQ = normalizePhoneticThai(rawQ);
  const normalizedQ = normalizeDrugName(rawQ);

  const isCannabisQuery = /กัญชา|cannabis|thc|cbd|สารสกัดกัญชา|น้ำมันกัญชา|ยากัญชา|เดลต้า|ช่อดอก|1:1|1ต่อ1|20:1|20ต่อ1|ศุขไสย|สุขไสย|อัมฤต|อมฤต|ทำลายพระสุเมรุ|แก้ลมแก้เส้น|ประสะกัญชา/i.test(
    rawQ
  );

  // กรณีคำถามเกี่ยวกับยากัญชา ให้ขยายขีดจำกัดผลลัพธ์เพื่อไม่ให้ตำรับที่ 7-11 ตกหล่น
  const effectiveLimit = isCannabisQuery ? Math.max(maxResults, 12) : maxResults;

  const exactMatches: Herb97Item[] = [];
  const aliasMatches: Herb97Item[] = [];
  const strongMatches: Herb97Item[] = [];
  const closeMatches: Herb97Item[] = [];
  const cannabisFallback: Herb97Item[] = [];

  for (const item of HERBS_97_DATA) {
    const rawName = item.name.toLowerCase();
    const cleanName = rawName.replace(/[\s\-_,()/:.]+/g, "");
    const phoneticName = normalizePhoneticThai(rawName);
    const baseName = normalizeDrugName(rawName);

    // 1. ตรวจสอบชื่อตรงเป๊ะ (Exact match) หรือคำถามมีชื่อทางการตรงเป๊ะ
    if (rawQ === rawName || rawQ.includes(rawName) || cleanQ.includes(cleanName)) {
      exactMatches.push(item);
      continue;
    }

    // 2. ตรวจสอบผ่านระบบชื่อเรียกเสมือนของตำรับยากัญชา (Cannabis Aliases & Ratios)
    if (item.has_cannabis) {
      const aliasDef = CANNABIS_ALIASES.find((a) => a.index === item.index);
      if (aliasDef) {
        // ก) เทียบกับชื่อเสมือน (Aliases) เช่น "น้ำมันกัญชา 1:1", "สุขไสยาศน์", "อมฤตโอสถ"
        const matchedAlias = aliasDef.aliases.some((al) => {
          const cleanAl = al.toLowerCase().replace(/[\s\-_,()/:.]+/g, "");
          const phoneticAl = normalizePhoneticThai(al);
          return (
            rawQ.includes(al.toLowerCase()) ||
            cleanQ.includes(cleanAl) ||
            phoneticQ.includes(phoneticAl)
          );
        });

        if (matchedAlias) {
          aliasMatches.push(item);
          continue;
        }

        // ข) เทียบด้วยกลุ่ม Token เฉพาะ เช่น [thc, cbd, 1:1] หรือ [ช่อดอก, thc]
        if (
          aliasDef.tokens.length >= 2 &&
          aliasDef.tokens.every((tok) => rawQ.includes(tok.toLowerCase()) || cleanQ.includes(tok.toLowerCase()))
        ) {
          aliasMatches.push(item);
          continue;
        }
      }
    }

    // 3. ตรวจสอบชื่อยาหลังตัดคำนำหน้า "ยา..."
    if (baseName.length >= 3 && (rawQ.includes(baseName) || cleanQ.includes(baseName))) {
      strongMatches.push(item);
      continue;
    }

    // 4. ตรวจสอบแบบคล้ายเสียงอ่าน (Phonetic match เช่น สุขไสยาสน์ <-> ศุขไสยาศน์)
    if (phoneticName.length >= 4 && phoneticQ.length >= 4) {
      if (phoneticQ.includes(phoneticName) || phoneticName.includes(phoneticQ)) {
        strongMatches.push(item);
        continue;
      }
    }

    // 5. คำถามมีส่วนหนึ่งของชื่อยาตรงกับชื่อใน Column A (Substring/Close match)
    if (cleanName.length >= 4 && cleanQ.length >= 4) {
      if (cleanName.includes(cleanQ) || cleanQ.includes(cleanName)) {
        closeMatches.push(item);
        continue;
      }
    }

    // 6. กรณีถามกัญชาทั่วไป ให้เก็บเป็น Fallback เพื่อนำเสนอข้อมูลครบทุกตำรับ
    if (isCannabisQuery && item.has_cannabis) {
      cannabisFallback.push(item);
    }
  }

  // รวมผลลัพธ์ตามลำดับความสำคัญ:
  // Exact Match -> Specific Alias Match -> Strong/Phonetic Match -> Close Match -> All Cannabis Fallback
  const result: Herb97Item[] = [];
  const seenIds = new Set<string>();

  for (const item of [
    ...exactMatches,
    ...aliasMatches,
    ...strongMatches,
    ...closeMatches,
    ...cannabisFallback,
  ]) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      result.push(item);
      if (result.length >= effectiveLimit) break;
    }
  }

  return result;
}

/**
 * ค้นหาข้อมูลยาจากไฟล์ 97 herb.xlsx ตามกลุ่มอาการและข้อบ่งใช้ (Indication/Symptoms)
 * พร้อมระบบคัดกรองความสอดคล้องทางคลินิก (Clinical Alignment) เพื่อป้องกันการดึงยาที่ไม่เกี่ยวข้อง
 */
export function searchHerbs97BySymptom(query: string, maxResults = 6): Herb97Item[] {
  if (!query || typeof query !== "string") return [];
  const q = query.toLowerCase();

  const SYMPTOM_GROUPS: {
    pattern: RegExp;
    keywords: string[];
    primaryKeywords?: string[];
  }[] = [
    {
      pattern: /น้ำเหลืองเสีย|น้ำเหลือง|แผลเรื้อรัง/,
      keywords: ["น้ำเหลืองเสีย", "น้ำเหลือง", "แผลเรื้อรัง"],
      primaryKeywords: ["น้ำเหลืองเสีย", "น้ำเหลือง"],
    },
    {
      pattern: /ผื่น|คัน|ลมพิษ|ตุ่มคัน|ผิวหนัง|กลาก|เกลื้อน|เริม|งูสวัด|น้ำกัดเท้า/,
      keywords: ["ผื่น", "คัน", "ลมพิษ", "ตุ่มคัน", "ผิวหนัง", "กลาก", "เกลื้อน", "เริม", "งูสวัด", "น้ำกัดเท้า"],
    },
    {
      pattern: /ไอ|เสมหะ|ระคายคอ|เจ็บคอ|คอแห้ง/,
      keywords: ["ไอ", "เสมหะ", "ขับเสมหะ", "ละลายเสมหะ", "เจ็บคอ", "ระคายคอ"],
    },
    {
      pattern: /ท้องอืด|ท้องเฟ้อ|จุกเสียด|แน่นท้อง|ขับลม|แก๊สในกระเพาะ/,
      keywords: ["ท้องอืด", "ท้องเฟ้อ", "จุกเสียด", "แน่น", "ขับลม"],
    },
    {
      pattern: /ท้องเสีย|ถ่ายเหลว|ลงท้อง|อุจจาระร่วง|บิด/,
      keywords: ["ท้องเสีย", "ถ่ายเหลว", "อุจจาระร่วง", "บิด"],
    },
    {
      pattern: /ท้องผูก|ถ่ายยาก|ระบาย|อุจจาระแข็ง/,
      keywords: ["ท้องผูก", "ระบาย", "ยาระบาย", "ขับถ่าย"],
    },
    {
      pattern: /ไข้|ตัวร้อน|ครั่นเนื้อครั่นตัว|ลดไข้|แก้ไข้/,
      keywords: ["ไข้", "ตัวร้อน", "แก้ไข้", "ลดไข้"],
    },
    {
      pattern: /นอนไม่หลับ|หลับยาก|เครียด|วิตกกังวล/,
      keywords: ["นอนไม่หลับ", "ช่วยให้นอนหลับ", "คลายเครียด", "สงบประสาท"],
    },
    {
      pattern: /ปวดเมื่อย|กล้ามเนื้อ|เคล็ด|ขัดยอก|ข้อเข่า|ปวดข้อ|ข้ออักเสบ/,
      keywords: ["ปวดเมื่อย", "กล้ามเนื้อ", "เคล็ด", "ขัดยอก", "ปวดข้อ", "ข้อเข่า"],
    },
  ];

  const matchedTargetKeywords: string[] = [];
  const primaryTargets: string[] = [];

  for (const group of SYMPTOM_GROUPS) {
    if (group.pattern.test(q)) {
      matchedTargetKeywords.push(...group.keywords);
      if (group.primaryKeywords) {
        primaryTargets.push(...group.primaryKeywords);
      }
    }
  }

  if (matchedTargetKeywords.length === 0) {
    const rawTokens = q.split(/[\s,()/:.]+/).filter((t) => t.length >= 3);
    matchedTargetKeywords.push(...rawTokens);
  }

  const scoredItems: { item: Herb97Item; score: number }[] = [];

  for (const item of HERBS_97_DATA) {
    const ind = (item.indication || "").toLowerCase();
    if (!ind) continue;

    let score = 0;

    // คำหลักสำคัญยิ่งยวด (Primary Targets) เช่น น้ำเหลืองเสีย
    for (const pk of primaryTargets) {
      if (ind.includes(pk)) {
        score += 50;
      }
    }

    // คำหลักกลุ่มอาการ
    for (const kw of matchedTargetKeywords) {
      if (ind.includes(kw.toLowerCase())) {
        score += 10;
      }
    }

    // ระบบป้องกันความไม่สอดคล้องทางคลินิก (Clinical Mismatch Guard):
    // ตัวอย่าง: ถ้าผู้ใช้ถามเรื่องผิวหนัง/น้ำเหลืองเสีย แต่ยานั้นมีข้อบ่งใช้เฉพาะทางเดินอาหาร/ท้องเสีย หรือแก้ไข้/หัดเท่านั้น
    const isSkinOrLymphQuery = /น้ำเหลือง|ผื่น|คัน|ผิวหนัง|แผล/i.test(q);
    const isDigestiveOnly = /ท้องเสีย|อุจจาระ|บิด|ท้องร่วง/i.test(ind) && !/น้ำเหลือง|ผื่น|คัน|ผิวหนัง|แผล/i.test(ind);
    const isFeverOrMeaslesOnly = /ไข้|ตัวร้อน|พิษหัด/i.test(ind) && !/น้ำเหลือง|ผื่น|คัน|ผิวหนัง|แผล/i.test(ind);

    if (isSkinOrLymphQuery && (isDigestiveOnly || isFeverOrMeaslesOnly)) {
      score = 0;
    }

    if (score > 0) {
      scoredItems.push({ item, score });
    }
  }

  scoredItems.sort((a, b) => b.score - a.score);
  return scoredItems.slice(0, maxResults).map((s) => s.item);
}

/**
 * จัดรูปแบบข้อมูลจาก 97 herb.xlsx ให้พร้อมใส่ใน Context สำหรับ AI
 */
export function formatHerb97ForAiContext(items: Herb97Item[]): string {
  if (!items || items.length === 0) return "";

  const cannabisItems = items.filter((i) => i.has_cannabis);
  let out = "\n[ข้อมูลเภสัชกรรมและแนวทางการใช้ยาสมุนไพร]:\n";

  // หากมีตำรับยากัญชา ให้สรุปภาพรวมการสั่งจ่ายและข้อกำหนดกฎหมาย
  if (cannabisItems.length > 0) {
    out += `\n🌿 [ภาพรวมตำรับยากัญชาทางการแพทย์ (${cannabisItems.length} ตำรับ)]:`;
    out += `\n• ตำรับยากัญชาทางการแพทย์ทุกตำรับต้องสั่งจ่ายโดยแพทย์หรือแพทย์แผนไทยที่มีใบอนุญาตรับรองจากกระทรวงสาธารณสุขเท่านั้น`;
    out += `\n• ข้อห้ามใช้สากล: ห้ามใช้ในสตรีมีครรภ์ สตรีให้นมบุตร และผู้มีอายุต่ำกว่า 18 ปี`;
    out += `\n• รายการตำรับที่เกี่ยวข้อง: ${cannabisItems.map((c) => c.name).join(", ")}\n`;
  }

  for (const item of items) {
    const cannabisTag = item.has_cannabis ? " [⚠️ ตำรับยาที่มีส่วนผสมของกัญชาทางการแพทย์]" : "";
    out += `\n--- ข้อมูลยา: ${item.name}${cannabisTag} ---\n`;
    if (item.has_cannabis) {
      out += `• หมายเหตุพิเศษ: ยานี้เป็นตำรับที่มีส่วนผสมจากกัญชาทางการแพทย์ ต้องสั่งจ่ายโดยแพทย์/แพทย์แผนไทยที่มีใบอนุญาต ห้ามใช้ในหญิงตั้งครรภ์ หญิงให้นมบุตร และผู้มีอายุต่ำกว่า 18 ปี\n`;
    }
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
