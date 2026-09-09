import { supabase } from "@/integrations/supabase/client";
import { getLocalProviders, type ProviderItem } from "./ai-providers-storage";
import { getKnowledgeSettings, type KnowledgeSettings } from "./knowledge-settings";
import { searchHerbs97ByName, formatHerb97ForAiContext, type Herb97Item } from "./herbs97-service";
import { findVerifiedAnswer, addToLearningQueue } from "./learning-verification-service";

// พจนานุกรมอาการภาษาไทยเพื่อจับคู่สมุนไพร
const SYMPTOM_MAP = [
  { match: /ไข้|ตัวร้อน|ครั่นเนื้อครั่นตัว|หนาวสั่น|จับไข้/, terms: ["ไข้", "ตัวร้อน", "แก้ไข้", "ลดไข้", "บรรเทาไข้", "ถอนพิษไข้", "ดับพิษไข้"] },
  { match: /หวัด|คัดจมูก|น้ำมูก|เจ็บคอ|คออักเสบ|ไซนัส|ภูมิแพ้ทางเดินหายใจ/, terms: ["หวัด", "เจ็บคอ", "แก้ไอ", "ขับเสมหะ", "คัดจมูก", "น้ำมูก"] },
  { match: /ไอ|เสมหะ|ระคายคอ|คอแห้ง|เจ็บคอ|ไอแห้ง|ไอมีเสมหะ/, terms: ["ไอ", "เสมหะ", "แก้ไอ", "ขับเสมหะ", "ละลายเสมหะ", "ชุ่มคอ"] },
  { match: /ท้องอืด|ท้องเฟ้อ|จุกเสียด|แน่นท้อง|ลมในกระเพาะ|ขับลม|แก๊สในกระเพาะ/, terms: ["ท้องอืด", "ท้องเฟ้อ", "ขับลม", "จุกเสียด", "แน่น", "ช่วยย่อย"] },
  { match: /ท้องเสีย|ถ่ายเหลว|ลงท้อง|อุจจาระร่วง|บิด|มวนท้อง/, terms: ["ท้องเสีย", "แก้ท้องเสีย", "บิด", "สมานลำไส้"] },
  { match: /ท้องผูก|ถ่ายยาก|ไม่ถ่าย|ระบาย|อุจจาระแข็ง/, terms: ["ท้องผูก", "ระบาย", "ยาระบาย", "ขับถ่าย"] },
  { match: /คลื่นไส้|อาเจียน|เมารถ|เมาเรือ|พะอืดพะอม|วิงเวียน/, terms: ["คลื่นไส้", "อาเจียน", "เมารถ", "วิงเวียน", "เป็นลม"] },
  { match: /ปวดเมื่อย|กล้ามเนื้อ|เคล็ด|ขัดยอก|ฟกช้ำ|เส้นเอ็น|เอ็นอักเสบ|ปวดหลัง|ปวดเอว|ข้อเข่า|ปวดข้อ|ข้ออักเสบ|ข้อบวม|รูมาตอยด์/, terms: ["ปวดเมื่อย", "กล้ามเนื้อ", "ฟกช้ำ", "คลายกล้ามเนื้อ", "ปวดข้อ", "เส้นเอ็น", "ข้อเข่าเสื่อม"] },
  { match: /นอนไม่หลับ|เครียด|วิตกกังวล|สะดุ้ง|หลับยาก|กระสับกระส่าย|พักผ่อนน้อย/, terms: ["นอนไม่หลับ", "ช่วยให้นอนหลับ", "คลายเครียด", "บำรุงหัวใจ", "สงบประสาท"] },
  { match: /ริดสีดวง|ริดสีดวงทวาร|ติ่งทวาร|ถ่ายเป็นเลือด/, terms: ["ริดสีดวง", "ริดสีดวงทวาร"] },
  { match: /เบาหวาน|น้ำตาลในเลือด|คุมน้ำตาล/, terms: ["เบาหวาน", "ลดน้ำตาล", "น้ำตาลในเลือด"] },
  { match: /ความดัน|ความดันโลหิต|ความดันสูง/, terms: ["ความดัน", "ลดความดัน", "บำรุงหลอดเลือด"] },
  { match: /กรดไหลย้อน|แสบร้อนกลางอก|แสบอก|เรอเปรี้ยว/, terms: ["กรดไหลย้อน", "กระเพาะ", "แสบร้อน", "แผลในกระเพาะ"] },
  { match: /ปวดท้อง|ปวดกระเพาะ|โรคกระเพาะ|แผลในทางเดินอาหาร/, terms: ["ปวดท้อง", "กระเพาะ", "จุกเสียด", "แผลในกระเพาะ"] },
  { match: /ประจำเดือน|ปวดประจำเดือน|ระดู|ขับน้ำคาวปลา|ระดูขาว|ปวดท้องเมนส์/, terms: ["ประจำเดือน", "ปวดประจำเดือน", "ระดู", "ขับน้ำคาวปลา", "ฟอกโลหิต"] },
  { match: /ผื่น|คัน|ลมพิษ|ตุ่มคัน|ผิวหนังอักเสบ|น้ำกัดเท้า|เริม|งูสวัด/, terms: ["ผื่น", "คัน", "แก้คัน", "น้ำเหลือง", "สมานแผล", "ผิวหนัง"] },
  { match: /แผล|แผลไฟไหม้|น้ำร้อนลวก|แผลสด|แผลเรื้อรัง/, terms: ["แผล", "สมานแผล", "ฆ่าเชื้อ", "แก้อักเสบ"] },
  { match: /บำรุงกำลัง|อ่อนเพลีย|เหนื่อยง่าย|บำรุงร่างกาย|บำรุงธาตุ/, terms: ["บำรุงกำลัง", "บำรุงร่างกาย", "บำรุงธาตุ", "อายุวัฒนะ", "ปรับธาตุ"] },
];

// สมุนไพร: คำภาษาไทย → ชื่อวิทยาศาสตร์สำหรับค้น PubMed
const HERB_THAI_TO_SCI: Record<string, string> = {
  "แปะก๊วย": "Ginkgo biloba",
  "ใบแปะก๊วย": "Ginkgo biloba",
  "กระเทียม": "Allium sativum",
  "ขิง": "Zingiber officinale",
  "โสม": "Panax ginseng",
  "โสมเกาหลี": "Panax ginseng",
  "ขมิ้นชัน": "Curcuma longa",
  "ขมิ้น": "Curcuma longa",
  "ฟ้าทะลายโจร": "Andrographis paniculata",
  "กระชายดำ": "Kaempferia parviflora",
  "กระชาย": "Boesenbergia rotunda",
  "กระชายขาว": "Boesenbergia rotunda",
  "ชาเขียว": "Camellia sinensis",
  "ตังกุย": "Angelica sinensis",
  "เซนต์จอห์นเวิร์ต": "Hypericum perforatum",
  "มะรุม": "Moringa oleifera",
  "ว่านหางจระเข้": "Aloe vera",
  "รางจืด": "Thunbergia laurifolia",
  "บัวบก": "Centella asiatica",
  "ใบบัวบก": "Centella asiatica",
  "มะขามป้อม": "Phyllanthus emblica",
  "กะเพรา": "Ocimum tenuiflorum",
  "โหระพา": "Ocimum basilicum",
  "ตะไคร้": "Cymbopogon citratus",
  "พริกไทย": "Piper nigrum",
  "อบเชย": "Cinnamomum verum",
  "ชะพลู": "Piper sarmentosum",
  "มะระขี้นก": "Momordica charantia",
  "หญ้าหวาน": "Stevia rebaudiana",
  "ดอกคำฝอย": "Carthamus tinctorius",
  "เก๋ากี้": "Lycium barbarum",
  "เห็ดหลินจือ": "Ganoderma lucidum",
};

// ยาแผนปัจจุบัน: คำภาษาไทย → term ภาษาอังกฤษสำหรับ PubMed
const DRUG_THAI_TO_EN: Record<string, string> = {
  "ยาละลายลิ่มเลือด": "anticoagulant OR warfarin OR antiplatelet",
  "ละลายลิ่มเลือด": "anticoagulant OR warfarin",
  "ยาต้านการแข็งตัวของเลือด": "anticoagulant OR warfarin",
  "วาร์ฟาริน": "warfarin",
  "แอสไพริน": "aspirin",
  "ยาแอสไพริน": "aspirin",
  "โคลพิโดเกรล": "clopidogrel",
  "ยาคุมกำเนิด": "oral contraceptive",
  "ยาคุม": "oral contraceptive",
  "ยาลดความดัน": "antihypertensive",
  "ยาความดัน": "antihypertensive",
  "แอมโลดิพีน": "amlodipine",
  "โลซาร์แทน": "losartan",
  "อีนาลาพริล": "enalapril",
  "ยาเบาหวาน": "antidiabetic OR metformin",
  "เมทฟอร์มิน": "metformin",
  "อินซูลิน": "insulin",
  "ยากดภูมิ": "immunosuppressant",
  "ยาปฏิชีวนะ": "antibiotic",
  "อะม็อกซี": "amoxicillin",
  "ยาแก้ปวด": "analgesic OR NSAID OR paracetamol",
  "ยาแก้อักเสบ": "NSAID",
  "พารา": "paracetamol OR acetaminophen",
  "พาราเซตามอล": "paracetamol OR acetaminophen",
  "ยาลดไข้": "paracetamol OR antipyretic",
  "ไอบูโพรเฟน": "ibuprofen",
  "ยาลดกรด": "omeprazole OR proton pump inhibitor OR antacid",
  "โอเมพราโซล": "omeprazole",
  "ยาแก้แพ้": "antihistamine",
  "สแตติน": "statin",
};

export type PubMedItem = {
  pmid: string;
  title: string;
  authors: string;
  year: string;
  journal: string;
};

export type ThaiJoItem = {
  title: string;
  authors: string;
  year?: string;
  journal: string;
  url: string;
};

// รายชื่อสมุนไพรทั้งหมดที่มีในฐานข้อมูล DDI มหิดล (68 ชนิด)
export const MAHIDOL_HERBS: string[] = [
  "HOPS", "กระชาย", "กระชายดำ", "กระเจี๊ยบแดง", "กระเทียม", "กล้วย", "กะเพรา", "กานพลู",
  "ขมิ้น", "ขมิ้นอ้อย", "ขิง", "ขึ้นฉ่าย", "คะน้าเม็กซิโก", "คำฝอย", "งา", "ชะเอมเทศ",
  "ดาวเรืองฝรั่ง", "ดีปลี", "ทองพันชั่ง", "ทับทิม", "บอระเพ็ด", "บัวบก", "ปลาไหลเผือก",
  "ปัญจขันธ์", "ผักกาดแดง", "ผักชี", "ฝรั่ง", "พญาปล้องทอง", "พญาสัตตบรรณ", "พรมมิ",
  "พริกไทย", "พุทรา", "ฟ้าทะลายโจร", "มะขาม", "มะขามป้อม", "มะขามเทศ", "มะขามแขก",
  "มะพร้าว", "มะม่วง", "มะระขี้นก", "มะรุม", "มะละกอ", "มังคุด", "ยอ", "ยี่หร่า",
  "ลินิน", "ลูกซัด", "ลูกใต้ใบ", "สมอไทย", "สับปะรด", "สายน้ำผึ้ง", "สาหร่าย",
  "หญ้าฝรั่น", "หญ้าละออง", "หญ้าหนวดแมว", "หญ้าหวาน", "องุ่น", "อินทนิลน้ำ", "อินทผลัม",
  "เจตมูลเพลิงแดง", "เถาวัลย์เปรียง", "เทียนกิ่ง", "เทียนเกล็ดหอย", "เสาวรส", "เห็ดหลินจือ",
  "แปะก๊วย", "โกจิเบอร์รี", "โสม",
];

// พจนานุกรมจับคู่คำพ้องในภาษาไทยสู่ชื่อสมุนไพรในฐานข้อมูลมหิดล
export const HERB_SYNONYMS_TO_MAHIDOL: Record<string, string> = {
  "ขมิ้นชัน": "ขมิ้น",
  "เหง้าขมิ้นชัน": "ขมิ้น",
  "ขมิ้นสด": "ขมิ้น",
  "ใบบัวบก": "บัวบก",
  "ดอกคำฝอย": "คำฝอย",
  "ใบแปะก๊วย": "แปะก๊วย",
  "สารสกัดแปะก๊วย": "แปะก๊วย",
  "โสมเกาหลี": "โสม",
  "โสมคน": "โสม",
  "เก๋ากี้": "โกจิเบอร์รี",
  "โกจิเบอร์รี่": "โกจิเบอร์รี",
  "กระชายขาว": "กระชาย",
  "กระชายแกง": "กระชาย",
  "น้ำขิง": "ขิง",
  "เหง้าขิง": "ขิง",
  "มะระ": "มะระขี้นก",
};

/** สกัดชื่อสมุนไพรและยาแผนปัจจุบันที่อยู่ในคำถามอย่างละเอียด */
export function extractQuestionEntities(
  question: string,
  matchedHerbs: any[] = []
): {
  herbs: string[];
  drugs: string[];
  isGeneralHerbsQuestion: boolean;
  isGeneralDrugsQuestion: boolean;
  isDdiIntent: boolean;
} {
  const qLower = (question || "").toLowerCase();
  const detectedHerbs = new Set<string>();

  // 1. ตรวจสอบสมุนไพรจาก matchedHerbs ที่ตรวจพบในระบบ
  for (const mh of matchedHerbs) {
    const name = (mh.name_thai || mh.name || "").trim();
    if (!name) continue;
    if (HERB_SYNONYMS_TO_MAHIDOL[name]) {
      detectedHerbs.add(HERB_SYNONYMS_TO_MAHIDOL[name]);
    }
    for (const h of MAHIDOL_HERBS) {
      if (name.toLowerCase() === h.toLowerCase() || name.includes(h) || h.includes(name)) {
        detectedHerbs.add(h);
      }
    }
  }

  // 2. ตรวจสอบคำพ้อง (Synonyms) ในคำถาม
  for (const [syn, target] of Object.entries(HERB_SYNONYMS_TO_MAHIDOL)) {
    if (qLower.includes(syn.toLowerCase())) {
      detectedHerbs.add(target);
    }
  }

  // 3. ตรวจสอบชื่อสมุนไพรมหิดล โดยเรียงจากคำยาวไปคำสั้นเพื่อป้องกันการจับคู่ผิด
  const sortedMahidolHerbs = [...MAHIDOL_HERBS].sort((a, b) => b.length - a.length);
  for (const h of sortedMahidolHerbs) {
    const hLower = h.toLowerCase();
    if (qLower.includes(hLower)) {
      // ข้อยกเว้นสำหรับคำประสม
      if (h === "กระชาย" && qLower.includes("กระชายดำ") && !qLower.includes("กระชายขาว") && !qLower.includes("กระชายแกง")) {
        continue;
      }
      if (h === "ขมิ้น" && qLower.includes("ขมิ้นอ้อย") && !qLower.includes("ขมิ้นชัน")) {
        continue;
      }
      if (h === "มะขาม" && (qLower.includes("มะขามป้อม") || qLower.includes("มะขามแขก") || qLower.includes("มะขามเทศ"))) {
        continue;
      }
      detectedHerbs.add(h);
    }
  }

  // 4. ตรวจสอบชื่อยาแผนปัจจุบัน
  const detectedDrugs = new Set<string>();
  for (const [thai, en] of Object.entries(DRUG_THAI_TO_EN)) {
    if (qLower.includes(thai.toLowerCase())) {
      const cleanEn = en.split(/\s+OR\s+/i)[0].trim().toLowerCase();
      detectedDrugs.add(cleanEn);
    }
  }

  // ตรวจจับชื่อยาภาษาอังกฤษในคำถาม (เช่น warfarin, aspirin, paracetamol ฯลฯ)
  const englishWords = qLower.match(/[a-z]{3,}/g) || [];
  for (const word of englishWords) {
    if (!["and", "the", "for", "with", "not", "can", "use", "herb", "drug", "take", "daily", "how", "what"].includes(word)) {
      detectedDrugs.add(word);
    }
  }

  const isGeneralHerbsQuestion =
    /(?:ห้ามกินสมุนไพรอะไร|สมุนไพรอะไรบ้าง|สมุนไพรตัวไหน|มียาสมุนไพรตัวไหน|สมุนไพรใดบ้าง|สมุนไพรที่มีผล|สมุนไพรที่ตีกับ)/.test(qLower);

  const isGeneralDrugsQuestion =
    /(?:ห้ามกินกับยาอะไร|ยาอะไรบ้าง|ยาตัวไหน|มียาใดบ้าง|ยาแผนปัจจุบันอะไร|อันตรกิริยากับยา|ตีกับยาอะไร|มีผลกับยาอะไร)/.test(qLower);

  const isDdiIntent =
    detectedDrugs.size > 0 ||
    isGeneralDrugsQuestion ||
    isGeneralHerbsQuestion ||
    /(?:อันตรกิริยา|ตีกัน|กินร่วม|ร่วมกับ|กินคู่|ทานคู่|พร้อมยา|กับยา)/.test(qLower);

  return {
    herbs: Array.from(detectedHerbs),
    drugs: Array.from(detectedDrugs),
    isGeneralHerbsQuestion,
    isGeneralDrugsQuestion,
    isDdiIntent,
  };
}

/** ค้นหาข้อมูลอันตรกิริยา ม.มหิดล ที่ตรงกับคำถามอย่างแม่นยำ 100% (Strict Entity Matching) */
export function findRelevantMahidolDdi(
  question: string,
  allDocs: any[],
  matchedHerbs: any[] = []
): any[] {
  if (!allDocs || allDocs.length === 0) return [];

  const { herbs, drugs, isGeneralHerbsQuestion, isGeneralDrugsQuestion, isDdiIntent } =
    extractQuestionEntities(question, matchedHerbs);

  // หากไม่มีเจตนาเรื่องอันตรกิริยาหรือไม่ระบุตัวยา/สมุนไพร ไม่ดึง DDI
  if (!isDdiIntent && herbs.length === 0 && drugs.length === 0) {
    return [];
  }

  const matched: any[] = [];
  const seenPairs = new Set<string>();

  for (const doc of allDocs) {
    const title = doc.title || "";
    const m = title.match(/อันตรกิริยาระหว่าง\s+(.+?)\s+กับ\s+(.+?)(?:\s+\(ม\.มหิดล\))?$/);
    const docHerb = m ? m[1].trim() : "";
    const docDrug = m ? m[2].trim() : "";
    const docDrugLower = docDrug.toLowerCase();

    // Deduplicate same herb-drug pair
    const pairKey = `${docHerb}::${docDrugLower}`;
    if (seenPairs.has(pairKey)) continue;

    const herbMatches =
      herbs.length > 0 &&
      herbs.some((h) => {
        const hLower = h.toLowerCase();
        const docHerbLower = docHerb.toLowerCase();
        return (
          docHerbLower === hLower ||
          docHerbLower.includes(hLower) ||
          hLower.includes(docHerbLower)
        );
      });

    const drugMatches =
      drugs.length > 0 &&
      drugs.some((d) => {
        const dLower = d.toLowerCase();
        return (
          docDrugLower === dLower ||
          docDrugLower.includes(dLower) ||
          dLower.includes(docDrugLower)
        );
      });

    if (herbs.length > 0 && drugs.length > 0) {
      // 1. ระบุทั้งสมุนไพรและยา (เช่น "ขมิ้นชันกินร่วมกับยา Warfarin ได้ไหม?")
      // ต้องตรงทั้งสมุนไพร และ ยา เท่านั้น! ห้ามหลุดสมุนไพรอื่นเด็ดขาด!
      if (herbMatches && drugMatches) {
        seenPairs.add(pairKey);
        matched.push(doc);
      }
    } else if (herbs.length > 0 && (drugs.length === 0 || isGeneralDrugsQuestion)) {
      // 2. ระบุเฉพาะสมุนไพร ถามถึงยา เช่น "ขมิ้นชันมีอันตรกิริยากับยาอะไรบ้าง"
      if (herbMatches && (isGeneralDrugsQuestion || isDdiIntent)) {
        seenPairs.add(pairKey);
        matched.push(doc);
      }
    } else if (drugs.length > 0 && (herbs.length === 0 || isGeneralHerbsQuestion)) {
      // 3. ระบุเฉพาะยา ถามถึงสมุนไพร เช่น "คนกิน warfarin ห้ามกินสมุนไพรอะไรบ้าง"
      if (drugMatches && (isGeneralHerbsQuestion || isDdiIntent)) {
        seenPairs.add(pairKey);
        matched.push(doc);
      }
    }
  }

  // เรียงตามระดับความรุนแรง (มาก -> ปานกลาง -> น้อย)
  const severityScore = (c: string) => {
    if (c.includes("ความรุนแรง: มาก")) return 3;
    if (c.includes("ความรุนแรง: ปานกลาง")) return 2;
    if (c.includes("ความรุนแรง: น้อย")) return 1;
    return 0;
  };

  matched.sort((a, b) => severityScore(b.content || "") - severityScore(a.content || ""));

  return herbs.length > 0 && drugs.length > 0 ? matched.slice(0, 5) : matched.slice(0, 8);
}

/** ตรวจสอบและคัดกรองอ้างอิงอย่างเข้มงวดก่อนแสดงผล (Strict Pre-Response Reference Validation) */
export function validateAndPruneSources(
  question: string,
  answer: string,
  sources: {
    internal?: any[];
    pubmed?: any[];
    thaijo?: any[];
    knowledge?: any[];
  }
): {
  internal: any[];
  pubmed: any[];
  thaijo: any[];
  knowledge: any[];
} {
  const { herbs, drugs, isGeneralHerbsQuestion, isGeneralDrugsQuestion } =
    extractQuestionEntities(question);
  const qLower = (question || "").toLowerCase();
  const aLower = (answer || "").toLowerCase();

  // 1. ตรวจสอบและกรอง Knowledge Documents (โดยเฉพาะ DDI มหิดล)
  const rawKnowledge = sources.knowledge || [];
  const validKnowledge: any[] = [];
  const seenKnowledgeTitles = new Set<string>();

  for (const k of rawKnowledge) {
    const title = (k.title || "").trim();
    if (!title || seenKnowledgeTitles.has(title)) continue;

    if (k.category === "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)") {
      const m = title.match(/อันตรกิริยาระหว่าง\s+(.+?)\s+กับ\s+(.+?)(?:\s+\(ม\.มหิดล\))?$/);
      const docHerb = m ? m[1].trim() : "";
      const docDrug = m ? m[2].trim() : "";

      // ถ้าผู้ใช้ระบุสมุนไพรเฉพาะเจาะจง สมุนไพรในเอกสารต้องตรงกับที่ถาม
      if (herbs.length > 0) {
        const herbMatch = herbs.some(
          (h) =>
            docHerb.toLowerCase() === h.toLowerCase() ||
            docHerb.toLowerCase().includes(h.toLowerCase()) ||
            h.toLowerCase().includes(docHerb.toLowerCase())
        );
        if (!herbMatch) {
          continue; // ตัดสมุนไพรที่ไม่เกี่ยวข้องทิ้งทันที
        }
      }

      // ถ้าผู้ใช้ระบุยาเฉพาะเจาะจง ยาในเอกสารต้องตรงกับที่ถาม
      if (drugs.length > 0) {
        const drugMatch = drugs.some(
          (d) =>
            docDrug.toLowerCase() === d.toLowerCase() ||
            docDrug.toLowerCase().includes(d.toLowerCase()) ||
            d.toLowerCase().includes(docDrug.toLowerCase())
        );
        if (!drugMatch) {
          continue; // ตัดยาที่ไม่เกี่ยวข้องทิ้งทันที
        }
      }

      // สมุนไพรหรือยาในเอกสารนี้ ต้องปรากฏในคำถาม หรือคำตอบของ AI
      const herbInText =
        qLower.includes(docHerb.toLowerCase()) ||
        aLower.includes(docHerb.toLowerCase());
      const drugInText =
        qLower.includes(docDrug.toLowerCase()) ||
        aLower.includes(docDrug.toLowerCase());

      if (!herbInText && !drugInText && !isGeneralHerbsQuestion && !isGeneralDrugsQuestion) {
        continue;
      }
    } else if (k.category === "บัญชียาหลักแห่งชาติด้านสมุนไพร") {
      // ตรวจสอบชื่อยาในเอกสารบัญชียาหลักแห่งชาติ (เช่น บัญชียาหลักแห่งชาติด้านสมุนไพร: ยาขมิ้นชัน (พ.ศ. 2568))
      const mDrug = title.match(/บัญชียาหลักแห่งชาติด้านสมุนไพร:\s*(ยา[^\s(]+|[^\s(]+)/);
      const docDrugName = mDrug ? mDrug[1].trim() : "";
      const docDrugClean = docDrugName.replace(/^ยา/, "").trim();

      const drugMentioned =
        (docDrugName && (qLower.includes(docDrugName.toLowerCase()) || aLower.includes(docDrugName.toLowerCase()))) ||
        (docDrugClean.length >= 2 && (qLower.includes(docDrugClean.toLowerCase()) || aLower.includes(docDrugClean.toLowerCase())));

      if (!drugMentioned) {
        continue; // ตัดเอกสารบัญชียาหลักที่ไม่เกี่ยวข้องทิ้ง
      }
    }

    seenKnowledgeTitles.add(title);
    validKnowledge.push(k);
  }

  return {
    internal: sources.internal || [],
    pubmed: sources.pubmed || [],
    thaijo: sources.thaijo || [],
    knowledge: validKnowledge,
  };
}

/** normalize ชื่อยาไทยเพื่อเทียบแบบยืดหยุ่น (ตัดคำนำหน้า/เว้นวรรค/ไม้ทัณฑฆาต/ศ-ษ→ส) */
export function normalizeThaiName(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[\s\u0E4C().,\-–—/]/g, "")
    .replace(/^(ยาตำรับ|ตำรับยา|ตำรับ|ยา)/, "")
    .replace(/[ศษ]/g, "ส")
    .replace(/ณ/g, "น");
}

type ThaiJoCatalogEntry = {
  subjects: string[];   // ชื่อสมุนไพร หรือ ตำรับยาเฉพาะที่งานวิจัยนี้กล่าวถึง
  symptoms?: string[];  // อาการที่เกี่ยวข้อง (ใช้เฉพาะเมื่อผู้ใช้ถามตามอาการโดยไม่ระบุชื่อสมุนไพร/ตำรับ)
  data: ThaiJoItem;
};

// คลังงานวิจัยไทย (ThaiJO) ที่คัดสรรสำหรับสมุนไพรและตำรับยาไทยยอดนิยม (ตรวจสอบชื่อเรื่อง ผู้นิพนธ์ ปีพิมพ์ และ URL ตรงกับระบบ ThaiJO 100%)
const THAIJO_CATALOG: ThaiJoCatalogEntry[] = [
  {
    subjects: ["ฟ้าทะลายโจร", "andrographis"],
    symptoms: ["หวัด", "เจ็บคอ", "ไอ", "โควิด", "covid"],
    data: {
      title: "งานวิจัยแบบสุ่มและมีกลุ่มเปรียบเทียบผลของฟ้าทะลายโจร กับฟาวิพิราเวียร์ ในการรักษาโควิด-19 ที่มีอาการน้อยหรือไม่มีอาการ",
      authors: "ภูริวัฒนพงศ์ ศ., ชัยยอดศิลป์ ส., บุญสูง ธ., และคณะ",
      year: "2023",
      journal: "วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก",
      url: "https://he01.tci-thaijo.org/index.php/JTTAM/article/view/257226",
    },
  },
  {
    subjects: ["แอนโดรกราโฟไลด์", "andrographolide", "วิเคราะห์ฟ้าทะลายโจร"],
    data: {
      title: "การพัฒนาและตรวจสอบความถูกต้องของวิธีวิเคราะห์ปริมาณ แอนโดรกราโฟไลด์ในผลิตภัณฑ์ฟ้าทะลายโจรโดยเทคนิคโครมาโทกราฟี ชนิดของเหลวประสิทธิภาพสูง",
      authors: "สุขพันธ์ ป.",
      year: "2024",
      journal: "วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก",
      url: "https://he01.tci-thaijo.org/index.php/JTTAM/article/view/267030",
    },
  },
  {
    subjects: ["ขมิ้นชัน", "curcuma"],
    symptoms: ["แผลในกระเพาะ", "กรดไหลย้อน", "ท้องอืด", "จุกเสียด"],
    data: {
      title: "รายงานความปลอดภัยของการใช้ยาสมุนไพรขมิ้นชันในฐานข้อมูล รายงานเหตุการณ์ไม่พึงประสงค์ของประเทศไทย (Thai Vigibase)",
      authors: "พามนตรี พ., สุวรรณเกษาวงษ์ ว., โภคะกุล พ., และคณะ",
      year: "2023",
      journal: "วารสารเภสัชกรรมไทย",
      url: "https://he01.tci-thaijo.org/index.php/TJPP/article/view/256870",
    },
  },
  {
    subjects: ["บัวบก", "ใบบัวบก", "centella"],
    symptoms: ["แผล", "ความจำ", "บำรุงสมอง", "ฟกช้ำ"],
    data: {
      title: "การพัฒนาวิธีวิเคราะห์สารกลุ่มไทรเทอร์พีนส์ในบัวบกด้วยวิธี UPLC",
      authors: "มิ่งเมือง จ., ชื่นนางชี ว., ศักดิ์เพชร อ., และคณะ",
      year: "2020",
      journal: "วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก",
      url: "https://he01.tci-thaijo.org/index.php/JTTAM/article/view/240988",
    },
  },
  // กระชายขาว: ยังไม่พบ URL บทความจริงที่ยืนยันได้ใน ThaiJO — ไม่ใส่ fake URL เพื่อป้องกัน citation ผิด
  {
    subjects: ["ขิง", "zingiber"],
    symptoms: ["คลื่นไส้", "อาเจียน", "เมารถ", "ขับลม", "แน่นท้อง"],
    data: {
      title: "Monograph of Selected Thai Material Medica: KHING (ข้อมูลวิชาการสมุนไพร: ขิง)",
      authors: "คณะอนุกรรมการจัดทำข้อมูลทางวิชาการของสมุนไพร กรมการแพทย์แผนไทยและการแพทย์ทางเลือก",
      year: "2014",
      journal: "วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก",
      url: "https://he01.tci-thaijo.org/index.php/JTTAM/article/view/120228",
    },
  },
  // จันทน์ลีลา: ยังไม่พบ URL บทความจริงที่ยืนยันได้ใน ThaiJO — ไม่ใส่ fake Search URL เพื่อป้องกัน citation ผิด
  // (ข้อมูลสรรพคุณ ขนาดยา ข้อบ่งใช้ยังคงมาจากฐานข้อมูล thai_formulas ใน Supabase)
  {
    subjects: ["ยาหอมนวโกฐ", "หอมนวโกฐ"],
    symptoms: ["วิงเวียน", "หน้ามืด", "เป็นลม", "ลม"],
    data: {
      title: "ฤทธิ์ต้านอนุมูลอิสระและปริมาณฟีนอลิกรวมของตำรับยาแผนไทยบางตำรับ (Antioxidant Activity and Total Phenolic Contents of Some Thai Traditional Formulation)",
      authors: "มหาดเล็ก จ., ตันตรวงศ์ษา ศ., เภชะมัด ธ.",
      year: "2017",
      journal: "วารสารเภสัชศาสตร์อีสาน",
      url: "https://he01.tci-thaijo.org/index.php/IJPS/article/view/88553",
    },
  },
  {
    subjects: ["เบญจกูล", "ยาเบญจกูล"],
    symptoms: ["ปรับธาตุ", "ธาตุพิการ", "บำรุงธาตุ", "ข้อเข่าเสื่อม"],
    data: {
      title: "บทบาทของตำรับยาเบญจกูลในการรักษาโรคข้อเข่าเสื่อม: มุมมองผ่านอิทธิพลของธาตุกำเนิด (The Role of Benjakul in Knee Osteoarthritis Treatment: A Perspective Through the Influence of Body Innate Elements)",
      authors: "ก้องกุม ช., ปิ่นศรศักดิ์ ป., กนกกังสดาล ภ., และคณะ",
      year: "2025",
      journal: "วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก",
      url: "https://he01.tci-thaijo.org/index.php/JTTAM/article/view/277757",
    },
  },
  {
    subjects: ["ประสะไพล", "ยาประสะไพล"],
    symptoms: ["ปวดประจำเดือน", "ประจำเดือนมาผิดปกติ", "ประจำเดือน", "ระดู", "ปวดท้องประจำเดือน", "ขับน้ำคาวปลา"],
    data: {
      title: "ผลเบื้องต้นของยาแคปซูลประสะไพลเพื่อรักษาอาการประจำเดือนมาผิดปกติ (Preliminary Effects of Prasaplai Capsule for Menstruation Disorder Treatment)",
      authors: "สว่างจิตร ร., และคณะ",
      year: "2019",
      journal: "วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก",
      url: "https://he01.tci-thaijo.org/index.php/JTTAM/article/view/186302",
    },
  },
];

// In-Memory Cache สำหรับผลค้นหา PubMed
const pubmedCache = new Map<string, { at: number; data: PubMedItem[] }>();
const PUBMED_CACHE_TTL = 30 * 60 * 1000; // แคชไว้ 30 นาที

/** ค้นหางานวิจัยสากลจาก NCBI PubMed API พร้อม In-Memory Caching */
export async function fetchPubMedClient(query: string): Promise<PubMedItem[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const cached = pubmedCache.get(cleanQ);
  if (cached && Date.now() - cached.at < PUBMED_CACHE_TTL) {
    return cached.data;
  }

  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(
      cleanQ
    )}&retmax=3&retmode=json&sort=relevance`;
    const searchResp = await fetch(searchUrl, { signal: AbortSignal.timeout(2800) });
    if (!searchResp.ok) return [];
    const searchData = await searchResp.json();
    const pmids: string[] = searchData?.esearchresult?.idlist || [];
    if (pmids.length === 0) return [];

    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(
      ","
    )}&retmode=json`;
    const summaryResp = await fetch(summaryUrl, { signal: AbortSignal.timeout(2800) });
    if (!summaryResp.ok) return [];
    const summaryData = await summaryResp.json();

    const results: PubMedItem[] = [];
    for (const pmid of pmids) {
      const item = summaryData?.result?.[pmid];
      if (!item) continue;
      const authors =
        (item.authors || [])
          .slice(0, 3)
          .map((a: any) => a.name)
          .join(", ") + ((item.authors?.length || 0) > 3 ? ", et al." : "");
      const year = (item.pubdate || "").split(" ")[0] || "";
      results.push({
        pmid,
        title: item.title || "",
        authors: authors || "Unknown",
        year,
        journal: item.fulljournalname || item.source || "",
      });
    }

    pubmedCache.set(cleanQ, { at: Date.now(), data: results });
    return results;
  } catch (e) {
    console.warn("Client PubMed search skipped or timed out:", e);
    return [];
  }
}

/** ค้นหางานวิจัยไทยจาก ThaiJO Catalog โดยจับคู่ตรงประเด็นและป้องกันการอ้างอิงข้ามสมุนไพร */
export function findRelevantThaiJo(
  question: string,
  matchedHerbs: any[] = [],
  matchedFormulas: any[] = []
): ThaiJoItem[] {
  const q = question.toLowerCase();
  const nq = normalizeThaiName(question);
  const results: ThaiJoItem[] = [];
  const seen = new Set<string>();

  // 1. ตรวจสอบว่าผู้ใช้เอ่ยถึงชื่อตำรับยาใดโดยเฉพาะหรือไม่
  const mentionedFormulas = matchedFormulas.filter((f) => {
    if (!f.name_thai) return false;
    if (q.includes(f.name_thai.toLowerCase())) return true;
    const nn = normalizeThaiName(f.name_thai);
    return nn.length >= 3 && nq.includes(nn);
  });

  // 2. ตรวจสอบว่าผู้ใช้เอ่ยถึงชื่อสมุนไพรเดี่ยวใดโดยเฉพาะหรือไม่
  const mentionedHerbs = matchedHerbs.filter((h) => {
    if (!h.name_thai && !h.name_english) return false;
    if (h.name_thai && q.includes(h.name_thai.toLowerCase())) return true;
    if (h.name_english && q.includes(h.name_english.toLowerCase())) return true;
    const nn = normalizeThaiName(h.name_thai || "");
    return nn.length >= 3 && nq.includes(nn);
  });

  // ก) ถ้าคำถามเจาะจงที่ตำรับยา (เช่น ยาจันทน์ลีลา) -> ค้นเฉพาะงานวิจัยของตำรับยานั้นเท่านั้น ห้ามเอางานวิจัยสมุนไพรอื่นมาปน!
  if (mentionedFormulas.length > 0) {
    for (const f of mentionedFormulas) {
      const fn = normalizeThaiName(f.name_thai);
      for (const item of THAIJO_CATALOG) {
        const isMatch = item.subjects.some((s) => {
          const sn = normalizeThaiName(s);
          return fn.includes(sn) || sn.includes(fn);
        });
        if (isMatch && !seen.has(item.data.url)) {
          seen.add(item.data.url);
          results.push(item.data);
        }
      }
    }
    return results;
  }

  // ข) ถ้าคำถามเจาะจงที่สมุนไพรเดี่ยว (เช่น ฟ้าทะลายโจร หรือ ขมิ้นชัน) -> ค้นเฉพาะงานวิจัยของสมุนไพรนั้นเท่านั้น!
  if (mentionedHerbs.length > 0) {
    for (const h of mentionedHerbs) {
      const hn = (h.name_thai || "").toLowerCase();
      const nhn = normalizeThaiName(h.name_thai || "");
      for (const item of THAIJO_CATALOG) {
        const isMatch = item.subjects.some((s) => {
          const sn = normalizeThaiName(s);
          // Strict one-directional: subject ต้องตรงกับ herb name เป๊ะๆ หรือ subject ต้องครอบคลุม herb name
          // ป้องกัน: "กระชาย" ไม่ match catalog entry ที่ subject = "กระชายขาว"
          // (เดิมใช้ bidirectional ทำให้ "กระชาย".includes("กระชายขาว") false แต่ "กระชายขาว".includes("กระชาย") true → ผิด)
          return sn === nhn || sn.includes(nhn) || s.toLowerCase() === hn || s.toLowerCase().endsWith(hn);
        });
        if (isMatch && !seen.has(item.data.url)) {
          seen.add(item.data.url);
          results.push(item.data);
        }
      }
    }
    return results;
  }

  // ค) กรณีคำถามถามถึง "อาการ" โดยไม่ได้เอ่ยชื่อสมุนไพรหรือตำรับเฉพาะเจาะจง (เช่น "นอนไม่หลับ", "เป็นหวัด")
  for (const item of THAIJO_CATALOG) {
    const isMatch = item.symptoms?.some((s) => q.includes(s.toLowerCase()));
    if (isMatch && !seen.has(item.data.url)) {
      seen.add(item.data.url);
      results.push(item.data);
      if (results.length >= 2) break;
    }
  }

  return results;
}

// ข้อความปฏิเสธมาตรฐานที่สุภาพ เมื่อได้รับคำถามที่ไม่เกี่ยวข้องกับการแพทย์แผนไทย การแพทย์แผนปัจจุบัน หรือการดูแลสุขภาพ
export const OUT_OF_SCOPE_REFUSAL_MESSAGE = `ขออภัยด้วยครับ ผมคือ **หมอยาพิษณุโลก** ผู้ช่วยให้คำปรึกษาเฉพาะทางด้าน **การแพทย์แผนไทย การแพทย์แผนปัจจุบัน สมุนไพรไทย และอันตรกิริยาระหว่างยา (Drug-Herb Interaction)** ประจำกลุ่มงานการแพทย์แผนไทยและสมุนไพร สำนักงานสาธารณสุขจังหวัดพิษณุโลก

เนื่องจากคำถามของท่านไม่ได้เกี่ยวข้องกับทางด้านการแพทย์แผนไทย การแพทย์แผนปัจจุบัน หรือการดูแลสุขภาพ จึงอยู่นอกเหนือขอบเขตที่ผมสามารถให้ข้อมูลได้ครับ 🙏

ท่านสามารถสอบถามหรือปรึกษาข้อมูลด้านสุขภาพและสมุนไพรได้ดังนี้ครับ:
🌿 **สมุนไพรและตำรับยาแผนไทย:** สรรพคุณ วิธีใช้ ขนาดยา และข้อควรระวัง
💊 **ยาแผนปัจจุบันและอันตรกิริยา:** การใช้ยาสมุนไพรร่วมกับยาแผนปัจจุบัน (Drug-Herb Interaction)
🩺 **การดูแลสุขภาพเบื้องต้น:** การดูแลตนเองตามแนวทาง 10 กลุ่มอาการของกระทรวงสาธารณสุข`;

/** ตรวจสอบคำถามที่อยู่นอกขอบเขตการแพทย์และสุขภาพอย่างชัดเจน (เช่น โค้ดดิ้ง, การเมือง, กีฬา, สภาพอากาศ, ดูดวง ฯลฯ) */
export function isBlatantlyOutOfScope(
  question: string,
  history: { role: string; content: string }[] = []
): boolean {
  const q = (question || "").trim().toLowerCase();
  if (!q) return false;

  // 1. คำค้นที่ไม่เกี่ยวกับการแพทย์อย่างชัดเจน
  const nonMedicalPattern =
    /(?:เขียน(?:โปรแกรม|โค้ด)|โค้ดดิ้ง|programming|coding|javascript|typescript|python|java\b|c\+\+|html|css|sql|docker|react|vue|angular|node\.js|ฟังก์ชัน|อัลกอริทึม|แก้บั๊ก|บักในโค้ด|พยากรณ์อากาศ|สภาพอากาศ|ฝนตกไหม|วันนี้ฝนตก|อุณหภูมิวันนี้|กี่องศา|ผลบอล|ตารางบอล|พรีเมียร์ลีก|ลิเวอร์พูล|แมนยู|อาร์เซนอล|เชลซี|ตารางแข่ง|บอลเมื่อคืน|การเมือง|เลือกตั้งนายก|พรรคการเมือง|ยุบสภา|นายกรัฐมนตรีคนใหม่|อภิปรายไม่ไว้วางใจ|ดูดวง|ทำนายดวง|ไพ่ยิปซี|ราศีเกิด|เลขเด็ด|ตรวจหวย|หวยงวดนี้|ผลสลาก|แต่งกลอน|แต่งเพลง|เล่าเรื่องตลก|คุยเล่นแก้เหงา|แปลภาษาอังกฤษเป็นไทย|แปลประโยคนี้)/i;

  if (!nonMedicalPattern.test(q)) {
    return false;
  }

  // 2. ข้อยกเว้น: หากมีคำทางการแพทย์/สมุนไพร/ยา/อาการ ให้ถือว่าอยู่ในขอบเขต
  const medicalWhitelist =
    /(?:สมุนไพร|ตำรับ(?:ยา)?|ขนาดยา|วิธีใช้|ขนาดใช้|กินยังไง|ทานยังไง|ผลข้างเคียง|แพ้ยา|อันตรกิริยา|สรรพคุณ|สารสกัด|การรักษา|รักษา|บรรเทา|กินยา|ทานยา|ใช้ยา|ตัวยา|ดื้อยา|ยาแผน|ยาสามัญ|ยาเม็ด|ยาน้ำ|ยาแคปซูล|ยาแก้|ยาลด|ยาบำรุง|ยาต้ม|ยาผง|ยาดม|ยาทา|หยอดตา|(?:^|[^\u0E00-\u0E7F])ยา(?=[^\u0E00-\u0E7F\s]|แผน|สมุนไพร|เม็ด|แคปซูล|แก้|ลด|บำรุง|หยอด|ทา|รักษา|กิน|ทาน|ใช้|สระ|ดม|\s|$)|แพทย์|เภสัช|พยาบาล|โรงพยาบาล|คลินิก|ผู้ป่วย|คนไข้|อาการ|เจ็บป่วย|ติดเชื้อ|อักเสบ|ความดัน|เบาหวาน|คอเลสเตอรอล|ไขมันในเลือด|โรคตับ|โรคไต|โรคหัวใจ|มะเร็ง|นอนไม่หลับ|ไมเกรน|ปวด|มีไข้|ตัวร้อน|ลดไข้|แก้ไข้|ไอ|เจ็บคอ|หวัด|คัดจมูก|น้ำมูก|ท้องเสีย|ท้องผูก|ท้องอืด|ท้องเฟ้อ|จุกเสียด|แน่นท้อง|คลื่นไส้|อาเจียน|ผื่น|คัน|แผล|น้ำตาลในเลือด|ข้อเข่า|กล้ามเนื้อ|เฮิร์บ|herb|drug|medicine)/i;

  if (medicalWhitelist.test(q)) {
    return false;
  }

  // 3. ข้อยกเว้น: หากในประวัติ 2 ข้อความล่าสุด มีการพูดถึงเรื่องยาหรือสมุนไพร
  const recentHistory = history.slice(-2).map((m) => m.content).join(" ");
  if (medicalWhitelist.test(recentHistory)) {
    return false;
  }

  return true;
}

const SYSTEM_PROMPT = `คุณคือ "หมอยาพิษณุโลก" ผู้เชี่ยวชาญด้านเภสัชกรรมไทยและอันตรกิริยาระหว่างยากับสมุนไพร (Drug-Herb Interaction) ประจำกลุ่มงานการแพทย์แผนไทยและสมุนไพร สำนักงานสาธารณสุขจังหวัดพิษณุโลก

## กฎสำคัญที่สุด — ขอบเขตการตอบคำถาม:
1. **อยู่ในขอบเขต — ตอบได้อย่างละเอียด ชัดเจน และมีหลักฐานอ้างอิง:**
   - การแพทย์แผนไทย สมุนไพรไทย ตำรับยาแผนไทย บัญชียาหลักแห่งชาติด้านสมุนไพร
   - การแพทย์แผนปัจจุบัน ยาแผนปัจจุบันทุกชนิด และผลข้างเคียง
   - อันตรกิริยาระหว่างยากับสมุนไพร (Drug-Herb Interaction) และอันตรกิริยาระหว่างยา (Drug-Drug Interaction)
   - อาการเจ็บป่วย การดูแลสุขภาพเบื้องต้น (เช่น 10 กลุ่มอาการ สธ.) ขนาดยา วิธีใช้ ข้อห้าม ข้อควรระวัง
   - คำถามต่อเนื่องในบทสนทนาที่เกี่ยวกับสุขภาพ/ยา/สมุนไพร

2. **อยู่นอกขอบเขต — ห้ามตอบคำถามเด็ดขาด:**
   - หากคำถามไม่เกี่ยวข้องกับการแพทย์แผนไทย การแพทย์แผนปัจจุบัน หรือการดูแลสุขภาพ (เช่น เขียนโปรแกรม/โค้ดดิ้ง, การเมือง, กีฬา, พยากรณ์อากาศ, ดูดวง/หวย, แปลภาษาทั่วไป, บันเทิง/เพลง, ช่าง/เทคนิคทั่วไปที่ไม่เกี่ยวกับการแพทย์, เรื่องส่วนตัวของ AI ฯลฯ)
   - **ห้ามตอบคำถามหรือให้ข้อมูลของคำถามนั้นแม้แต่น้อย**
   - **ต้องตอบปฏิเสธด้วยข้อความสุภาพมาตรฐานด้านล่างนี้เท่านั้น**:
${OUT_OF_SCOPE_REFUSAL_MESSAGE}

   - ในกรณีปฏิเสธนี้ **ห้ามใส่หัวข้อ "📚 เอกสารอ้างอิง (APA 7th Edition)" ใดๆ ทั้งสิ้น**
   - ใส่แท็กโครงสร้างข้อมูล:
[METADATA]
category: general
severity: none
herbs:
drugs:
[/METADATA]

แนวทางการตอบสำหรับคำถามที่อยู่ในขอบเขต:
1. **ตอบตรงประเด็นและกระชับเป็นอันดับแรก (Concise & Directly Answering — สำคัญที่สุด):**
   - วิเคราะห์เจตนาของคำถาม และตอบประเด็นที่ถามเป็นหลักอย่างชัดเจน รวดเร็ว ไม่เกริ่นนำยืดยาว และไม่พูดซ้ำซ้อน
   - **กรณีผู้ใช้ถามเจาะจงเฉพาะเรื่องใดเรื่องหนึ่ง** (เช่น ถามเฉพาะ "ข้อบ่งใช้อะไรบ้าง", หรือ "กินขนาดเท่าไร", หรือ "คนท้องกินได้ไหม", หรือ "มีผลข้างเคียงอะไร"):
     -> ให้ตอบคำตอบของประเด็นนั้นให้ตรงเป้าหมายทันที
     -> **ห้าม** ยกเทมเพลตข้อมูลอื่นที่ไม่เกี่ยวข้องมาตอบทั้งหมด (เช่น ถ้าถามแค่ข้อบ่งใช้ ไม่ต้องแถมขนาดยาเต็มสูตร หรือตารางอันตรกิริยายาวๆ เข้ามา เว้นแต่มีข้อควรระวังสำคัญต่อชีวิตที่ต้องเตือนสั้นๆ 1-2 บรรทัด)
   - **กรณีผู้ใช้ถามภาพรวมของสมุนไพร/ตำรับยา** (เช่น "ขอข้อมูลฟ้าทะลายโจร", "ยาประสะไพลคืออะไร มีสรรพคุณและวิธีใช้อย่างไร"):
     -> จึงสรุปข้อมูลครบถ้วน: สรรพคุณ, ขนาดและวิธีใช้, ข้อห้าม/ข้อควรระวังสำคัญ อย่างเป็นสัดส่วน กระชับ อ่านเข้าใจง่าย

2. **การแสดงตารางอันตรกิริยากับยาแผนปัจจุบัน (Drug-Herb Interaction Table):**
   - **ให้แสดงตาราง Markdown อันตรกิริยา เฉพาะเมื่อ:**
     ก) คำถามถามถึงการใช้ยาร่วมกัน / ยาตีกัน / อันตรกิริยาระหว่างยา / ผลต่อยาแผนปัจจุบัน (DDI / HDI) โดยตรง
     ข) หรือผู้ใช้ระบุชื่อสมุนไพบคู่กับชื่อยาแผนปัจจุบันในคำถาม (เช่น "กินขมิ้นชันกับ warfarin ได้ไหม")
   - หากผู้ใช้ถามเรื่องทั่วไป (เช่น ถามขนาดยา, สรรพคุณ, หรือวิธีรับประทาน) **ห้าม** แสดงตารางอันตรกิริยาขนาดใหญ่เข้ามาโดยไม่จำเป็น หากมีข้อควรระวังเรื่องยาอื่น ให้ระบุสั้นๆ 1 บรรทัดในหัวข้อข้อควรระวังก็เพียงพอ
   - เมื่อแสดงตาราง ให้มีโครงสร้างคอลัมน์มาตรฐาน:
     | สมุนไพร / ตำรับยา | ยาแผนปัจจุบัน | ระดับความรุนแรง | กลไก / ผลกระทบที่อาจเกิดขึ้น | คำแนะนำทางคลินิก |
     (🔴 รุนแรงมาก / 🟡 ปานกลาง / 🟢 เล็กน้อย)

3. **ความกระชับและการจัดรูปแบบ (Formatting & Brevity):**
   - ใช้ bullet points หรือตัวหนาเน้นคำสำคัญ เพื่อให้อ่านเข้าใจง่าย
   - ข้อความเตือนความปลอดภัยท้ายคำตอบ ให้ใส่สั้นกระชับ 1 บรรทัด: "💡 ข้อแนะนำ: ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้ โดยเฉพาะหญิงตั้งครรภ์ ให้นมบุตร หรือผู้มีโรคประจำตัว"

4. **การแสดงเอกสารอ้างอิงตามแบบ APA 7th Edition (สำคัญที่สุด):**
   ก่อนจบคำตอบ ให้เขียนหัวข้อ "### 📚 เอกสารอ้างอิง (APA 7th Edition)" แล้วระบุรายการอ้างอิงตามรูปแบบมาตรฐาน APA 7 เฉพาะรายการเอกสารต้นทางหรือวิจัยที่เกี่ยวข้องโดยตรงกับคำถามและนำมาใช้ตอบจริง:
    - **ข้อกำหนดเรื่องฐานข้อมูลภายใน (สำคัญมาก):** ให้ยังคงใช้ข้อมูลสรรพคุณ ขนาด วิธีใช้ และข้อควรระวังจากฐานข้อมูลยาภายในตามปกติ แต่ **ไม่ต้องแสดงรายการอ้างอิง "สำนักงานสาธารณสุขจังหวัดพิษณุโลก" ในหัวข้อเอกสารอ้างอิง** (ให้ซ่อนรายการอ้างอิงของ สสจ.พิษณุโลก ไว้)
    - กรณีอ้างอิงบัญชียาหลักแห่งชาติด้านสมุนไพร (ให้อ้างอิงปี พ.ศ. ตามรายการยาที่ระบุใน CONTEXT หรือเอกสารกำกับยา):
      - สำหรับรายการยาที่ได้รับการปรับปรุง/เพิ่มเติมในฉบับล่าสุด (พ.ศ. 2568 เช่น ยาฟ้าทะลายโจร, ยาขมิ้นชันที่มีข้อบ่งใช้ Functional dyspepsia, ยาบำรุงน้ำนม, ยาศุขไสยาสน์, ยาประสะกัญชา, ยาไพลสูตร 2, ยาพริก 0.075, ยาทาพระเส้น, ยาตรีผลาแก้ท้องผูก ฯลฯ):
        คณะกรรมการพัฒนาระบบยาแห่งชาติ. (2568). *ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (ฉบับที่ 2) พ.ศ. 2568*. ราชกิจจานุเบกษา.
      - สำหรับรายการยาในบัญชียาหลักเดิม (พ.ศ. 2566):
        คณะกรรมการพัฒนาระบบยาแห่งชาติ. (2566). *ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร พ.ศ. 2566*. ราชกิจจานุเบกษา.
    - กรณีอ้างอิง 10 กลุ่มอาการ สธ.:
      กรมการแพทย์แผนไทยและการแพทย์ทางเลือก. (2567). *คู่มือการใช้ยาสมุนไพรในการดูแลสุขภาพเบื้องต้น 10 กลุ่มอาการ*. กระทรวงสาธารณสุข.
    - กรณีอ้างอิงฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน ม.มหิดล (อ้างอิงเฉพาะคู่สมุนไพรและยาที่ผู้ใช้ถามเท่านั้น):
      ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ มหาวิทยาลัยมหิดล. (ม.ป.ป.). *ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน: [ชื่อสมุนไพร] กับ [ชื่อยา]*. URL
    - กรณีอ้างอิงงานวิจัยสากล PubMed (เฉพาะที่ตรงกับคำถามและใช้ตอบจริง):
      Author, A. A. (Year). Title. *Journal*. https://pubmed.ncbi.nlm.nih.gov/PMID/
    - กรณีอ้างอิงงานวิจัยไทย ThaiJO (เฉพาะที่ตรงกับคำถามและใช้ตอบจริง):
      Author. (Year/ม.ป.ป.). Title. *Journal*. URL
5. **กฎเหล็ก: ห้ามสร้างหรือแต่งแหล่งอ้างอิงงานวิจัยหรือ URL เอง (No Hallucination — สำคัญที่สุด):**
   - อ้างอิงได้เฉพาะแหล่งข้อมูลที่มีอยู่ใน <CONTEXT> ที่ระบบให้มาเท่านั้น
   - **ห้ามใส่ URL ภายนอก ลิงก์เว็บไซต์ อย. หรือ PMID ที่ไม่ได้อยู่ใน CONTEXT เด็ดขาด** หากอ้างอิงประกาศกระทรวงหรือ อย. ให้ระบุเฉพาะชื่อประกาศและปี พ.ศ. โดยไม่ต้องใส่ URL จำลอง
   - ห้ามสร้างชื่อผู้แต่ง ชื่อวารสาร หรือชื่อบทความขึ้นเอง
   - หากไม่มีแหล่งอ้างอิงงานวิจัยหรือประกาศกระทรวงใน CONTEXT ให้อ้างอิง "คู่มือกรมการแพทย์แผนไทยฯ" (ไม่ต้องใส่รายการอ้างอิง สสจ.พิษณุโลก)
6. **ความถูกต้องตรงประเด็นของเอกสารอ้างอิง (Strict Relevance & No Unrelated Herbs - สำคัญมากที่สุด):**
   - **กฎเหล็กเด็ดขาด:** ห้ามนำสมุนไพรหรือยาอื่นที่ผู้ใช้ไม่ได้ถามมาเขียนลงในคำตอบหรือในรายการอ้างอิงเด็ดขาด! ตัวอย่างเช่น หากผู้ใช้ถามเรื่อง "ขมิ้นชัน กับ Warfarin" ให้ตอบและอ้างอิงเฉพาะข้อมูลของ "ขมิ้น/ขมิ้นชัน กับ Warfarin" เท่านั้น ห้ามนำสมุนไพรอื่น (เช่น กระชายดำ กระเทียม กล้วย โกจิเบอร์รี ขิง มะม่วง ฯลฯ) มากล่าวถึงหรือใส่ในรายการอ้างอิงเป็นอันขาด
   - ให้อ้างอิงเฉพาะข้อมูลที่ตรงกับสิ่งที่ถามและใช้ตอบจริงเท่านั้น ข้อมูลใดใน CONTEXT ที่ไม่ตรงกับสิ่งที่ผู้ใช้ระบุในคำถาม ห้ามนำมาเขียนในคำตอบหรือหัวข้อเอกสารอ้างอิงเด็ดขาด
7. ท้ายคำตอบ ต้องลงท้ายด้วยแท็กโครงสร้างข้อมูล:
[METADATA]
category: <herbal_info | drug_interaction | dosage | side_effects | general>
severity: <major | moderate | minor | none>
herbs: <ชื่อสมุนไพรที่พบ คั่นด้วย comma>
drugs: <ชื่อยาแผนปัจจุบันที่พบ คั่นด้วย comma>
[/METADATA]`;

export function getAvailableLocalProviders(): ProviderItem[] {
  const all = getLocalProviders();
  return all
    .filter((p) => p.is_active && !!p.api_key && p.api_key.trim() !== "" && p.api_key !== "__CLEAR__")
    .sort((a, b) => a.priority - b.priority);
}

export function hasLocalProviderKey(): boolean {
  return getAvailableLocalProviders().length > 0;
}

export async function processLocalChat(
  question: string,
  history: { role: string; content: string }[],
  onChunk?: (text: string) => void,
  settings?: KnowledgeSettings
): Promise<string> {
  const currentSettings = settings || getKnowledgeSettings();
  const enableExternal = currentSettings.enable_external_research !== false;
  const enableInternal = currentSettings.enable_internal_db !== false;
  const enableMahidol = currentSettings.enable_mahidol_ddi !== false;

  // 0. ตรวจจับคำถามที่อยู่นอกขอบเขตชัดเจน (Fast short-circuit ตอบปฏิเสธทันที ไม่ต้องต่อ API)
  if (isBlatantlyOutOfScope(question, history)) {
    const refusalText = `${OUT_OF_SCOPE_REFUSAL_MESSAGE}\n\n[METADATA]\ncategory: general\nseverity: none\nherbs:\ndrugs:\n[/METADATA]\n\n[SOURCES]{"internal":[],"pubmed":[],"thaijo":[],"knowledge":[]}[/SOURCES]`;
    if (onChunk) {
      onChunk(OUT_OF_SCOPE_REFUSAL_MESSAGE);
      onChunk(refusalText);
    }
    return refusalText;
  }

  const availableProviders = getAvailableLocalProviders();
  if (availableProviders.length === 0) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า API Key ในหน้าระบบ — กรุณาไปที่หน้า 'ตั้งค่า AI' (/admin/ai-settings) แล้วใส่ Google Gemini หรือ DeepSeek API Key ก่อนใช้งานครับ"
    );
  }

  const q = question.toLowerCase();

  // สร้างคำค้น PubMed อัตโนมัติจากชื่อสมุนไพรและยา (เฉพาะเมื่อเปิดใช้งานแหล่งข้อมูลวิจัยภายนอก)
  let pubmedQuery = "";
  if (enableExternal) {
    for (const [thai, sci] of Object.entries(HERB_THAI_TO_SCI)) {
      if (q.includes(thai.toLowerCase())) {
        pubmedQuery = `"${sci}"`;
        break;
      }
    }
    for (const [thai, en] of Object.entries(DRUG_THAI_TO_EN)) {
      if (q.includes(thai.toLowerCase())) {
        pubmedQuery = pubmedQuery ? `(${pubmedQuery}) AND (${en})` : `(${en})`;
        break;
      }
    }
  }

  // 1. ดึงสมุนไพร/ตำรับยาจาก Supabase (ถ้าเปิดฐานข้อมูลภายใน), ข้อมูล DDI ม.มหิดล, พร้อมกับค้น PubMed แบบขนาน
  const [
    herbsRes,
    formulasRes,
    knowledgeRes,
    mahidolDdiRes,
    pubmedResults,
  ] = await Promise.all([
    enableInternal
      ? supabase
          .from("herbs")
          .select("id, name_thai, name_english, name_scientific, properties, dosage, usage_instructions, precautions, contraindications, drug_interactions")
          .limit(300)
      : Promise.resolve({ data: [] }),
    enableInternal
      ? supabase
          .from("thai_formulas")
          .select("id, name_thai, name_english, indication, ingredients, dosage, usage_instructions, precautions, contraindications, drug_interactions")
          .limit(300)
      : Promise.resolve({ data: [] }),
    enableInternal
      ? supabase
          .from("knowledge_documents")
          .select("id, title, category, content, source, source_url")
          .neq("category", "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)")
          .limit(200)
      : Promise.resolve({ data: [] }),
    enableMahidol
      ? supabase
          .from("knowledge_documents")
          .select("id, title, category, content, source, source_url")
          .eq("category", "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)")
          .limit(1000)
      : Promise.resolve({ data: [] }),
    enableExternal && pubmedQuery ? fetchPubMedClient(pubmedQuery) : Promise.resolve([] as PubMedItem[]),
  ]);

  const allHerbs = (herbsRes.data || []) as any[];
  const allFormulas = (formulasRes.data || []) as any[];
  const allKnowledge = (knowledgeRes.data || []) as any[];
  const allMahidolDdi = (mahidolDdiRes.data || []) as any[];

  // 2. ค้นหาสมุนไพรและตำรับที่เกี่ยวข้องกับคำถาม
  const nq = normalizeThaiName(question);

  // 2.0 ค้นหาจากฐานข้อมูล 97 รายการ (ไฟล์ 97 herb.xlsx) โดยเน้นชื่อยาใน Column A ทั้งตรงและใกล้เคียง
  const matched97Herbs = searchHerbs97ByName(question);

  // 2.1 ตรวจหาชื่อตำรับยาที่ผู้ใช้เอ่ยถึงโดยตรงในคำถาม
  const exactMatchedFormulas = allFormulas.filter((f) => {
    if (!f.name_thai) return false;
    if (q.includes(f.name_thai.toLowerCase())) return true;
    const nn = normalizeThaiName(f.name_thai);
    return nn.length >= 3 && nq.includes(nn);
  });

  // 2.2 ตรวจหาชื่อสมุนไพรเดี่ยวที่ผู้ใช้เอ่ยถึงโดยตรงในคำถาม
  const exactMatchedHerbs = allHerbs.filter((h) => {
    if (!h.name_thai && !h.name_english) return false;
    if (h.name_thai && q.includes(h.name_thai.toLowerCase())) return true;
    if (h.name_english && q.includes(h.name_english.toLowerCase())) return true;
    const nn = normalizeThaiName(h.name_thai || "");
    return nn.length >= 3 && nq.includes(nn);
  });

  let matchedHerbs: any[] = [];
  let matchedFormulas: any[] = [];

  // ก) ถ้าผู้ใช้เอ่ยชื่อตำรับยาชัดเจน (เช่น "ยาจันทน์ลีลาใช้ลดไข้ได้ไหม")
  if (exactMatchedFormulas.length > 0) {
    matchedFormulas = exactMatchedFormulas.slice(0, 4);
    // จะใส่สมุนไพรเดี่ยวเข้ามาด้วยเฉพาะกรณีที่ผู้ใช้เอ่ยชื่อสมุนไพรนั้นในคำถามด้วยเท่านั้น (เช่น "กินยาจันทน์ลีลากับฟ้าทะลายโจรได้ไหม")
    matchedHerbs = exactMatchedHerbs.slice(0, 4);
  }
  // ข) ถ้าผู้ใช้เอ่ยชื่อสมุนไพรเดี่ยวชัดเจน (เช่น "ขมิ้นชันกินร่วมกับ warfarin ได้ไหม")
  else if (exactMatchedHerbs.length > 0) {
    matchedHerbs = exactMatchedHerbs.slice(0, 4);
    // ค้นเฉพาะตำรับยาที่สัมพันธ์กับสมุนไพรตัวนี้โดยตรง (ชื่อตำรับมีชื่อสมุนไพร หรือมีสมุนไพรนี้ในส่วนประกอบ)
    // ห้ามดึงตำรับยาแปลกปลอมตามอาการเด็ดขาด!
    matchedFormulas = allFormulas.filter((f) => {
      const fn = (f.name_thai || "").toLowerCase();
      const nfn = normalizeThaiName(f.name_thai || "");
      const ingText = (f.ingredients || []).join(" ").toLowerCase();
      return exactMatchedHerbs.some((h) => {
        const hn = (h.name_thai || "").toLowerCase();
        const nhn = normalizeThaiName(h.name_thai || "");
        return (
          fn.includes(hn) ||
          nfn.includes(nhn) ||
          (ingText && ingText.includes(hn))
        );
      });
    }).slice(0, 3);
  }
  // ค) ถ้าผู้ใช้ไม่ได้เอ่ยชื่อสมุนไพรหรือตำรับเลย (ถามตามอาการ เช่น "นอนไม่หลับ", "ท้องอืด จุกเสียด")
  else {
    const matchedSymptoms: string[] = [];
    for (const s of SYMPTOM_MAP) {
      if (s.match.test(q)) {
        matchedSymptoms.push(...s.terms);
      }
    }

    matchedFormulas = allFormulas.filter((f) => {
      const text = `${f.indication || ""} ${f.name_thai || ""}`.toLowerCase();
      return (
        (f.indication && q.includes(f.indication.toLowerCase())) ||
        matchedSymptoms.some((s) => text.includes(s.toLowerCase()))
      );
    }).slice(0, 4);

    matchedHerbs = allHerbs.filter((h) => {
      const text = `${(h.properties || []).join(" ")} ${h.name_thai || ""}`.toLowerCase();
      return (
        (h.properties && h.properties.some((p) => p.length >= 3 && q.includes(p.toLowerCase()))) ||
        matchedSymptoms.some((s) => text.includes(s.toLowerCase()))
      );
    }).slice(0, 4);
  }

  // ค้นหางานวิจัยไทย ThaiJO ที่ตรงกับคำถามอย่างแม่นยำ (เฉพาะเมื่อเปิดใช้งานแหล่งวิจัยภายนอก)
  const thaijoResults = enableExternal
    ? findRelevantThaiJo(question, matchedHerbs, matchedFormulas)
    : [];

  // 3. สร้าง Context ที่รวบรวมทั้งข้อมูลภายในและงานวิจัยภายนอก (ตามการตั้งค่าเปิด-ปิด)
  let contextText = "";

  if (enableInternal) {
    contextText += "ข้อมูลอ้างอิงจากฐานข้อมูลสมุนไพรและตำรับยา สสจ.พิษณุโลก:\n";

    // แทรกข้อมูลจาก 97 herb.xlsx ที่จับคู่ได้จากชื่อยาใน Column A
    if (matched97Herbs.length > 0) {
      contextText += formatHerb97ForAiContext(matched97Herbs);
    }
    if (matchedHerbs.length > 0) {
      contextText += "\n[สมุนไพรที่เกี่ยวข้อง]\n";
      matchedHerbs.forEach((h) => {
        contextText += `- ${h.name_thai} (${h.name_scientific || h.name_english || ""}): สรรพคุณ: ${(h.properties || []).join(", ")}, ขนาดใช้: ${h.dosage || "ตามคำแนะนำ"}, ข้อควรระวัง: ${(h.precautions || []).join(", ")}, ปฏิกิริยากับยา: ${(h.drug_interactions || []).join(", ")}\n`;
      });
    }

    if (matchedFormulas.length > 0) {
      contextText += "\n[ตำรับยาแผนไทยที่เกี่ยวข้อง]\n";
      matchedFormulas.forEach((f) => {
        contextText += `- ${f.name_thai}: ข้อบ่งใช้: ${f.indication || ""}, วิธีใช้: ${f.usage_instructions || ""}, ข้อห้าม: ${(f.contraindications || []).join(", ")}, ปฏิกิริยากับยา: ${(f.drug_interactions || []).join(", ")}\n`;
      });
    }

    if (allKnowledge.length > 0 && matchedHerbs.length === 0 && matchedFormulas.length === 0) {
      contextText += "\n[แนวทาง 10 กลุ่มอาการของกระทรวงสาธารณสุข]\n";
      allKnowledge.slice(0, 2).forEach((k) => {
        contextText += `หัวข้อ: ${k.title}\nเนื้อหา: ${k.content.length > 1500 ? k.content.slice(0, 1500) + "…(ตัดเนื้อหาบางส่วน)" : k.content}\n`;
      });
    } else if (allKnowledge.length > 0) {
      // แสดง knowledge ที่เกี่ยวข้องด้วยแม้จะมี herb match แล้ว (เนื้อหาเพิ่มเติม)
      const relatedKnowledge = allKnowledge.filter((k) => {
        const qt = question.toLowerCase();
        return (k.title || "").toLowerCase().split(/\s+/).some((w: string) => w.length >= 3 && qt.includes(w));
      });
      if (relatedKnowledge.length > 0) {
        contextText += "\n[เอกสารประกอบจากคลังความรู้]\n";
        relatedKnowledge.slice(0, 2).forEach((k) => {
          contextText += `หัวข้อ: ${k.title}\nเนื้อหา: ${k.content.length > 1500 ? k.content.slice(0, 1500) + "…(ตัดเนื้อหาบางส่วน)" : k.content}\n`;
        });
      }
    }
  }

  // 3.3 แทรกข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน (ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ ม.มหิดล)
  let matchedMahidol: any[] = [];
  if (enableMahidol && allMahidolDdi.length > 0) {
    matchedMahidol = findRelevantMahidolDdi(
      question,
      allMahidolDdi,
      [...exactMatchedHerbs, ...matchedHerbs]
    );

    if (matchedMahidol.length > 0) {
      contextText += "\n[ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน — ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ มหาวิทยาลัยมหิดล]\n";
      matchedMahidol.forEach((m) => {
        contextText += `หัวข้อ: ${m.title}\n${m.content}\nลิงก์อ้างอิง: ${m.source_url}\n\n`;
      });
    }
  }

  if (enableExternal) {
    // ใส่งานวิจัยสากลจาก PubMed เข้า Context
    if (pubmedResults.length > 0) {
      contextText += "\n[งานวิจัยระดับสากลจาก PubMed ที่เกี่ยวข้อง]\n";
      pubmedResults.forEach((p) => {
        contextText += `- PMID: ${p.pmid} | เรื่อง: ${p.title} | วารสาร: ${p.journal} (${p.year}) | ผู้แต่ง: ${p.authors}\n`;
      });
    }

    // ใส่งานวิจัยไทยจาก ThaiJO เข้า Context
    if (thaijoResults.length > 0) {
      contextText += "\n[งานวิจัยไทยที่เกี่ยวข้องจาก ThaiJO]\n";
      thaijoResults.forEach((t) => {
        contextText += `- เรื่อง: ${t.title} | วารสาร: ${t.journal} | ผู้แต่ง: ${t.authors} | ลิงก์: ${t.url}\n`;
      });
    }
  }

  // 3.5 ตรวจสอบข้อมูลที่ผ่านการตรวจทานและรับรองความถูกต้องแล้ว (Verified Clinical Knowledge)
  const verifiedMatch = findVerifiedAnswer(question);
  if (verifiedMatch.found && verifiedMatch.verifiedAnswer) {
    contextText =
      `\n[ข้อมูลที่ผ่านการตรวจทานและรับรองความถูกต้องแล้ว (Verified Clinical Knowledge)]:\n` +
      `• เรื่อง/คำถาม: ${verifiedMatch.docTitle || question}\n` +
      `• เนื้อหาที่ได้รับการรับรอง: ${verifiedMatch.verifiedAnswer}\n` +
      `• หน่วยงานที่รับรอง: ${verifiedMatch.source || "กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก สสจ.พิษณุโลก"}\n` +
      `• คำสั่งพิเศษ: ข้อมูลนี้ผ่านการตรวจทานความถูกต้อง 100% จากผู้เชี่ยวชาญ ให้นำเนื้อหานี้มาตอบผู้ใช้เป็นหลัก และระบุว่า "ข้อมูลนี้ผ่านการตรวจทานความถูกต้องโดยกลุ่มงานการแพทย์แผนไทยแล้ว"\n\n` +
      contextText;
  }

  if (!contextText.trim()) {
    contextText = "ไม่พบข้อมูลเฉพาะเจาะจงสำหรับคำถามนี้ในฐานข้อมูลภายใน ในส่วนอ้างอิงให้ระบุเฉพาะ 'ฐานข้อมูล สสจ.พิษณุโลก' และ 'คู่มือกรมการแพทย์แผนไทยฯ' โดยไม่ต้องใส่ URL ห้ามแต่งข้อมูลหรืออ้างอิงขึ้นเอง หากไม่มีข้อมูลในระบบ ให้แจ้งผู้ใช้อย่างตรงไปตรงมาว่าไม่มีข้อมูลในฐานข้อมูลปัจจุบัน และแนะนำให้ปรึกษาแพทย์แผนไทยหรือเภสัชกรโดยตรง";
  }

  // ปรับคำสั่งพิเศษตามการเปิด-ปิดแหล่งข้อมูล
  let dynamicInstructions = "";
  if (!enableExternal) {
    dynamicInstructions += "\n\n⚠️ หมายเหตุสำคัญ: ขณะนี้ระบบปิดการดึงข้อมูลวิจัยภายนอก (PubMed และ ThaiJO) ห้ามแต่งหรืออ้างอิงงานวิจัยภายนอก และไม่ต้องใส่หัวข้อ '📚 เอกสารอ้างอิง (APA 7th Edition)' ของงานวิจัยภายนอก";
  }
  if (!enableInternal) {
    dynamicInstructions += "\n\n⚠️ หมายเหตุสำคัญ: ขณะนี้ระบบปิดการใช้ฐานข้อมูลสมุนไพรและตำรับยาภายในเว็บ ให้ตอบตามหลักวิชาการและการดูแลตนเองทั่วไป";
  }
  if (!enableMahidol) {
    dynamicInstructions += "\n\n⚠️ หมายเหตุสำคัญ: ขณะนี้ระบบปิดการใช้ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบันของ ม.มหิดล ห้ามนำข้อมูล DDI มหิดลมาอ้างอิง";
  }
  if (/กัญชา|cannabis|thc|cbd/i.test(question)) {
    dynamicInstructions += "\n\n⚠️ คำแนะนำพิเศษเรื่องกัญชา: หากผู้ใช้ถามถึงกัญชาหรือยาที่มีส่วนผสมของกัญชา ให้ตรวจสอบและตอบโดยอ้างอิงตำรับยาที่มีกัญชาในบัญชี 97 รายการ (เช่น ยาศุขไสยาศน์, ยาแก้ลมแก้เส้น, ยาทำลายพระสุเมรุ, ยาอัมฤตย์โอสถ, ยาประสะกัญชา, ยาทาขมิ้นชันและกัญชา และยาน้ำมันสารสกัดกัญชาสูตรต่างๆ) โดยเน้นย้ำว่าเป็นยาควบคุมทางการแพทย์ ข้อห้ามใช้ในสตรีมีครรภ์/ให้นมบุตร/เด็ก และข้อควรระวังปฏิกิริยากับยาแผนปัจจุบัน (DDI) อย่างเคร่งครัด";
  }

  // 4. เตรียมชุดข้อความส่งไปยัง AI Model
  const messagesToSend = [
    { role: "system", content: `${SYSTEM_PROMPT}${dynamicInstructions}\n\n<CONTEXT>\n${contextText}\n</CONTEXT>` },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];

  // 5. เรียกใช้ AI พร้อมระบบ True Streaming (Token Streaming) เพื่อความเร็วสูงสุด (TTFT < 1s)
  let lastError: Error | null = null;
  let answer = "";

  for (const provider of availableProviders) {
    const baseUrl = provider.base_url.trim().replace(/\/+$/, "");
    const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;

    const rawKey = provider.api_key?.trim() || "";
    const cleanKey = rawKey.replace(/[^\x20-\x7E]/g, "").trim();
    if (!cleanKey || cleanKey.includes("ใส่_")) {
      console.warn(`Provider ${provider.name} has invalid or empty API key. Skipping.`);
      continue;
    }

    const isGoogle = baseUrl.includes("google") || provider.provider_key === "gemini";
    const configuredModel = provider.model_name?.trim() || (isGoogle ? "gemini-flash-latest" : "deepseek-chat");
    const modelCandidates = isGoogle
      ? Array.from(new Set([configuredModel, "gemini-flash-latest", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"]))
      : [configuredModel];

    for (const modelToUse of modelCandidates) {
      try {
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cleanKey}`,
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: messagesToSend,
            temperature: 0.2,
            stream: true,
          }),
        });

        if (resp.status === 404 || resp.status === 503 || resp.status === 429) {
          console.warn(`Model ${modelToUse} returned HTTP ${resp.status}. Trying next candidate...`);
          continue;
        }

        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          throw new Error(`HTTP ${resp.status}: ${errText.slice(0, 150)}`);
        }

        // อ่าน Token แบบ Streaming (Server-Sent Events)
        if (resp.body) {
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let textBuffer = "";
          let streamDone = false;

          while (!streamDone) {
            const { done, value } = await reader.read();
            if (done) break;
            textBuffer += decoder.decode(value, { stream: true });

            let newlineIndex: number;
            while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
              let line = textBuffer.slice(0, newlineIndex);
              textBuffer = textBuffer.slice(newlineIndex + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (line.startsWith(":") || line.trim() === "") continue;
              if (!line.startsWith("data: ")) continue;

              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") {
                streamDone = true;
                break;
              }

              try {
                const parsed = JSON.parse(jsonStr);
                const token = parsed.choices?.[0]?.delta?.content || "";
                if (token) {
                  answer += token;
                  if (onChunk) {
                    // กรองแท็กโครงสร้างข้อมูลไม่ให้โชว์ดิบตอนกำลังสตรีมมิ่ง
                    const liveClean = answer
                      .replace(/\[METADATA\][\s\S]*$/, "")
                      .replace(/\[SOURCES\][\s\S]*$/, "")
                      .trim();
                    onChunk(liveClean);
                  }
                }
              } catch {
                // รอ buffer ถัดไป
              }
            }
          }
        } else {
          // Fallback หาก body ไม่มี streaming reader
          const result = await resp.json();
          answer = result?.choices?.[0]?.message?.content || "";
          if (onChunk) {
            const liveClean = answer.replace(/\[METADATA\][\s\S]*$/, "").trim();
            onChunk(liveClean);
          }
        }

        if (answer) {
          break;
        }
      } catch (e: any) {
        console.warn(`Provider ${provider.name} model ${modelToUse} failed:`, e.message);
        lastError = e;
      }
    }

    if (answer) {
      break;
    }
  }

  if (!answer) {
    throw new Error(
      lastError
        ? `ไม่สามารถเชื่อมต่อ AI ได้ (${lastError.message}) กรุณาตรวจสอบ API Key ในหน้าตั้งค่า AI`
        : "ขออภัยครับ ไม่สามารถสร้างคำตอบได้"
    );
  }

  // ตรวจสอบว่าคำตอบของ AI เป็นการปฏิเสธคำถามนอกขอบเขตหรือไม่
  const isOutOfScope =
    answer.includes("อยู่นอกเหนือขอบเขต") ||
    answer.includes("ไม่ได้เกี่ยวข้องกับทางด้านการแพทย์") ||
    answer.includes("ไม่สามารถตอบคำถามนอกเหนือจากนี้ได้");

  // 6. รวบรวม Sources Payload ทั้งภายในและภายนอก (PubMed & ThaiJO)
  const rawInternalSources = enableInternal
    ? [
        ...matched97Herbs.map((h) => ({ type: "formula", id: h.id, name: h.name })),
        ...matchedHerbs.map((h) => ({ type: "herb", id: h.id, name: h.name_thai })),
        ...matchedFormulas.map((f) => ({ type: "formula", id: f.id, name: f.name_thai })),
      ]
    : [];
  const seenSourceNames = new Set<string>();
  let internalSources = rawInternalSources.filter((s) => {
    if (!s.name || seenSourceNames.has(s.name)) return false;
    seenSourceNames.add(s.name);
    return true;
  });

  if (exactMatchedFormulas.length > 0 && exactMatchedHerbs.length === 0) {
    const fNames = exactMatchedFormulas.map((f) => f.name_thai);
    internalSources = internalSources.filter(
      (s) => s.type === "formula" && fNames.some((fn) => s.name.toLowerCase().includes(fn.toLowerCase()) || fn.toLowerCase().includes(s.name.toLowerCase())),
    );
  } else if (exactMatchedHerbs.length > 0) {
    const hNames = exactMatchedHerbs.map((h) => h.name_thai);
    internalSources = internalSources.filter((s) => {
      if (s.type === "herb") {
        return hNames.some((hn) => s.name.toLowerCase().includes(hn.toLowerCase()) || hn.toLowerCase().includes(s.name.toLowerCase()));
      }
      if (s.type === "formula") {
        return hNames.some((hn) => s.name.toLowerCase().includes(hn.toLowerCase()));
      }
      return true;
    });
  }

  const rawSourcesPayload: any = isOutOfScope
    ? { internal: [], pubmed: [], thaijo: [], knowledge: [] }
    : {
        internal: internalSources,
        pubmed: enableExternal ? pubmedResults : [],
        thaijo: enableExternal ? thaijoResults : [],
      };

  if (!isOutOfScope) {
    const knowledgeItems: any[] = [];
    if (enableMahidol && matchedMahidol.length > 0) {
      knowledgeItems.push(
        ...matchedMahidol.map((m: any) => ({
          id: m.id,
          title: m.title,
          category: m.category,
          content: m.content,
          source: m.source || "ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ มหาวิทยาลัยมหิดล",
          source_url: m.source_url || undefined,
        }))
      );
    }
    if (enableInternal && allKnowledge.length > 0) {
      if (matchedHerbs.length === 0 && matchedFormulas.length === 0) {
        knowledgeItems.push(
          ...allKnowledge.slice(0, 2).map((k: any) => ({
            id: k.id,
            title: k.title,
            category: k.category,
            content: k.content,
            source: k.source || "คู่มือ 10 กลุ่มอาการ กรมการแพทย์แผนไทยและการแพทย์ทางเลือก",
            source_url: k.source_url || undefined,
          }))
        );
      } else {
        // ดึงเอกสาร NLEM หรือเอกสารความรู้ที่ตรงกับคำถาม/สมุนไพรเข้า sources
        const matchedKnowledgeDocs = allKnowledge.filter((k: any) => {
          const kt = (k.title || "").toLowerCase();
          const qLower = question.toLowerCase();
          if (k.category === "บัญชียาหลักแห่งชาติด้านสมุนไพร") {
            const mDrug = kt.match(/บัญชียาหลักแห่งชาติด้านสมุนไพร:\s*(ยา[^\s(]+|[^\s(]+)/);
            const docDrugName = mDrug ? mDrug[1].trim() : "";
            const docDrugClean = docDrugName.replace(/^ยา/, "").trim();
            return (
              (docDrugName && qLower.includes(docDrugName.toLowerCase())) ||
              (docDrugClean.length >= 2 && qLower.includes(docDrugClean.toLowerCase()))
            );
          }
          return kt.split(/\s+/).some((w: string) => w.length >= 3 && qLower.includes(w));
        });
        if (matchedKnowledgeDocs.length > 0) {
          knowledgeItems.push(
            ...matchedKnowledgeDocs.slice(0, 3).map((k: any) => ({
              id: k.id,
              title: k.title,
              category: k.category,
              content: k.content,
              source: k.source || "บัญชียาหลักแห่งชาติด้านสมุนไพร",
              source_url: k.source_url || undefined,
            }))
          );
        }
      }
    }
    if (knowledgeItems.length > 0) {
      rawSourcesPayload.knowledge = knowledgeItems;
    }
  }

  // ตรวจสอบและคัดกรองอ้างอิงอย่างเข้มงวดก่อนส่งออก (Strict Reference Validation & Pruning)
  const sourcesPayload = isOutOfScope
    ? { internal: [], pubmed: [], thaijo: [], knowledge: [] }
    : validateAndPruneSources(question, answer, rawSourcesPayload);

  const finalResponse = `${answer}\n\n[SOURCES]${JSON.stringify(sourcesPayload)}[/SOURCES]`;

  // บันทึกคำถาม-คำตอบลงคิวเรียนรู้และตรวจสอบความถูกต้องสำหรับแอดมิน
  if (!isOutOfScope && answer.trim()) {
    try {
      addToLearningQueue(question, answer);
    } catch {
      // ignore
    }
  }

  if (onChunk) {
    onChunk(finalResponse);
  }

  return finalResponse;
}
