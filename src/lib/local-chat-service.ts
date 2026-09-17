import { supabase } from "@/integrations/supabase/client";
import { getLocalProviders, type ProviderItem } from "./ai-providers-storage";
import { getKnowledgeSettings, DEFAULT_KNOWLEDGE_SETTINGS, type KnowledgeSettings } from "./knowledge-settings";
import { searchHerbs97ByName, searchHerbs97BySymptom, formatHerb97ForAiContext, type Herb97Item } from "./herbs97-service";
import { findVerifiedAnswer, addToLearningQueue } from "./learning-verification-service";
import {
  searchHerbBooks,
  searchHerbBooksTiered,
  formatHerbBooksForAiContext,
  isHerbDrugInteractionQuery,
  searchCpgHerbDrugInteractions,
  HERB_BOOK_CATEGORIES,
  type HerbBookItem,
} from "./herb-books-service";
import tuDdiDataset from "@/data/tu-ddi-dataset.json";

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
  "หญ้าปักกิ่ง": "Murdannia loriformis",
  "ทองพันชั่ง": "Rhinacanthus nasutus",
  "กล้วย": "Musa paradisiaca",
  "ไพล": "Zingiber montanum",
  "พญายอ": "Clinacanthus nutans",
  "เพชรสังฆาต": "Cissus quadrangularis",
  "บอระเพ็ด": "Tinospora crispa",
  "ชุมเห็ดเทศ": "Senna alata",
  "มะขามแขก": "Senna alexandrina",
  "กานพลู": "Syzygium aromaticum",
  "ดีบัว": "Nelumbo nucifera",
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
    /(?:ห้ามกิน(?:กับ)?สมุนไพรอะไร|สมุนไพรที่(?:มีผล|ตี)กับ|สมุนไพรที่ห้ามกิน)/.test(qLower) ||
    (detectedDrugs.size > 0 && /(?:สมุนไพรอะไร|สมุนไพรตัวไหน|สมุนไพรใด)/.test(qLower));

  const isGeneralDrugsQuestion =
    /(?:ห้ามกินกับยา(?:แผนปัจจุบัน|อะไร|ตัวไหน|ใด)|ยาแผนปัจจุบันอะไร|ตีกับยา(?:อะไร|ตัวไหน)|มีผลกับยา(?:อะไร|ตัวไหน)|อันตรกิริยากับยา)/.test(qLower) ||
    (detectedHerbs.size > 0 && /(?:ห้ามกินกับยา|ตีกับยา|อันตรกิริยากับยา|มีผลกับยา)/.test(qLower));

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

/** ลบการอ้างอิงถึง ม.มหิดล / medplant ออกจากคำตอบเมื่อปิดการใช้งานฐานข้อมูล DDI มหิดล */
export function sanitizeMahidolReferences(content: string): string {
  if (!content) return content;

  // 1. กรองบรรทัดที่เอ่ยถึง มหาวิทยาลัยมหิดล หรือ medplant
  const lines = content.split("\n");
  const filteredLines = lines.filter((line) => {
    if (/มหาวิทยาลัยมหิดล|ม\.มหิดล|ศูนย์ข้อมูลสมุนไพร|medplant\.mahidol\.ac\.th/i.test(line)) {
      return false;
    }
    return true;
  });

  let cleaned = filteredLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  // 2. ถ้าหัวข้อเอกสารอ้างอิง APA 7th Edition ว่างเปล่า (ไม่มีเนื้อหาอ้างอิงเหลืออยู่เลย) ให้ตัดหัวข้อออก
  cleaned = cleaned.replace(
    /###\s*📚\s*เอกสารอ้างอิง\s*\(APA\s*7th\s*Edition\)\s*(?=\n\s*(?:###|##|---|💡|🚨|\[METADATA\]|\[SOURCES\]|$))/g,
    ""
  ).trim();

  return cleaned;
}

/** ค้นหาข้อมูลอันตรกิริยา ม.ธรรมศาสตร์ (ศ. ดร.ภญ.อรุณพร อิฐรัตน์) ที่ตรงกับคำถาม */
export function findRelevantTuDdi(
  question: string,
  allTuDocs: any[] = tuDdiDataset as any[],
  matchedHerbs: any[] = []
): any[] {
  if (!allTuDocs || allTuDocs.length === 0) return [];

  const { herbs, drugs, isGeneralHerbsQuestion, isGeneralDrugsQuestion, isDdiIntent } =
    extractQuestionEntities(question, matchedHerbs);

  if (!isDdiIntent && herbs.length === 0 && drugs.length === 0) {
    return [];
  }

  const matched: any[] = [];
  const seenIds = new Set<string>();

  for (const doc of allTuDocs) {
    const docId = doc.id || doc.title;
    if (seenIds.has(docId)) continue;

    const docHerb = (doc.herb_name || "").toLowerCase();
    const docDrug = (doc.drug_name || "").toLowerCase();
    const aliases: string[] = (doc.herb_aliases || []).map((a: string) => a.toLowerCase());
    const allDocHerbs = [docHerb, ...aliases];

    const herbMatches =
      herbs.length > 0 &&
      herbs.some((h) => {
        const hLower = h.toLowerCase();
        return allDocHerbs.some(
          (dh) => dh === hLower || dh.includes(hLower) || hLower.includes(dh)
        );
      });

    const drugMatches =
      drugs.length > 0 &&
      drugs.some((d) => {
        const dLower = d.toLowerCase();
        return (
          docDrug === dLower ||
          docDrug.includes(dLower) ||
          dLower.includes(docDrug)
        );
      });

    if (herbs.length > 0 && drugs.length > 0) {
      if (herbMatches && drugMatches) {
        seenIds.add(docId);
        matched.push(doc);
      }
    } else if (herbs.length > 0 && (drugs.length === 0 || isGeneralDrugsQuestion)) {
      if (herbMatches && (isGeneralDrugsQuestion || isDdiIntent)) {
        seenIds.add(docId);
        matched.push(doc);
      }
    } else if (drugs.length > 0 && (herbs.length === 0 || isGeneralHerbsQuestion)) {
      if (drugMatches && (isGeneralHerbsQuestion || isDdiIntent)) {
        seenIds.add(docId);
        matched.push(doc);
      }
    }
  }

  const severityScore = (s: string) => {
    if (s?.includes("มาก")) return 3;
    if (s?.includes("ปานกลาง")) return 2;
    if (s?.includes("น้อย")) return 1;
    return 0;
  };

  matched.sort((a, b) => severityScore(b.severity || "") - severityScore(a.severity || ""));
  return herbs.length > 0 && drugs.length > 0 ? matched.slice(0, 5) : matched.slice(0, 8);
}

/** ลบการอ้างอิงถึง ม.ธรรมศาสตร์ / ศ. ดร.ภญ.อรุณพร อิฐรัตน์ ออกจากคำตอบเมื่อปิดการใช้งานฐานข้อมูล DDI ธรรมศาสตร์ */
export function sanitizeTuReferences(content: string): string {
  if (!content) return content;

  // 1. กรองบรรทัดที่เอ่ยถึง มหาวิทยาลัยธรรมศาสตร์ หรือ ศ. ดร.ภญ.อรุณพร อิฐรัตน์
  const lines = content.split("\n");
  const filteredLines = lines.filter((line) => {
    if (
      /มหาวิทยาลัยธรรมศาสตร์|ม\.ธรรมศาสตร์|อรุณพร\s*อิฐรัตน์|สถานการแพทย์แผนไทยประยุกต์/i.test(
        line
      )
    ) {
      return false;
    }
    return true;
  });

  let cleaned = filteredLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  // 2. ถ้าหัวข้อเอกสารอ้างอิง APA 7th Edition ว่างเปล่า ให้ตัดหัวข้อออก
  cleaned = cleaned
    .replace(
      /###\s*📚\s*เอกสารอ้างอิง\s*\(APA\s*7th\s*Edition\)\s*(?=\n\s*(?:###|##|---|💡|🚨|\[METADATA\]|\[SOURCES\]|$))/g,
      ""
    )
    .trim();

  return cleaned;
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

export type ThaiJoCatalogEntry = {
  subjects: string[];   // ชื่อสมุนไพร หรือ ตำรับยาเฉพาะที่งานวิจัยนี้กล่าวถึง
  symptoms?: string[];  // อาการที่เกี่ยวข้อง (ใช้เฉพาะเมื่อผู้ใช้ถามตามอาการโดยไม่ระบุชื่อสมุนไพร/ตำรับ)
  data: ThaiJoItem;
};

// คลังงานวิจัยไทย (ThaiJO) ที่คัดสรรสำหรับสมุนไพรและตำรับยาไทยยอดนิยม (ตรวจสอบชื่อเรื่อง ผู้นิพนธ์ ปีพิมพ์ และ URL ตรงกับระบบ ThaiJO 100%)
export const THAIJO_CATALOG: ThaiJoCatalogEntry[] = [
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
    // บัวบก: เฉพาะเมื่อมีการถามหรือตอบเกี่ยวกับบัวบกโดยตรง (ไม่ใส่ symptoms แผล เพื่อป้องกันการดึงงานวิจัยเคมีวิเคราะห์แล็บมาปนกับคำถามรักษาแผลทั่วไป)
    subjects: ["บัวบก", "ใบบัวบก", "centella"],
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

/** ตรวจสอบว่าชื่อสมุนไพรหรือตำรับยา ปรากฏหรือเกี่ยวข้องกับเนื้อหาคำถามหรือคำตอบหรือไม่ */
export function isEntityRelevantToText(
  name: string,
  qLower: string,
  aLower: string,
  nq: string,
  na: string
): boolean {
  if (!name) return false;
  const raw = name.toLowerCase();

  // ตัดส่วนขยาย เช่น (ไม่น้อยกว่าร้อยละ 87% w/w), (สูตรตำรับที่ 1), (รพ.)
  const clean = name
    .replace(/\s*\(.*?\)/g, "")
    .replace(/^(ยาผง\s*\(รพ\.\)|ทิงเจอร์\s*\(รพ\.\)|ยาน้ำ\s*\(รพ\.\)|ยาลูกกลอน\s*\(รพ\.\)|ยาชง\s*\(รพ\.\)|ยาผง|ทิงเจอร์|ยาน้ำ|ยาเม็ด|ยาแคปซูล|ยาลูกกลอน|ยาชง|ยา)\s*/, "")
    .trim();
  const cleanLower = clean.toLowerCase();

  // ตัดคำนำหน้า เช่น "ใบ", "ต้น", "เหง้า", "เนื้อผล"
  const baseName = clean.replace(/^(ใบ|ต้น|เหง้า|เนื้อผล|ลูก|ราก|ดอก|เปลือก)\s*/, "").trim();
  const baseLower = baseName.toLowerCase();

  const norm = normalizeThaiName(name);
  const normClean = normalizeThaiName(clean);
  const normBase = normalizeThaiName(baseName);

  const check = (text: string, nText: string) => {
    if (text.includes(raw)) return true;
    if (cleanLower.length >= 2 && text.includes(cleanLower)) return true;
    if (baseLower.length >= 2 && text.includes(baseLower)) return true;
    if (norm.length >= 2 && nText.includes(norm)) return true;
    if (normClean.length >= 2 && nText.includes(normClean)) return true;
    if (normBase.length >= 2 && nText.includes(normBase)) return true;
    return false;
  };

  return check(qLower, nq) || check(aLower, na);
}

/** สกัด Allowed Entities จาก sources payload ที่ผ่านการ prune แล้ว */
export function extractAllowedEntitiesFromSources(sources: {
  internal?: any[];
  pubmed?: any[];
  thaijo?: any[];
  knowledge?: any[];
}): string[] {
  const allowed = new Set<string>();
  for (const s of sources.internal || []) {
    if (s.name) {
      allowed.add(s.name);
      const clean = s.name
        .replace(/\s*\(.*?\)/g, "")
        .replace(/^(ยาผง\s*\(รพ\.\)|ทิงเจอร์\s*\(รพ\.\)|ยาน้ำ\s*\(รพ\.\)|ยาลูกกลอน\s*\(รพ\.\)|ยาชง\s*\(รพ\.\)|ยาผง|ทิงเจอร์|ยาน้ำ|ยาเม็ด|ยาแคปซูล|ยาลูกกลอน|ยาชง|ยา)\s*/, "")
        .trim();
      if (clean && clean.length >= 2) allowed.add(clean);
      const base = clean.replace(/^(ใบ|ต้น|เหง้า|เนื้อผล|ลูก|ราก|ดอก|เปลือก)\s*/, "").trim();
      if (base && base.length >= 2) allowed.add(base);
    }
  }
  for (const k of sources.knowledge || []) {
    if (k.title) allowed.add(k.title);
    if (k.herb_name) allowed.add(k.herb_name);
    if (k.drug_name) allowed.add(k.drug_name);
    if (Array.isArray(k.herbs)) {
      k.herbs.forEach((h: string) => allowed.add(h));
    }
    if (Array.isArray(k.modernDrugs)) {
      k.modernDrugs.forEach((d: string) => allowed.add(d));
    }
  }
  for (const t of sources.thaijo || []) {
    if (t.title) allowed.add(t.title);
  }
  for (const p of sources.pubmed || []) {
    if (p.title) allowed.add(p.title);
    if (p.pmid) allowed.add(p.pmid);
  }
  return Array.from(allowed);
}

/** คัดกรองรายการอ้างอิง APA 7th Edition ในเนื้อหาคำตอบ เพื่อให้แน่ใจว่าไม่มีการอ้างอิงสมุนไพรที่ไม่เกี่ยวข้อง */
export function sanitizeUnrelatedApaReferences(
  content: string,
  allowedEntities: string[]
): string {
  if (!content) return content;
  if (!allowedEntities || allowedEntities.length === 0) return content;

  const apaMatch = content.match(/(?:###\s*)?📚\s*เอกสารอ้างอิง\s*\(APA\s*7th\s*Edition\)/i);
  if (!apaMatch || apaMatch.index === undefined) return content;

  const headerIdx = apaMatch.index;
  const beforeApa = content.slice(0, headerIdx);
  const apaSection = content.slice(headerIdx);

  const lines = apaSection.split("\n");
  const filteredLines: string[] = [];

  const lowerAllowed = allowedEntities.map((e) => e.toLowerCase().trim()).filter((e) => e.length >= 2);
  const normAllowed = allowedEntities.map((e) => normalizeThaiName(e)).filter((e) => e.length >= 2);

  const checkAgainstKnown = [
    "บัวบก", "ใบบัวบก", "centella", "ว่านหางจระเข้", "aloe", "กล้วย", "ทองพันชั่ง",
    "ขมิ้นชัน", "ขมิ้น", "curcuma", "ฟ้าทะลายโจร", "andrographis", "กระชายดำ",
    "กระชาย", "กระชายขาว", "ชาเขียว", "ตังกุย", "เซนต์จอห์นเวิร์ต", "มะรุม",
    "รางจืด", "มะขามป้อม", "กะเพรา", "โหระพา", "ตะไคร้", "พริกไทย", "อบเชย",
    "ชะพลู", "มะระขี้นก", "หญ้าหวาน", "ดอกคำฝอย", "เก๋ากี้", "เห็ดหลินจือ",
    "หญ้าปักกิ่ง", "murdannia", "จันทน์ลีลา", "ประสะไพล", "ตรีผลา", "ปราบชมพูทวีป",
    "หอมเทพจิตร", "ธาตุบรรจบ", "วิสัมพยาใหญ่", "เบญจกูล"
  ];

  let inCitationBlock = false;
  for (const line of lines) {
    if (/(?:###\s*)?📚\s*เอกสารอ้างอิง\s*\(APA\s*7th\s*Edition\)/i.test(line)) {
      filteredLines.push(line);
      inCitationBlock = true;
      continue;
    }

    if (inCitationBlock && /^(?:###|##|---|💡|🚨|\[METADATA\]|\[SOURCES\])/.test(line.trim())) {
      inCitationBlock = false;
      filteredLines.push(line);
      continue;
    }

    if (inCitationBlock && line.trim().length > 0) {
      const lineLower = line.toLowerCase();
      const lineNorm = normalizeThaiName(line);

      const isAllowed = lowerAllowed.some((ent) => lineLower.includes(ent)) ||
                        normAllowed.some((ent) => lineNorm.includes(ent));

      const mentionsUnallowedKnown = checkAgainstKnown.some((k) => {
        const kLower = k.toLowerCase();
        if (lineLower.includes(kLower)) {
          const isThisAllowed = lowerAllowed.some((ent) => ent.includes(kLower) || kLower.includes(ent));
          return !isThisAllowed;
        }
        return false;
      });

      if (mentionsUnallowedKnown) {
        continue;
      }

      const isGeneralOfficialDoc =
        /(?:คณะกรรมการพัฒนาระบบยาแห่งชาติ|กรมการแพทย์แผนไทยและการแพทย์ทางเลือก|กรมการแพทย์|กระทรวงสาธารณสุข|บัญชียาหลักแห่งชาติ)/i.test(line) ||
        /คู่มือการใช้ยาสมุนไพร/i.test(line) ||
        /แนวทางการใช้ยาสมุนไพรในบัญชียาหลักแห่งชาติทดแทนยาแผนปัจจุบัน/i.test(line) ||
        /แนวทางการรักษาอาการเจ็บป่วยด้วยยาสมุนไพร/i.test(line);

      if (isAllowed || isGeneralOfficialDoc) {
        filteredLines.push(line);
      } else {
        continue;
      }
    } else {
      filteredLines.push(line);
    }
  }

  let cleaned = beforeApa + filteredLines.join("\n");
  cleaned = cleaned
    .replace(
      /(?:###\s*)?📚\s*เอกสารอ้างอิง\s*\(APA\s*7th\s*Edition\)\s*(?=\n\s*(?:###|##|---|💡|🚨|\[METADATA\]|\[SOURCES\]|$))/g,
      ""
    )
    .trim();

  return cleaned;
}

/** ตัดหัวข้อและรายการเอกสารอ้างอิง APA 7th Edition ทั้งหมดออกจากเนื้อหาข้อความ (เมื่อ admin ปิดการแสดงผล) */
export function stripAllApaReferences(content: string): string {
  if (!content) return content;
  let cleaned = content
    .replace(
      /(?:\n*\s*---\s*)?(?:###\s*)?📚?\s*เอกสารอ้างอิง\s*\(APA\s*7th\s*Edition\)[\s\S]*?(?=(?:\n*\s*(?:###|##|---|💡|🚨|\[METADATA\]|\[SOURCES\]))|$)/i,
      ""
    )
    .trim();
  cleaned = cleaned.replace(/\n*\s*---\s*$/, "").trim();
  return cleaned;
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
  },
  settings?: KnowledgeSettings
): {
  internal: any[];
  pubmed: any[];
  thaijo: any[];
  knowledge: any[];
} {
  const currentSettings = settings || getKnowledgeSettings();
  const enableMahidol = currentSettings.enable_mahidol_ddi !== false;
  const enableTu = currentSettings.enable_tu_ddi !== false;
  const enableHerbBooks = currentSettings.enable_herb_books !== false;
  const enableInternal = currentSettings.enable_internal_db !== false;
  const enableExternal = currentSettings.enable_external_research !== false;

  const { herbs, drugs, isGeneralHerbsQuestion, isGeneralDrugsQuestion } =
    extractQuestionEntities(question);
  const isDdiQuery = isHerbDrugInteractionQuery(question);
  const qLower = (question || "").toLowerCase();
  const aLower = (answer || "").toLowerCase();
  const nq = normalizeThaiName(question);
  const na = normalizeThaiName(answer);

  // ตรวจสอบการจับคู่ลำดับความสำคัญ 7 ลำดับ
  const rawKnowledge = sources.knowledge || [];

  function detectDocTier(k: any): number | null {
    if (typeof k.tier === "number") return k.tier;
    if (k.bookCategory === "cpg_medical_services_2568" || (k.source && k.source.includes("คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ"))) return 1;
    if (k.bookCategory === "substitution_modern_drugs_2567" || (k.source && k.source.includes("ทดแทนยาแผนปัจจุบัน") && !k.id?.includes("poster"))) return 2;
    if (k.bookCategory === "primary_care_flowchart_icd10" || (k.source && k.source.includes("ปฐมภูมิ") && k.category !== "10 กลุ่มอาการ")) return 3;
    if (k.bookCategory === "nlem_updates_2568" || k.id === "nlem-updates-2568" || (k.source && k.source.includes("2568_2"))) return 4;
    if (k.bookCategory === "common_diseases_10" || (k.id && k.id.startsWith("cd10-") && !k.id.includes("poster"))) return 5;
    if (k.bookCategory === "cd10_symptoms_poster" || k.id === "cd10-symptoms-poster-a5") return 6;
    if (k.bookCategory === "substitution_19_poster" || k.id === "substitution-19-poster-a5") return 7;
    return null;
  }

  const docTiers = rawKnowledge
    .map((k) => detectDocTier(k))
    .filter((t): t is number => t !== null);

  let effectiveTier: number | null = null;
  if (enableHerbBooks && isDdiQuery) {
    effectiveTier = 1;
  } else if (docTiers.length > 0) {
    effectiveTier = Math.min(...docTiers);
  }

  // 1. ตรวจสอบและกรอง Knowledge Documents (โดยเฉพาะ DDI มหิดล และ ม.ธรรมศาสตร์)
  const validKnowledge: any[] = [];
  const seenKnowledgeTitles = new Set<string>();

  for (const k of rawKnowledge) {
    const title = (k.title || "").trim();
    if (!title || seenKnowledgeTitles.has(title)) continue;

    // กฎ Short-Circuit: หากพบข้อมูลในลำดับที่ effectiveTier (1-7) ให้หยุดและตัดแหล่งข้อมูลอื่นๆ ออกทั้งหมด
    if (effectiveTier !== null) {
      if (
        k.category === "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)" ||
        k.category === "อันตรกิริยาระหว่างยาและสมุนไพร (DDI - ม.ธรรมศาสตร์)" ||
        title.includes("มหิดล") ||
        title.includes("ม.ธรรมศาสตร์") ||
        (k.source && (k.source.includes("มหิดล") || k.source.includes("ธรรมศาสตร์") || k.source.includes("อรุณพร"))) ||
        (k.source_url && k.source_url.includes("mahidol"))
      ) {
        continue;
      }

      const itemTier = detectDocTier(k);

      // ถ้าเป็นเอกสารหนังสือแต่คนละ tier กับที่พบคำตอบ ให้ตัดทิ้ง
      if (itemTier !== null && itemTier !== effectiveTier) {
        continue;
      }

      // ถ้าเป็นเอกสารความรู้ทั่วไปที่ไม่ใช่หนังสือใน tier ที่พบคำตอบ ให้ตัดทิ้ง
      if (itemTier === null && (k.category === "10 กลุ่มอาการ" || k.category === "ทั่วไป")) {
        continue;
      }
    }

    // ถ้าเป็นคำถามอันตรกิริยาระหว่างสมุนไพรกับยา (Herb-Drug Interactions) และเปิดใช้งานหนังสือความรู้ด้านยา
    // ใช้อ้างอิงจากคู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ กรมการแพทย์ (พ.ศ. 2568) เท่านั้น
    // ตัดเอกสาร DDI ของ ม.มหิดล และ ม.ธรรมศาสตร์ ออกทั้งหมด 100%
    if (enableHerbBooks && isDdiQuery) {
      if (
        k.category === "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)" ||
        k.category === "อันตรกิริยาระหว่างยาและสมุนไพร (DDI - ม.ธรรมศาสตร์)" ||
        title.includes("มหิดล") ||
        title.includes("ม.ธรรมศาสตร์") ||
        (k.source && (k.source.includes("มหิดล") || k.source.includes("ธรรมศาสตร์") || k.source.includes("อรุณพร"))) ||
        (k.source_url && k.source_url.includes("mahidol"))
      ) {
        continue;
      }
    }

    // ถ้าปิดการใช้งานหนังสือข้อมูลความรู้ด้านยา ให้ตัดเอกสารในกลุ่มหนังสือทิ้งทั้งหมด
    if (!enableHerbBooks) {
      if (
        k.category === "หนังสือข้อมูลความรู้ด้านยาและเวชปฏิบัติ" ||
        k.category === "หนังสือและคู่มือความรู้ด้านยา" ||
        (k.source && (k.source.includes("คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ") || k.source.includes("ทดแทนยาแผนปัจจุบัน") || k.source.includes("ปฐมภูมิ")))
      ) {
        continue;
      }
    }

    // ถ้าปิดการใช้งานฐานข้อมูล DDI มหิดล ให้ตัดเอกสาร DDI หรือเอกสารที่มาจาก ม.มหิดล ทิ้งทั้งหมด 100%
    if (!enableMahidol) {
      if (
        k.category === "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)" ||
        title.includes("มหิดล") ||
        (k.source && (k.source.includes("มหิดล") || k.source.includes("ศูนย์ข้อมูลสมุนไพร"))) ||
        (k.source_url && k.source_url.includes("mahidol"))
      ) {
        continue;
      }
    }

    // ถ้าปิดการใช้งานฐานข้อมูล DDI ม.ธรรมศาสตร์ ให้ตัดเอกสาร DDI หรือเอกสารที่มาจาก ม.ธรรมศาสตร์ ทิ้งทั้งหมด 100%
    if (!enableTu) {
      if (
        k.category === "อันตรกิริยาระหว่างยาและสมุนไพร (DDI - ม.ธรรมศาสตร์)" ||
        title.includes("ม.ธรรมศาสตร์") ||
        (k.source && (k.source.includes("ธรรมศาสตร์") || k.source.includes("อรุณพร")))
      ) {
        continue;
      }
    }

    if (k.category === "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)") {
      const m = title.match(/อันตรกิริยาระหว่าง\s+(.+?)\s+กับ\s+(.+?)(?:\s+\(ม\.มหิดล\))?$/);
      const docHerb = m ? m[1].trim() : "";
      const docDrug = m ? m[2].trim() : "";

      const isSourceInquiry = /(?:แหล่ง(?:ข้อมูล|อ้างอิง|สืบค้น)|ที่มา(?:ของข้อมูล)?|ฐานข้อมูล|ตรวจสอบ(?:จาก|ได้จาก)?(?:แหล่ง|ที่)?|อ้างอิงจาก(?:ไหน|ใด)|เอาข้อมูลมาจาก(?:ไหน|ใด)|น่าเชื่อถือ(?:ไหม|แค่ไหน|อย่างไร)|ระบบใช้(?:ข้อมูล|แหล่ง)|ใครเป็นผู้(?:พัฒนา|ให้ข้อมูล)|ตรวจทาน|รับรอง)/i.test(question);

      // ถ้าเป็นคำถามอาการ (ไม่ได้ระบุสมุนไพร/ยาเฉพาะ) → ตัด DDI ทิ้งทั้งหมด เพราะไม่ได้ถามเรื่อง DDI
      if (herbs.length === 0 && drugs.length === 0 && !isGeneralHerbsQuestion && !isGeneralDrugsQuestion && !isSourceInquiry) {
        continue;
      }

      // ถ้าผู้ใช้ระบุสมุนไพรเฉพาะเจาะจง สมุนไพรในเอกสารต้องตรงกับที่ถามใน **คำถาม** เท่านั้น
      if (herbs.length > 0) {
        const herbMatch = herbs.some(
          (h) =>
            docHerb.toLowerCase() === h.toLowerCase() ||
            docHerb.toLowerCase().includes(h.toLowerCase()) ||
            h.toLowerCase().includes(docHerb.toLowerCase())
        );
        if (!herbMatch) {
          continue;
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
          continue;
        }
      }

      // สมุนไพรหรือยาในเอกสารนี้ ต้องปรากฏใน **คำถาม** เท่านั้น (ไม่ใช้คำตอบ เพราะชื่อสมุนไพรที่เป็นส่วนประกอบของตำรับจะถูกรวมเข้ามาโดยไม่เกี่ยวข้อง)
      const herbInQuestion = qLower.includes(docHerb.toLowerCase());
      const drugInQuestion = qLower.includes(docDrug.toLowerCase());

      if (!herbInQuestion && !drugInQuestion && !isGeneralHerbsQuestion && !isGeneralDrugsQuestion && !isSourceInquiry) {
        continue;
      }
    } else if (
      k.category === "อันตรกิริยาระหว่างยาและสมุนไพร (DDI - ม.ธรรมศาสตร์)" ||
      title.includes("ม.ธรรมศาสตร์")
    ) {
      const m = title.match(/อันตรกิริยาระหว่าง\s+(.+?)\s+กับ\s+(.+?)(?:\s+\(ม\.ธรรมศาสตร์\))?$/);
      const docHerb = m ? m[1].trim() : (k.herb_name || "");
      const docDrug = m ? m[2].trim() : (k.drug_name || "");

      const isSourceInquiry = /(?:แหล่ง(?:ข้อมูล|อ้างอิง|สืบค้น)|ที่มา(?:ของข้อมูล)?|ฐานข้อมูล|ตรวจสอบ(?:จาก|ได้จาก)?(?:แหล่ง|ที่)?|อ้างอิงจาก(?:ไหน|ใด)|เอาข้อมูลมาจาก(?:ไหน|ใด)|น่าเชื่อถือ(?:ไหม|แค่ไหน|อย่างไร)|ระบบใช้(?:ข้อมูล|แหล่ง)|ใครเป็นผู้(?:พัฒนา|ให้ข้อมูล)|ตรวจทาน|รับรอง)/i.test(question);

      // ถ้าเป็นคำถามอาการ (ไม่ได้ระบุสมุนไพร/ยาเฉพาะ) → ตัด DDI ทิ้งทั้งหมด เพราะไม่ได้ถามเรื่อง DDI
      if (herbs.length === 0 && drugs.length === 0 && !isGeneralHerbsQuestion && !isGeneralDrugsQuestion && !isSourceInquiry) {
        continue;
      }

      // ถ้าผู้ใช้ระบุสมุนไพรเฉพาะเจาะจง
      if (herbs.length > 0) {
        const herbMatch = herbs.some(
          (h) =>
            docHerb.toLowerCase() === h.toLowerCase() ||
            docHerb.toLowerCase().includes(h.toLowerCase()) ||
            h.toLowerCase().includes(docHerb.toLowerCase())
        );
        if (!herbMatch) continue;
      }

      // ถ้าผู้ใช้ระบุยาเฉพาะเจาะจง
      if (drugs.length > 0) {
        const drugMatch = drugs.some(
          (d) =>
            docDrug.toLowerCase() === d.toLowerCase() ||
            docDrug.toLowerCase().includes(d.toLowerCase()) ||
            d.toLowerCase().includes(docDrug.toLowerCase())
        );
        if (!drugMatch) continue;
      }

      // สมุนไพรหรือยาในเอกสารนี้ ต้องปรากฏใน **คำถาม** เท่านั้น (ไม่ใช้คำตอบ)
      const herbInQuestion = qLower.includes(docHerb.toLowerCase());
      const drugInQuestion = qLower.includes(docDrug.toLowerCase());

      if (!herbInQuestion && !drugInQuestion && !isGeneralHerbsQuestion && !isGeneralDrugsQuestion && !isSourceInquiry) {
        continue;
      }
    } else if (k.category === "บัญชียาหลักแห่งชาติด้านสมุนไพร") {
      const isSourceInquiry = /(?:แหล่ง(?:ข้อมูล|อ้างอิง|สืบค้น)|ที่มา(?:ของข้อมูล)?|ฐานข้อมูล|ตรวจสอบ(?:จาก|ได้จาก)?(?:แหล่ง|ที่)?|อ้างอิงจาก(?:ไหน|ใด)|เอาข้อมูลมาจาก(?:ไหน|ใด)|น่าเชื่อถือ(?:ไหม|แค่ไหน|อย่างไร)|ระบบใช้(?:ข้อมูล|แหล่ง)|ใครเป็นผู้(?:พัฒนา|ให้ข้อมูล)|ตรวจทาน|รับรอง)/i.test(question);

      // ตรวจสอบชื่อยาในเอกสารบัญชียาหลักแห่งชาติ (เช่น บัญชียาหลักแห่งชาติด้านสมุนไพร: ยาขมิ้นชัน (พ.ศ. 2568))
      const mDrug = title.match(/บัญชียาหลักแห่งชาติด้านสมุนไพร:\s*(ยา[^\s(]+|[^\s(]+)/);
      const docDrugName = mDrug ? mDrug[1].trim() : "";
      const docDrugClean = docDrugName.replace(/^ยา/, "").trim();

      const inInternalSources = (sources.internal || []).some((s: any) => {
        const sName = (s.name || "").trim().toLowerCase();
        return (
          (docDrugName && (sName.includes(docDrugName.toLowerCase()) || docDrugName.toLowerCase().includes(sName))) ||
          (docDrugClean.length >= 2 && (sName.includes(docDrugClean.toLowerCase()) || docDrugClean.toLowerCase().includes(sName)))
        );
      });

      const drugMentioned =
        inInternalSources ||
        (docDrugName && qLower.includes(docDrugName.toLowerCase())) ||
        (docDrugClean.length >= 2 && qLower.includes(docDrugClean.toLowerCase()));

      if (!drugMentioned && !isSourceInquiry) {
        continue; // ตัดเอกสารบัญชียาหลักที่ไม่เกี่ยวข้องทิ้ง
      }
    } else if (
      k.category === "หนังสือข้อมูลความรู้ด้านยาและเวชปฏิบัติ" ||
      k.category === "หนังสือและคู่มือความรู้ด้านยา" ||
      (k.source && (k.source.includes("คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ") || k.source.includes("ทดแทนยาแผนปัจจุบัน") || k.source.includes("ปฐมภูมิ")))
    ) {
      const isSourceInquiry = /(?:แหล่ง(?:ข้อมูล|อ้างอิง|สืบค้น)|ที่มา(?:ของข้อมูล)?|ฐานข้อมูล|ตรวจสอบ(?:จาก|ได้จาก)?(?:แหล่ง|ที่)?|อ้างอิงจาก(?:ไหน|ใด)|เอาข้อมูลมาจาก(?:ไหน|ใด)|น่าเชื่อถือ(?:ไหม|แค่ไหน|อย่างไร)|ระบบใช้(?:ข้อมูล|แหล่ง)|ใครเป็นผู้(?:พัฒนา|ให้ข้อมูล)|ตรวจทาน|รับรอง)/i.test(question);

      const bookHerbs: string[] = k.herbs || [];
      const bookDrugs: string[] = k.modernDrugs || [];
      const bookTitle = (k.title || "").toLowerCase();
      const bookChapter = (k.chapter || "").toLowerCase();
      const combinedText = `${bookTitle} ${bookChapter} ${(k.indications || []).join(" ")}`.toLowerCase();

      const herbMatch = bookHerbs.some((h: string) => qLower.includes(h.toLowerCase()) || aLower.includes(h.toLowerCase()));
      const drugMatch = bookDrugs.some((d: string) => qLower.includes(d.toLowerCase()) || aLower.includes(d.toLowerCase()));
      const symptomsMatch = SYMPTOM_MAP.some((s) => s.match.test(qLower) && (s.match.test(combinedText) || s.terms.some((t) => combinedText.includes(t.toLowerCase()))));
      const qWordsMatch = qLower.split(/\s+/).some((w: string) => w.length >= 3 && combinedText.includes(w));

      if (isDdiQuery) {
        // สำหรับคำถาม DDI ให้คงเอกสาร CPG กรมการแพทย์ 2568 ที่เกี่ยวข้อง
        const isCpgDdi =
          (k.bookCategory === "cpg_medical_services_2568" || (k.source && k.source.includes("คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ"))) &&
          (herbMatch || drugMatch || qWordsMatch || combinedText.includes("อันตรกิริยา"));
        if (!isCpgDdi && !herbMatch && !drugMatch && !isSourceInquiry) {
          continue;
        }
      } else if (!herbMatch && !drugMatch && !symptomsMatch && !qWordsMatch && !isSourceInquiry && !isGeneralHerbsQuestion && !isGeneralDrugsQuestion) {
        continue;
      }
    }

    seenKnowledgeTitles.add(title);

    let docUrl = k.source_url;
    const isNlem =
      k.category === "บัญชียาหลักแห่งชาติด้านสมุนไพร" ||
      title.includes("บัญชียาหลักแห่งชาติ") ||
      (k.source && k.source.includes("บัญชียาหลักแห่งชาติ")) ||
      (docUrl && docUrl.includes("ratchakitcha"));

    if (isNlem) {
      const mDrug = title.match(/บัญชียาหลักแห่งชาติด้านสมุนไพร:\s*(.+?)(?:\s*\(พ\.ศ\.|\s*$)/);
      const drugName = mDrug
        ? mDrug[1].trim()
        : title.replace(/^บัญชียาหลักแห่งชาติด้านสมุนไพร:\s*/, "").replace(/\s*\(พ\.ศ\..*?\)$/, "").trim();
      docUrl = drugName ? `/herbs?name=${encodeURIComponent(drugName)}` : "/herbs";
    }

    if (k.category === "หนังสือข้อมูลความรู้ด้านยาและเวชปฏิบัติ" && !docUrl) {
      docUrl = `/knowledge?tab=books&id=${encodeURIComponent(k.id || "")}`;
    }

    validKnowledge.push({
      ...k,
      source_url: docUrl,
    });
  }

  // 2. ตรวจสอบและกรอง Internal Sources (สมุนไพรเดี่ยว และ ตำรับยาแผนไทย)
  const rawInternal = sources.internal || [];
  const validInternal: any[] = [];
  const seenInternalNames = new Set<string>();

  if (enableInternal && rawInternal.length > 0) {
    const isSourceInquiry = /(?:แหล่ง(?:ข้อมูล|อ้างอิง|สืบค้น)|ที่มา(?:ของข้อมูล)?|ฐานข้อมูล|ตรวจสอบ(?:จาก|ได้จาก)?(?:แหล่ง|ที่)?|อ้างอิงจาก(?:ไหน|ใด)|เอาข้อมูลมาจาก(?:ไหน|ใด)|น่าเชื่อถือ(?:ไหม|แค่ไหน|อย่างไร)|ระบบใช้(?:ข้อมูล|แหล่ง)|ใครเป็นผู้(?:พัฒนา|ให้ข้อมูล)|ตรวจทาน|รับรอง)/i.test(question);

    for (const s of rawInternal) {
      const name = (s.name || "").trim();
      if (!name) continue;

      if (isGeneralHerbsQuestion || isSourceInquiry) {
        if (!seenInternalNames.has(name)) {
          seenInternalNames.add(name);
          validInternal.push(s);
        }
        continue;
      }

      if (isEntityRelevantToText(name, qLower, aLower, nq, na)) {
        if (!seenInternalNames.has(name)) {
          seenInternalNames.add(name);
          validInternal.push(s);
        }
      }
    }
  }

  // 3. ตรวจสอบและกรอง ThaiJO Sources (งานวิจัยไทย - ข้ามกรณีเป็นคำถาม DDI)
  const rawThaiJo = sources.thaijo || [];
  const validThaiJo: any[] = [];
  const seenThaiJoUrls = new Set<string>();

  if (enableExternal && !(enableHerbBooks && isDdiQuery) && rawThaiJo.length > 0) {
    for (const t of rawThaiJo) {
      const url = t.url || "";
      if (seenThaiJoUrls.has(url)) continue;

      const catEntry = THAIJO_CATALOG.find((c) => c.data.url === url || c.data.title === t.title);
      let isRelevant = false;

      if (catEntry && catEntry.subjects && catEntry.subjects.length > 0) {
        isRelevant = catEntry.subjects.some((subj) => {
          const sLow = subj.toLowerCase();
          const sNorm = normalizeThaiName(subj);
          return (
            qLower.includes(sLow) ||
            aLower.includes(sLow) ||
            (sNorm.length >= 2 && (nq.includes(sNorm) || na.includes(sNorm)))
          );
        });
      } else {
        const words = (t.title || "").split(/\s+/).filter((w: string) => w.length >= 4);
        isRelevant =
          words.some((w: string) => qLower.includes(w.toLowerCase()) || aLower.includes(w.toLowerCase())) ||
          herbs.some((h: string) => (t.title || "").toLowerCase().includes(h.toLowerCase()));
      }

      if (isRelevant || isGeneralHerbsQuestion) {
        seenThaiJoUrls.add(url);
        validThaiJo.push(t);
      }
    }
  }

  // 4. ตรวจสอบและกรอง PubMed Sources (งานวิจัยระดับสากล - ข้ามกรณีเป็นคำถาม DDI)
  const rawPubMed = sources.pubmed || [];
  const validPubMed: any[] = [];
  const seenPmids = new Set<string>();

  if (enableExternal && !(enableHerbBooks && isDdiQuery) && rawPubMed.length > 0) {
    for (const p of rawPubMed) {
      if (seenPmids.has(p.pmid)) continue;
      const titleLower = (p.title || "").toLowerCase();
      let isRelevant = false;

      for (const [thaiName, sciName] of Object.entries(HERB_THAI_TO_SCI)) {
        if (qLower.includes(thaiName.toLowerCase()) || aLower.includes(thaiName.toLowerCase())) {
          if (titleLower.includes(sciName.toLowerCase())) {
            isRelevant = true;
            break;
          }
        }
      }

      if (!isRelevant && drugs.length > 0) {
        for (const d of drugs) {
          if ((qLower.includes(d.toLowerCase()) || aLower.includes(d.toLowerCase())) && titleLower.includes(d.toLowerCase())) {
            isRelevant = true;
            break;
          }
        }
      }

      if (isRelevant || isGeneralHerbsQuestion) {
        seenPmids.add(p.pmid);
        validPubMed.push(p);
      }
    }
  }

  return {
    internal: validInternal,
    pubmed: validPubMed,
    thaijo: validThaiJo,
    knowledge: validKnowledge,
  };
}

/** สร้าง AbortSignal พร้อม Timeout ที่ปลอดภัยสำหรับเบราว์เซอร์ทุกเวอร์ชัน (รวมถึง LINE/Facebook Webview) */
export function safeTimeoutSignal(ms: number): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      return AbortSignal.timeout(ms);
    }
  } catch {
    // fallback
  }
  try {
    if (typeof AbortController !== "undefined") {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        try {
          controller.abort();
        } catch {
          // ignore
        }
      }, ms);
      if (typeof controller.signal?.addEventListener === "function") {
        controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
      }
      return controller.signal;
    }
  } catch {
    // fallback
  }
  return undefined;
}

// In-Memory Cache สำหรับผลค้นหา PubMed
const pubmedCache = new Map<string, { at: number; data: PubMedItem[] }>();
const PUBMED_CACHE_TTL = 30 * 60 * 1000; // แคชไว้ 30 นาที

/** ค้นหางานวิจัยสากลจาก NCBI PubMed API พร้อม In-Memory Caching และการป้องกัน Timeout */
export async function fetchPubMedClient(query: string): Promise<PubMedItem[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const cached = pubmedCache.get(cleanQ);
  if (cached && Date.now() - cached.at < PUBMED_CACHE_TTL) {
    return cached.data;
  }

  const fetchTask = async (): Promise<PubMedItem[]> => {
    try {
      const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(
        cleanQ
      )}&retmax=3&retmode=json&sort=relevance`;
      const searchSignal = safeTimeoutSignal(1800);
      let searchResp: Response;
      try {
        searchResp = await fetch(searchUrl, searchSignal ? { signal: searchSignal } : {});
      } catch (err: any) {
        if (err?.message?.includes("AbortSignal") || err?.message?.includes("signal")) {
          searchResp = await fetch(searchUrl);
        } else {
          throw err;
        }
      }
      if (!searchResp.ok) return [];
      const searchData = await searchResp.json();
      const pmids: string[] = searchData?.esearchresult?.idlist || [];
      if (pmids.length === 0) return [];

      const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(
        ","
      )}&retmode=json`;
      const summarySignal = safeTimeoutSignal(1800);
      let summaryResp: Response;
      try {
        summaryResp = await fetch(summaryUrl, summarySignal ? { signal: summarySignal } : {});
      } catch (err: any) {
        if (err?.message?.includes("AbortSignal") || err?.message?.includes("signal")) {
          summaryResp = await fetch(summaryUrl);
        } else {
          throw err;
        }
      }
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

      if (results.length > 0) {
        pubmedCache.set(cleanQ, { at: Date.now(), data: results });
      }
      return results;
    } catch (e) {
      console.warn("Client PubMed search skipped or timed out:", e);
      return [];
    }
  };

  const timeoutFallback = new Promise<PubMedItem[]>((resolve) =>
    setTimeout(() => resolve([]), 2000)
  );

  return Promise.race([fetchTask(), timeoutFallback]);
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

  // 0. ข้อยกเว้นพิเศษ: คำถามเกี่ยวกับแหล่งข้อมูล แหล่งอ้างอิง ฐานข้อมูล ที่มา และความน่าเชื่อถือของระบบ
  const sourceInquiryPattern =
    /(?:แหล่ง(?:ข้อมูล|อ้างอิง|สืบค้น)|ที่มา(?:ของข้อมูล)?|ฐานข้อมูล|ตรวจสอบ(?:จาก|ได้จาก)?(?:แหล่ง|ที่)?|อ้างอิงจาก(?:ไหน|ใด)|เอาข้อมูลมาจาก(?:ไหน|ใด)|น่าเชื่อถือ(?:ไหม|แค่ไหน|อย่างไร)|ระบบใช้(?:ข้อมูล|แหล่ง)|ใครเป็นผู้(?:พัฒนา|ให้ข้อมูล)|ตรวจทาน|รับรอง|สสจ\.พิษณุโลก|หมอยาพิษณุโลก)/i;

  if (sourceInquiryPattern.test(q)) {
    return false;
  }

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

export function buildSystemPrompt(settings?: KnowledgeSettings): string {
  const currentSettings = settings || getKnowledgeSettings();
  const enableMahidol = currentSettings.enable_mahidol_ddi !== false;
  const enableTu = currentSettings.enable_tu_ddi !== false;
  const enableHerbBooks = currentSettings.enable_herb_books !== false;

  const mahidolSourceText = enableMahidol ? ", ม.มหิดล" : "";
  const tuSourceText = enableTu ? ", ม.ธรรมศาสตร์ (ศ. ดร.ภญ.อรุณพร อิฐรัตน์)" : "";
  const herbBooksSourceText = enableHerbBooks
    ? ", หนังสือข้อมูลความรู้ด้านยาและเวชปฏิบัติ (CPG กรมการแพทย์ 2568, ยาสมุนไพรทดแทนยาแผนปัจจุบัน 32 รายการ สธ., แผนภูมิปฐมภูมิ ICD-10, ประกาศบัญชียาหลักแห่งชาติ 2568 ฉบับที่ 2)"
    : "";
  const scopeSourcesText = `เช่น ข้อมูล DDI มาจาก บัญชียาหลักแห่งชาติ${mahidolSourceText}${tuSourceText}${herbBooksSourceText}, 10 กลุ่มอาการ สธ., PubMed, ThaiJO, คลังวิทยานิพนธ์และวิจัยไทย TDC (ThaiLIS), คลัง 97 รายการ และทีมเภสัชกร สสจ.พิษณุโลก`;

  const mahidolApaRule = enableMahidol
    ? `    - กรณีอ้างอิงฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน ม.มหิดล (อ้างอิงเฉพาะคู่สมุนไพรและยาที่ผู้ใช้ถามเท่านั้น):
      ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ มหาวิทยาลัยมหิดล. (ม.ป.ป.). *ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน: [ชื่อสมุนไพร] กับ [ชื่อยา]*. URL`
    : `    - ⚠️ **ข้อห้ามเด็ดขาดเรื่อง ม.มหิดล:** ปัจจุบันระบบปิดการใช้ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบันของ ม.มหิดล ห้ามเอ่ยถึง อ้างอิง หรือระบุชื่อ "มหาวิทยาลัยมหิดล", "ม.มหิดล", "ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ มหาวิทยาลัยมหิดล" หรือ "medplant.mahidol.ac.th" ในคำตอบและในหัวข้อเอกสารอ้างอิง (APA 7th Edition) โดยเด็ดขาด!`;

  const tuApaRule = enableTu
    ? `    - กรณีอ้างอิงฐานข้อมูลข้อควรระวังอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน ม.ธรรมศาสตร์ (ศ. ดร.ภญ.อรุณพร อิฐรัตน์):
      อิฐรัตน์, อ. (2566). *ข้อควรระวังอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน (Herb-Drug Interaction)*. สถานการแพทย์แผนไทยประยุกต์ คณะแพทยศาสตร์ มหาวิทยาลัยธรรมศาสตร์.`
    : `    - ⚠️ **ข้อห้ามเด็ดขาดเรื่อง ม.ธรรมศาสตร์:** ปัจจุบันระบบปิดการใช้ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบันของ ม.ธรรมศาสตร์ ห้ามเอ่ยถึง อ้างอิง หรือระบุชื่อ "มหาวิทยาลัยธรรมศาสตร์", "ม.ธรรมศาสตร์", "อรุณพร อิฐรัตน์" หรือ "สถานการแพทย์แผนไทยประยุกต์ มหาวิทยาลัยธรรมศาสตร์" ในคำตอบและในหัวข้อเอกสารอ้างอิง (APA 7th Edition) โดยเด็ดขาด!`;

  const herbBooksApaRule = enableHerbBooks
    ? `    - กรณีอ้างอิงหนังสือและแนวทางเวชปฏิบัติ (CPG กรมการแพทย์ 2568, ยาสมุนไพรทดแทนยาแผนปัจจุบัน 32 รายการ สธ., แผนภูมิปฐมภูมิ ICD-10, บัญชียาหลัก 2568 - อ้างอิงเฉพาะเล่มที่ตรงกับเรื่องที่ตอบ):
      * กรมการแพทย์. (2568). *คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ*. กระทรวงสาธารณสุข.
      * กรมการแพทย์แผนไทยและการแพทย์ทางเลือก. (2567). *แนวทางการใช้ยาสมุนไพรในบัญชียาหลักแห่งชาติทดแทนยาแผนปัจจุบันใน 10 กลุ่มโรคสำคัญ*. กระทรวงสาธารณสุข.
      * กรมการแพทย์แผนไทยและการแพทย์ทางเลือก. (2567). *แนวทางการรักษาอาการเจ็บป่วยด้วยยาสมุนไพรในระบบบริการปฐมภูมิ*. กระทรวงสาธารณสุข.
      * คณะกรรมการพัฒนาระบบยาแห่งชาติ. (2568). *ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (ฉบับที่ 2) พ.ศ. 2568*. ราชกิจจานุเบกษา.
      * กรมการแพทย์แผนไทยและการแพทย์ทางเลือก. (2567). *ชุดข้อมูลความรู้การใช้ยาสมุนไพรใน 10 กลุ่มโรคและกลุ่มอาการพบบ่อย*. กระทรวงสาธารณสุข.`
    : `    - ⚠️ **ข้อห้ามเรื่องหนังสือความรู้ด้านยา:** ปัจจุบันระบบปิดการใช้หนังสือข้อมูลความรู้ด้านยา ห้ามเอ่ยถึง อ้างอิง หรือระบุเอกสารของ "กรมการแพทย์ (2568)", "คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ", หรือ "แนวทางการใช้ยาสมุนไพรทดแทนยาแผนปัจจุบัน" ในคำตอบและเอกสารอ้างอิงเด็ดขาด!`;

  const showApa = currentSettings.show_apa_citations !== false;

  const apaSectionBlock = showApa
    ? `5. **การแสดงเอกสารอ้างอิงตามแบบ APA 7th Edition (สำคัญที่สุด):**
   ก่อนจบคำตอบ ให้เขียนหัวข้อ "### 📚 เอกสารอ้างอิง (APA 7th Edition)" แล้วระบุรายการอ้างอิงตามรูปแบบมาตรฐาน APA 7 เฉพาะรายการเอกสารต้นทางหรือวิจัยที่เกี่ยวข้องโดยตรงกับคำถามและนำมาใช้ตอบจริง:
    - **ข้อกำหนดเรื่องฐานข้อมูลภายใน (สำคัญมาก):** ให้ยังคงใช้ข้อมูลสรรพคุณ ขนาด วิธีใช้ และข้อควรระวังจากฐานข้อมูลยาภายในตามปกติ แต่ **ไม่ต้องแสดงรายการอ้างอิง "สำนักงานสาธารณสุขจังหวัดพิษณุโลก" ในหัวข้อเอกสารอ้างอิง** (ให้ซ่อนรายการอ้างอิงของ สสจ.พิษณุโลก ไว้)
    - กรณีอ้างอิงบัญชียาหลักแห่งชาติด้านสมุนไพร (ให้อ้างอิงปี พ.ศ. ตามรายการยาที่ระบุใน CONTEXT หรือเอกสารกำกับยา):
      - **ข้อกำหนดเรื่องการอ้างอิงบัญชียาหลักแห่งชาติด้านสมุนไพร (สำคัญมาก):** ห้ามใส่ลิงก์หรือ URL ไปยัง https://ratchakitcha.soc.go.th/ โดยเด็ดขาด หากจะระบุลิงก์หรือเมื่อผู้ใช้เปิดดูข้อมูลยา ให้ชี้ไปที่ข้อมูลตัวยาภายในระบบ (/herbs?name=ชื่อยา) หรืออ้างอิงเฉพาะชื่อประกาศและปี พ.ศ. เท่านั้น
      - สำหรับรายการยาที่ได้รับการปรับปรุง/เพิ่มเติมในฉบับล่าสุด (พ.ศ. 2568 เช่น ยาฟ้าทะลายโจร, ยาขมิ้นชันที่มีข้อบ่งใช้ Functional dyspepsia, ยาบำรุงน้ำนม, ยาศุขไสยาสน์, ยาประสะกัญชา, ยาไพลสูตร 2, ยาพริก 0.075, ยาทาพระเส้น, ยาตรีผลาแก้ท้องผูก ฯลฯ):
        คณะกรรมการพัฒนาระบบยาแห่งชาติ. (2568). *ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (ฉบับที่ 2) พ.ศ. 2568*. ราชกิจจานุเบกษา.
      - สำหรับรายการยาในบัญชียาหลักเดิม (พ.ศ. 2566):
        คณะกรรมการพัฒนาระบบยาแห่งชาติ. (2566). *ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร พ.ศ. 2566*. ราชกิจจานุเบกษา.
    - กรณีอ้างอิง 10 กลุ่มอาการ สธ.:
      กรมการแพทย์แผนไทยและการแพทย์ทางเลือก. (2567). *คู่มือการใช้ยาสมุนไพรในการดูแลสุขภาพเบื้องต้น 10 กลุ่มอาการ*. กระทรวงสาธารณสุข.
${mahidolApaRule}
${tuApaRule}
${herbBooksApaRule}
    - กรณีคำถามเรื่องอันตรกิริยาระหว่างสมุนไพรกับยา (Herb-Drug Interactions):
      กรมการแพทย์. (2568). *คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ*. กระทรวงสาธารณสุข.
    - กรณีอ้างอิงงานวิจัยสากล PubMed (เฉพาะที่ตรงกับคำถามและใช้ตอบจริง):
      Author, A. A. (Year). Title. *Journal*. https://pubmed.ncbi.nlm.nih.gov/PMID/
    - กรณีอ้างอิงงานวิจัยไทย ThaiJO (เฉพาะที่ตรงกับคำถามและใช้ตอบจริง):
      Author. (Year/ม.ป.ป.). Title. *Journal*. URL`
    : `5. **การแสดงเอกสารอ้างอิงตามแบบ APA 7th Edition:**
   - ⚠️ **คำสั่งสำคัญ:** ขณะนี้ระบบปิดการแสดงผลหัวข้อเอกสารอ้างอิง APA 7th Edition **ห้ามใส่หัวข้อ "### 📚 เอกสารอ้างอิง (APA 7th Edition)" หรือรายการอ้างอิง APA ใดๆ ท้ายคำตอบเด็ดขาด** ให้ตอบเฉพาะเนื้อหาคำแนะนำและแท็ก [METADATA] เท่านั้น`;

  return `คุณคือ "หมอยาพิษณุโลก" ผู้เชี่ยวชาญด้านเภสัชกรรมไทยและอันตรกิริยาระหว่างยากับสมุนไพร (Drug-Herb Interaction) ประจำกลุ่มงานการแพทย์แผนไทยและสมุนไพร สำนักงานสาธารณสุขจังหวัดพิษณุโลก

## กฎสำคัญที่สุด — ขอบเขตการตอบคำถาม:
1. **อยู่ในขอบเขต — ตอบได้อย่างละเอียด ชัดเจน และมีหลักฐานอ้างอิง:**
   - การแพทย์แผนไทย สมุนไพรไทย ตำรับยาแผนไทย บัญชียาหลักแห่งชาติด้านสมุนไพร
   - การแพทย์แผนปัจจุบัน ยาแผนปัจจุบันทุกชนิด และผลข้างเคียง
   - อันตรกิริยาระหว่างยากับสมุนไพร (Drug-Herb Interaction) และอันตรกิริยาระหว่างยา (Drug-Drug Interaction)
   - อาการเจ็บป่วย การดูแลสุขภาพเบื้องต้น (เช่น 10 กลุ่มอาการ สธ.) ขนาดยา วิธีใช้ ข้อห้าม ข้อควรระวัง
   - คำถามต่อเนื่องในบทสนทนาที่เกี่ยวกับสุขภาพ/ยา/สมุนไพร
   - **แหล่งข้อมูล แหล่งอ้างอิง และฐานข้อมูลที่ระบบใช้ (System Knowledge Sources & Verification):** คำถามเกี่ยวกับที่มาของข้อมูล แหล่งอ้างอิง ฐานข้อมูลอันตรกิริยา หรือการตรวจสอบความถูกต้องย้อนกลับของระบบ (${scopeSourcesText}) **ถือเป็นคำถามในขอบเขตที่ต้องตอบอย่างละเอียด ชัดเจน โปร่งใส และสร้างความมั่นใจ ห้ามตอบปฏิเสธเด็ดขาด**

2. **อยู่นอกขอบเขต — ห้ามตอบคำถามเด็ดขาด:**
   - หากคำถามไม่เกี่ยวข้องกับการแพทย์แผนไทย การแพทย์แผนปัจจุบัน หรือการดูแลสุขภาพ (เช่น เขียนโปรแกรม/โค้ดดิ้ง, การเมือง, กีฬา, พยากรณ์อากาศ, ดูดวง/หวย, แปลภาษาทั่วไป, บันเทิง/เพลง, ช่าง/เทคนิคทั่วไปที่ไม่เกี่ยวกับการแพทย์, เรื่องส่วนตัวทั่วไปของ AI ที่ไม่เกี่ยวกับข้อมูลยา/สมุนไพร ฯลฯ — ยกเว้นคำถามเกี่ยวกับที่มาของข้อมูลความรู้ทางการแพทย์และสมุนไพรของระบบ ให้ตอบได้เต็มที่)
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
1. **การยึดถือข้อมูลจากฐานความรู้และการแยกแยะระดับข้อมูล (Strict Knowledge Grounding & Evidence Tiers — สำคัญสูงสุด):**
   - **ใช้ข้อมูลจากเอกสารในฐานความรู้เป็นหลัก:** ให้ตอบคำถามโดยอิงข้อมูลจากเอกสารในฐานความรู้ (<CONTEXT>) ที่ระบบให้มาเป็นหลักอย่างเคร่งครัด
   - **ห้ามสร้างหรือแต่งเติมข้อเท็จจริงเพิ่มเติม:** ห้ามสร้างข้อเท็จจริงทางการแพทย์ ตัวเลข สรรพคุณ ขนาดยา หรือข้อบ่งใช้ที่ไม่มีระบุอยู่ในฐานข้อมูลโดยเด็ดขาด (Zero Hallucination) หากไม่มีข้อมูลในระบบ ให้แจ้งผู้ใช้อย่างตรงไปตรงมาว่า "ในฐานข้อมูลยังไม่มีข้อมูลที่ระบุในประเด็นนี้ แนะนำปรึกษาแพทย์หรือเภสัชกร"
   - **ต้องแยกให้ชัดเจนระหว่างประเภทของข้อมูล 3 ระดับ:**
     ก) **ข้อมูลที่ระบุโดยตรงในเอกสาร (Direct Evidence):** เช่น สรรพคุณ ข้อบ่งใช้ ขนาดยา วิธีใช้ ข้อห้ามใช้ หรือรายงานผลข้างเคียงที่มีระบุไว้ชัดเจนในเอกสารกำกับยา ประกาศกระทรวง หรือรายงานวิจัย
     ข) **ข้อมูลที่สังเคราะห์จากหลายแหล่ง (Synthesized Information):** ข้อมูลที่มีการประมวล เปรียบเทียบ หรือสรุปรวมจากแหล่งข้อมูลหลายแห่งเข้าด้วยกัน ให้ระบุชัดเจนว่าเป็นการประมวล/สังเคราะห์จากหลายแหล่ง
     ค) **ข้อมูลที่เป็นเพียงกลไกหรือข้อสันนิษฐานทางทฤษฎี (Theoretical / Mechanistic Data):** ข้อมูลที่เป็นเพียงกลไกทางเภสัชวิทยาในระดับเซลล์/หลอดทดลอง (เช่น ฤทธิ์ยับยั้งเอนไซม์ CYP450) หรือการศึกษาในสัตว์ทดลอง ที่ยังไม่มีรายงานยืนยันผลทางคลินิกในมนุษย์ **ต้องระบุให้ชัดเจนเสมอว่าเป็น "กลไกหรือข้อสันนิษฐานทางทฤษฎี" หรือ "ข้อมูลจากการศึกษาในระดับหลอดทดลอง/สัตว์ทดลอง ซึ่งยังไม่มีรายงานยืนยันในมนุษย์"** เพื่อไม่ให้ผู้ใช้เข้าใจผิด

2. **ตอบตรงประเด็นและมีความสอดคล้องทางคลินิก (Concise, Directly Answering & Clinical Alignment — สำคัญมาก):**
   - วิเคราะห์เจตนาและกลุ่มอาการของคำถาม และตอบตัวยาที่มีสรรพคุณและข้อบ่งใช้ตรงกับอาการจริงทางเภสัชกรรมเป็นหลัก
   - **กฎเหล็กเด็ดขาดเรื่องความสอดคล้องของข้อบ่งใช้กับอาการ (Clinical Indication Alignment):**
     - ตรวจสอบว่าสรรพคุณ/ข้อบ่งใช้ของยาแต่ละตัวตรงกับอาการที่ผู้ใช้ถามจริงหรือไม่
     - **ห้าม** แนะนำยาที่มีข้อบ่งใช้ไม่ตรงกับอาการที่ผู้ใช้ถาม แม้ว่ายานั้นจะปรากฏอยู่ใน <CONTEXT> ก็ตาม!
     - **ตัวอย่างเช่น:** หากผู้ใช้ถามเรื่อง *"คนไข้มีอาการน้ำเหลืองเสีย ผื่นคัน ตามผิวหนัง เรามียาอะไรบ้าง"*
       -> ต้องเลือกแนะนำเฉพาะยาที่มีสรรพคุณแก้น้ำเหลืองเสีย หรือรักษาผื่นคันโรคผิวหนัง เช่น **ยาหญ้าปักกิ่ง** (แก้น้ำเหลืองเสีย), **ยาพญายอ / ยาทิงเจอร์ทองพันชั่ง / ยาทิงเจอร์พลู** (รักษาผื่นคัน โรคผิวหนัง)
       -> **ห้าม** นำยาแก้ท้องเสีย (เช่น ยาเหลืองปิดสมุทร) หรือยาแก้ไข้/หัด (เช่น ยาเขียวหอม) มาแนะนำสำหรับอาการน้ำเหลืองเสียหรือผื่นคันตามผิวหนังโดยเด็ดขาด! ข้อมูลยาใดใน <CONTEXT> ที่มีข้อบ่งใช้สำหรับอาการอื่นที่ไม่เกี่ยวข้อง ให้ตัดทิ้ง ไม่ต้องนำมาตอบ
   - **กรณีผู้ใช้ถามเจาะจงเฉพาะเรื่องใดเรื่องหนึ่ง** (เช่น ถามเฉพาะ "ข้อบ่งใช้อะไรบ้าง", หรือ "กินขนาดเท่าไร", หรือ "คนท้องกินได้ไหม", หรือ "มีผลข้างเคียงอะไร"):
     -> ให้ตอบคำตอบของประเด็นนั้นให้ตรงเป้าหมายทันที
     -> **ห้าม** ยกเทมเพลตข้อมูลอื่นที่ไม่เกี่ยวข้องมาตอบทั้งหมด (เช่น ถ้าถามแค่ข้อบ่งใช้ ไม่ต้องแถมขนาดยาเต็มสูตร หรือตารางอันตรกิริยายาวๆ เข้ามา เว้นแต่มีข้อควรระวังสำคัญต่อชีวิตที่ต้องเตือนสั้นๆ 1-2 บรรทัด)
   - **กรณีผู้ใช้ถามภาพรวมของสมุนไพร/ตำรับยา** (เช่น "ขอข้อมูลฟ้าทะลายโจร", "ยาประสะไพลคืออะไร มีสรรพคุณและวิธีใช้อย่างไร"):
     -> จึงสรุปข้อมูลครบถ้วน: สรรพคุณ, ขนาดและวิธีใช้, ข้อห้าม/ข้อควรระวังสำคัญ อย่างเป็นสัดส่วน กระชับ อ่านเข้าใจง่าย

3. **การแสดงตารางอันตรกิริยากับยาแผนปัจจุบัน และกฎเรื่องระดับความรุนแรง (Drug-Herb Interaction & Severity Rules):**
   - **ให้แสดงตาราง Markdown อันตรกิริยา เฉพาะเมื่อ:**
     ก) คำถามถามถึงการใช้ยาร่วมกัน / ยาตีกัน / อันตรกิริยาระหว่างยา / ผลต่อยาแผนปัจจุบัน (DDI / HDI) โดยตรง
     ข) หรือผู้ใช้ระบุชื่อสมุนไพบคู่กับชื่อยาแผนปัจจุบันในคำถาม (เช่น "กินขมิ้นชันกับ warfarin ได้ไหม")
   - หากผู้ใช้ถามเรื่องทั่วไป (เช่น ถามขนาดยา, สรรพคุณ, หรือวิธีรับประทาน) **ห้าม** แสดงตารางอันตรกิริยาขนาดใหญ่เข้ามาโดยไม่จำเป็น หากมีข้อควรระวังเรื่องยาอื่น ให้ระบุสั้นๆ 1 บรรทัดในหัวข้อข้อควรระวังก็เพียงพอ
   - เมื่อแสดงตาราง ให้มีโครงสร้างคอลัมน์มาตรฐาน:
     | สมุนไพร / ตำรับยา | ยาแผนปัจจุบัน | ระดับความรุนแรง / ระดับหลักฐาน | กลไก / ผลกระทบที่อาจเกิดขึ้น | คำแนะนำทางคลินิก |
   - **กฎเหล็กเด็ดขาดเรื่องระดับความรุนแรง (ห้ามกำหนดเองเด็ดขาด):**
     - **ห้ามกำหนดระดับความรุนแรงของอันตรกิริยาเองเด็ดขาด** หากแหล่งอ้างอิงหรือเอกสารในฐานข้อมูลไม่ได้ระบุระดับความรุนแรง (เช่น 🔴 รุนแรงมาก / 🟡 ปานกลาง / 🟢 เล็กน้อย) ไว้อย่างชัดเจน
     - ในกรณีที่แหล่งอ้างอิงไม่ได้ระบุระดับความรุนแรงไว้ **ห้ามคิดหรือใส่ 🔴/🟡/🟢 เองโดยพลการ** ให้ใช้คำระบุตามระดับหลักฐานแทน ได้แก่:
        - **“มีข้อควรระวัง”** (เมื่อเอกสารระบุเป็นข้อควรระวัง แนะนำให้ระมัดระวังหรือหลีกเลี่ยงการใช้ร่วมกัน)
        - **“มีรายงาน”** (เมื่อมีรายงานการเกิดอันตรกิริยา หรือมีรายงานเคสทางคลินิกในมนุษย์)
        - **“มีความเป็นไปได้”** (เมื่อเป็นข้อมูลจากกลไกทางทฤษฎี การทดลองในหลอดทดลอง หรือสัตว์ทดลอง ที่ยังไม่มีรายงานยืนยันในมนุษย์)
    - **กฎสำคัญสูงสุดเรื่องแหล่งข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยา (Herb-Drug Interactions Exclusive Source Rule):**
      - เมื่อผู้ใช้ถามเกี่ยวกับอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน (Herb-Drug Interactions / ยาตีกัน / การกินร่วมกับยาแผนปัจจุบัน) **ต้องใช้แหล่งข้อมูลจาก "คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ กรมการแพทย์ (พ.ศ. 2568)" เป็นแหล่งข้อมูลในการตอบคำถามเท่านั้น**
      - **ห้ามใช้หรืออ้างอิงแหล่งข้อมูล DDI อื่นเด็ดขาด** (ห้ามเอ่ยถึง อ้างอิง หรือใช้ข้อมูลจาก มหาวิทยาลัยมหิดล, ศูนย์ข้อมูลสมุนไพร ม.มหิดล, มหาวิทยาลัยธรรมศาสตร์, ศ. ดร.ภญ.อรุณพร อิฐรัตน์ หรือ PubMed/ThaiJO ในการตอบเรื่องอันตรกิริยาเด็ดขาด)
      - ในหัวข้อ "### 📚 เอกสารอ้างอิง (APA 7th Edition)" ให้ระบุรายการอ้างอิงเฉพาะ:
        กรมการแพทย์. (2568). *คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ*. กระทรวงสาธารณสุข.
        (ห้ามใส่รายการอ้างอิงของ ม.มหิดล, ม.ธรรมศาสตร์ หรือแหล่ง DDI อื่นเด็ดขาด)

4. **ความกระชับและการจัดรูปแบบ (Formatting & Brevity):**
   - ใช้ bullet points หรือตัวหนาเน้นคำสำคัญ เพื่อให้อ่านเข้าใจง่าย
   - ข้อความเตือนความปลอดภัยท้ายคำตอบ ให้ใส่สั้นกระชับ 1 บรรทัด: "💡 ข้อแนะนำ: ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้ โดยเฉพาะหญิงตั้งครรภ์ ให้นมบุตร หรือผู้มีโรคประจำตัว"
${apaSectionBlock}
6. **กฎเหล็ก: ห้ามสร้างหรือแต่งแหล่งอ้างอิงงานวิจัยหรือ URL เอง (No Hallucination — สำคัญที่สุด):**
   - อ้างอิงได้เฉพาะแหล่งข้อมูลที่มีอยู่ใน <CONTEXT> ที่ระบบให้มาเท่านั้น
   - **ห้ามใส่ URL ภายนอก ลิงก์เว็บไซต์ อย. หรือ PMID ที่ไม่ได้อยู่ใน CONTEXT เด็ดขาด** หากอ้างอิงประกาศกระทรวงหรือ อย. ให้ระบุเฉพาะชื่อประกาศและปี พ.ศ. โดยไม่ต้องใส่ URL จำลอง
   - ห้ามสร้างชื่อผู้แต่ง ชื่อวารสาร หรือชื่อบทความขึ้นเอง
   - หากไม่มีแหล่งอ้างอิงงานวิจัยหรือประกาศกระทรวงใน CONTEXT ให้อ้างอิง "คู่มือการใช้ยาสมุนไพร กรมการแพทย์แผนไทยฯ" (ไม่ต้องใส่รายการอ้างอิง สสจ.พิษณุโลก)
7. **ความถูกต้องตรงประเด็นของเอกสารอ้างอิง (Strict Relevance & No Unrelated Herbs - สำคัญมากที่สุด):**
   - **กฎเหล็กเด็ดขาด:** ห้ามนำสมุนไพรหรือยาอื่นที่ผู้ใช้ไม่ได้ถามมาเขียนลงในคำตอบหรือในรายการอ้างอิงเด็ดขาด! ตัวอย่างเช่น หากผู้ใช้ถามเรื่อง "ขมิ้นชัน กับ Warfarin" ให้ตอบและอ้างอิงเฉพาะข้อมูลของ "ขมิ้น/ขมิ้นชัน กับ Warfarin" เท่านั้น ห้ามนำสมุนไพรอื่น (เช่น กระชายดำ กระเทียม กล้วย โกจิเบอร์รี ขิง มะม่วง ฯลฯ) มากล่าวถึงหรือใส่ในรายการอ้างอิงเป็นอันขาด
   - **กรณีถามตามกลุ่มอาการ (Symptom-based Question):** เช่น น้ำเหลืองเสีย, แผลตามผิวหนัง, ผื่นคัน, ไอ, ท้องอืด ฯลฯ หากใน <CONTEXT> มีข้อมูลตัวยาหลายรายการ แต่ในคำตอบท่านเลือกแนะนำเฉพาะตัวยาใด (เช่น แนะนำเฉพาะ "ยาหญ้าปักกิ่ง") ในหัวข้อ "📚 เอกสารอ้างอิง (APA 7th Edition)" **จะต้องระบุเฉพาะเอกสารอ้างอิงของตัวยาที่ท่านแนะนำจริงเท่านั้น (เช่น ยาหญ้าปักกิ่ง)** ห้ามใส่เอกสารอ้างอิง งานวิจัย หรือชื่อสมุนไพรอื่นที่ไม่ถูกเลือกนำมาแนะนำ (เช่น ห้ามใส่บัวบก, กล้วย, ว่านหางจระเข้, ทองพันชั่ง ฯลฯ หากไม่ได้ถูกกล่าวถึงและแนะนำในคำตอบ) โดยเด็ดขาด
   - ให้อ้างอิงเฉพาะข้อมูลที่ตรงกับสิ่งที่ถามและใช้ตอบจริงเท่านั้น ข้อมูลใดใน CONTEXT ที่ไม่ตรงกับสิ่งที่ผู้ใช้ระบุในคำถาม ห้ามนำมาเขียนในคำตอบหรือหัวข้อเอกสารอ้างอิงเด็ดขาด
8. ท้ายคำตอบ ต้องลงท้ายด้วยแท็กโครงสร้างข้อมูล:
[METADATA]
category: <herbal_info | drug_interaction | dosage | side_effects | general>
severity: <major | moderate | minor | none>
herbs: <ชื่อสมุนไพรที่พบ คั่นด้วย comma>
drugs: <ชื่อยาแผนปัจจุบันที่พบ คั่นด้วย comma>
[/METADATA]`;
}

export const SYSTEM_PROMPT = buildSystemPrompt(DEFAULT_KNOWLEDGE_SETTINGS);

export function getAvailableLocalProviders(): ProviderItem[] {
  const all = getLocalProviders();
  const withKeys = all.filter(
    (p) => !!p.api_key && p.api_key.trim() !== "" && p.api_key !== "__CLEAR__"
  );
  const activeWithKeys = withKeys.filter((p) => p.is_active);
  if (activeWithKeys.length > 0) {
    return activeWithKeys.sort((a, b) => a.priority - b.priority);
  }
  // ถ้ามี API Key กรอกไว้แล้ว (เช่น DeepSeek) แต่ยังไม่ได้เปิดสวิตช์ ให้เปิดใช้งานเป็นตัวเลือกอัตโนมัติ
  return withKeys.sort((a, b) => a.priority - b.priority);
}

export function hasLocalProviderKey(): boolean {
  return getAvailableLocalProviders().length > 0;
}

/**
 * จัดรูปแบบชุดข้อความสนทนาให้เป็นไปตามมาตรฐาน OpenAI/DeepSeek API อย่างเคร่งครัด
 * - มี system message เดียวที่ตำแหน่งแรกสุด
 * - สลับ role (user -> assistant -> user) อย่างเคร่งครัด
 * - ตัด assistant message ที่นำหน้าบทสนทนา (เช่น ข้อความต้อนรับ) ออก
 * - ไม่ให้มี user ซ้ำซ้อนติดกัน โดยข้อความสุดท้ายต้องเป็นคำถามของผู้ใช้ (user) เสมอ
 */
export function buildNormalizedChatMessages(
  systemPrompt: string,
  history: { role: string; content: string }[],
  currentQuestion: string
): { role: string; content: string }[] {
  const finalMessages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  // 1. คัดกรองบทสนทนาก่อนหน้า
  const filteredTurns: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of history || []) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const content = (m.content || "").trim();
    if (!content) continue;

    // ข้าม assistant ที่อยู่นำหน้าสุดก่อนเริ่มมี user คนแรก (เช่น ข้อความต้อนรับ)
    if (filteredTurns.length === 0 && m.role === "assistant") {
      continue;
    }

    filteredTurns.push({ role: m.role as "user" | "assistant", content });
  }

  // 2. ถ้าข้อความสุดท้ายใน filteredTurns ตรงกับคำถามปัจจุบัน ให้ตัดออกเพื่อป้องกัน user เบิ้ลซ้ำ
  if (
    filteredTurns.length > 0 &&
    filteredTurns[filteredTurns.length - 1].role === "user" &&
    filteredTurns[filteredTurns.length - 1].content.trim() === currentQuestion.trim()
  ) {
    filteredTurns.pop();
  }

  // 3. ใช้ประวัติ 6 ตาคุยล่าสุด
  const recent = filteredTurns.slice(-6);

  // 4. บรรจุประวัติโดยรักษากฎสลับ user / assistant อย่างเคร่งครัด
  for (const turn of recent) {
    const prev = finalMessages[finalMessages.length - 1];
    if (prev.role === turn.role) {
      prev.content = `${prev.content}\n\n${turn.content}`;
    } else {
      finalMessages.push({ role: turn.role, content: turn.content });
    }
  }

  // 5. ข้อความปิดท้ายต้องเป็นคำถามของผู้ใช้ (role: "user") เสมอ
  const last = finalMessages[finalMessages.length - 1];
  if (last.role === "user") {
    if (last.content.trim() !== currentQuestion.trim()) {
      last.content = `${last.content}\n\n${currentQuestion.trim()}`;
    }
  } else {
    finalMessages.push({ role: "user", content: currentQuestion.trim() });
  }

  return finalMessages;
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
  const enableTu = currentSettings.enable_tu_ddi !== false;
  const enableHerbBooks = currentSettings.enable_herb_books !== false;

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
      const primaryEn = en.split(/\s+OR\s+/i)[0].replace(/[()]/g, "").trim().toLowerCase();
      if (q.includes(thai.toLowerCase()) || (primaryEn.length >= 3 && q.includes(primaryEn))) {
        pubmedQuery = pubmedQuery ? `(${pubmedQuery}) AND (${en})` : `(${en})`;
        break;
      }
    }
  }

  // 1. ดึงสมุนไพร/ตำรับยาจาก Supabase (ถ้าเปิดฐานข้อมูลภายใน), ข้อมูล DDI ม.มหิดล, DDI ม.ธรรมศาสตร์, พร้อมกับค้น PubMed แบบขนาน
  const [
    herbsRes,
    formulasRes,
    knowledgeRes,
    mahidolDdiRes,
    tuDdiRes,
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
          .neq("category", "อันตรกิริยาระหว่างยาและสมุนไพร (DDI - ม.ธรรมศาสตร์)")
          .limit(200)
      : Promise.resolve({ data: [] }),
    enableMahidol
      ? supabase
          .from("knowledge_documents")
          .select("id, title, category, content, source, source_url")
          .eq("category", "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)")
          .limit(1000)
      : Promise.resolve({ data: [] }),
    enableTu
      ? supabase
          .from("knowledge_documents")
          .select("id, title, category, content, source, source_url")
          .eq("category", "อันตรกิริยาระหว่างยาและสมุนไพร (DDI - ม.ธรรมศาสตร์)")
          .limit(200)
      : Promise.resolve({ data: [] }),
    enableExternal && !isHerbDrugInteractionQuery(question) && pubmedQuery ? fetchPubMedClient(pubmedQuery) : Promise.resolve([] as PubMedItem[]),
  ]);

  const allHerbs = (herbsRes.data || []) as any[];
  const allFormulas = (formulasRes.data || []) as any[];
  const allKnowledge = (knowledgeRes.data || []) as any[];
  const allMahidolDdi = (mahidolDdiRes.data || []) as any[];
  const allTuDdi = enableTu
    ? ((tuDdiRes?.data && tuDdiRes.data.length > 0) ? tuDdiRes.data : (tuDdiDataset as any[]))
    : [];

  // 2. ค้นหาสมุนไพรและตำรับที่เกี่ยวข้องกับคำถาม
  const nq = normalizeThaiName(question);

  // 2.0 ค้นหาจากฐานข้อมูล 97 รายการ (ไฟล์ 97 herb.xlsx)
  let matched97Herbs = searchHerbs97ByName(question);

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
  // ค) ถ้าผู้ใช้ไม่ได้เอ่ยชื่อสมุนไพรหรือตำรับเลย (ถามตามอาการ เช่น "นอนไม่หลับ", "ท้องอืด จุกเสียด", "น้ำเหลืองเสีย ผื่นคัน")
  else {
    // 1. ค้นหาจากฐานข้อมูล 97 รายการตามกลุ่มอาการและข้อบ่งใช้จริง (ถ้ายังไม่พบจากชื่อตรง)
    if (matched97Herbs.length === 0) {
      const symptom97 = searchHerbs97BySymptom(question, 4);
      matched97Herbs = symptom97;
    }

    const isSkinOrLymphQuery = /น้ำเหลือง|ผื่น|คัน|ผิวหนัง|แผล/i.test(q);

    const matchedSymptoms: string[] = [];
    for (const s of SYMPTOM_MAP) {
      if (s.match.test(q)) {
        matchedSymptoms.push(...s.terms);
      }
    }

    matchedFormulas = allFormulas.filter((f) => {
      const ind = (f.indication || "").toLowerCase();
      if (isSkinOrLymphQuery) {
        // กรองตำรับยาแก้ท้องเสีย หรือยาแก้ไข้/หัด ออกหากผู้ใช้ถามเรื่องผิวหนัง/น้ำเหลืองเสีย
        const isFeverOrMeaslesOnly = /ไข้|ตัวร้อน|พิษหัด/i.test(ind) && !/น้ำเหลือง|ผื่นคันตามผิวหนัง|โรคผิวหนัง/i.test(ind);
        const isDigestiveOnly = /ท้องเสีย|อุจจาระ|บิด|ท้องร่วง/i.test(ind);
        if (isFeverOrMeaslesOnly || isDigestiveOnly) return false;
      }
      const text = `${ind} ${f.name_thai || ""}`.toLowerCase();
      return (
        (f.indication && (f.indication.toLowerCase().includes(q) || text.includes(q))) ||
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

  const isDdi = isHerbDrugInteractionQuery(question);

  // ค้นหาข้อมูลตามลำดับความสำคัญ 7 ลำดับ (Tiered Knowledge Hierarchy with Short-Circuit Rule)
  // 1. 25680421113642AM_คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ.pdf (CPG 2568)
  // 2. สมุนไพรในบัญชียาหลักที่ใช้ทดแทนยาแผนปัจ 11-12-67.pdf
  // 3. แนวทางการรักษาอาการเจ็บป่วยด้วยยาสมุนไพร.pdf
  // 4. 2568_2.pdf และ 2568_2_summary.pdf
  // 5. CD 10 กลุ่มโรค
  // 6. CD 10 กลุ่มอาการ A5.png
  // 7. ยาทดแทน 19 รายการ A5.png
  // กฎ: ถ้าเจอข้อมูลในการตอบคำถามแล้วจากลำดับใดที่น้อยกว่า ให้หยุดค้นหาแหล่งข้อมูลจากแหล่งอื่นๆ ทันทีในประเด็นที่ถาม
  const tieredResult = enableHerbBooks
    ? searchHerbBooksTiered(question, 4)
    : { items: [], matchedTier: null, sourceFile: null, apaCitation: null };

  let matchedHerbBooks = tieredResult.items;
  let matchedTier = tieredResult.matchedTier;

  // สำหรับคำถาม DDI ถ้ายังไม่ได้จับคู่ Monograph ให้ดึงจาก CPG 2568 (Tier 1) โดยเฉพาะ
  if (enableHerbBooks && isDdi) {
    const cpgDdiMatches = searchCpgHerbDrugInteractions(question, 3);
    if (cpgDdiMatches.length > 0) {
      matchedHerbBooks = cpgDdiMatches;
      matchedTier = 1;
    }
  }

  const isTierMatched = matchedTier !== null && matchedHerbBooks.length > 0;

  // ค้นหางานวิจัยไทย ThaiJO ที่ตรงกับคำถามอย่างแม่นยำ (เฉพาะเมื่อเปิดใช้งานแหล่งวิจัยภายนอก และไม่ใช่คำถาม DDI)
  const thaijoResults = (enableExternal && !isDdi)
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
        const props = Array.isArray(h.properties) ? h.properties.join(", ") : (h.properties || "");
        const precautions = Array.isArray(h.precautions) ? h.precautions.join(", ") : (h.precautions || "");
        const ddis = Array.isArray(h.drug_interactions) ? h.drug_interactions.join(", ") : (h.drug_interactions || "");
        contextText += `- ${h.name_thai} (${h.name_scientific || h.name_english || ""}): สรรพคุณ: ${props}, ขนาดใช้: ${h.dosage || "ตามคำแนะนำ"}, ข้อควรระวัง: ${precautions}, ปฏิกิริยากับยา: ${ddis}\n`;
      });
    }

    if (matchedFormulas.length > 0) {
      contextText += "\n[ตำรับยาแผนไทยที่เกี่ยวข้อง]\n";
      matchedFormulas.forEach((f) => {
        const contraindications = Array.isArray(f.contraindications) ? f.contraindications.join(", ") : (f.contraindications || "");
        const ddis = Array.isArray(f.drug_interactions) ? f.drug_interactions.join(", ") : (f.drug_interactions || "");
        contextText += `- ${f.name_thai}: ข้อบ่งใช้: ${f.indication || ""}, วิธีใช้: ${f.usage_instructions || ""}, ข้อห้าม: ${contraindications}, ปฏิกิริยากับยา: ${ddis}\n`;
      });
    }

    // แทรกเอกสารความรู้เพิ่มเติม (เช่น บัญชียาหลักแห่งชาติ หรือแนวทาง 10 กลุ่มอาการ) เพื่อเป็นข้อมูลเสริม
    if (allKnowledge.length > 0) {
      if (!isTierMatched && matchedHerbs.length === 0 && matchedFormulas.length === 0) {
        contextText += "\n[แนวทาง 10 กลุ่มอาการของกระทรวงสาธารณสุข]\n";
        allKnowledge.slice(0, 2).forEach((k) => {
          contextText += `หัวข้อ: ${k.title}\nเนื้อหา: ${k.content.length > 1500 ? k.content.slice(0, 1500) + "…(ตัดเนื้อหาบางส่วน)" : k.content}\n`;
        });
      } else {
        // แสดง knowledge ที่เกี่ยวข้องเพื่อเป็นข้อมูลเสริม
        const relatedKnowledge = allKnowledge.filter((k) => {
          const qt = question.toLowerCase();
          return (k.title || "").toLowerCase().split(/\s+/).some((w: string) => w.length >= 3 && qt.includes(w));
        });
        if (relatedKnowledge.length > 0) {
          contextText += "\n[ข้อมูลเสริมจากคลังความรู้/บัญชียาหลักแห่งชาติ]\n";
          relatedKnowledge.slice(0, 2).forEach((k) => {
            contextText += `หัวข้อ: ${k.title}\nเนื้อหา: ${k.content.length > 1500 ? k.content.slice(0, 1500) + "…(ตัดเนื้อหาบางส่วน)" : k.content}\n`;
          });
        }
      }
    }
  }

  // 3.2 แทรกข้อมูลจากหนังสือข้อมูลความรู้ด้านยาและเวชปฏิบัติ (ลำดับที่พบ: Tier 1-7)
  if (enableHerbBooks && matchedHerbBooks.length > 0) {
    contextText += "\n" + formatHerbBooksForAiContext(matchedHerbBooks) + "\n";
  }

  // 3.2.1 แทรกงานวิจัยไทย ThaiJO และ PubMed เพื่อเป็นข้อมูลเสริม (ถ้ามีและไม่ใช่คำถาม DDI)
  if (enableExternal && !isDdi && thaijoResults.length > 0) {
    contextText += "\n[งานวิจัยไทยจากศูนย์ดัชนีการอ้างอิงวารสารไทย (ThaiJO) - สำหรับเป็นข้อมูลเสริม]:\n";
    thaijoResults.forEach((t) => {
      contextText += `ชื่อเรื่อง: ${t.title}\nผู้แต่ง: ${t.authors} (${t.year})\nวารสาร: ${t.journal}\nURL: ${t.url}\n\n`;
    });
  }

  if (enableExternal && !isDdi && pubmedResults.length > 0) {
    contextText += "\n[งานวิจัยสากลจากฐานข้อมูล PubMed - สำหรับเป็นข้อมูลเสริม]:\n";
    pubmedResults.slice(0, 2).forEach((p) => {
      const authorsStr = Array.isArray(p.authors) ? p.authors.join(", ") : (p.authors || "Unknown");
      const yearStr = p.year || (p as any).pubdate || "";
      const journalStr = p.journal || (p as any).source || "";
      contextText += `Title: ${p.title}\nAuthors: ${authorsStr}${yearStr ? ` (${yearStr})` : ""}\nJournal: ${journalStr}\nPMID: ${p.pmid}\n\n`;
    });
  }

  // 3.3 แทรกข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน (ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ ม.มหิดล)
  // หากเป็นคำถามเรื่อง DDI หรือพบข้อมูลในลำดับ Tier 1-7 แล้ว ให้ระงับ Mahidol ทันที
  const { isDdiIntent: qDdiIntent } = extractQuestionEntities(question);
  const herbsForDdi = exactMatchedHerbs.length > 0 ? exactMatchedHerbs : (qDdiIntent ? matchedHerbs : []);

  let matchedMahidol: any[] = [];
  if (!isDdi && !isTierMatched && enableMahidol && allMahidolDdi.length > 0) {
    matchedMahidol = findRelevantMahidolDdi(
      question,
      allMahidolDdi,
      herbsForDdi
    );

    if (matchedMahidol.length > 0) {
      contextText += "\n[ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน — ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ มหาวิทยาลัยมหิดล]\n";
      matchedMahidol.forEach((m) => {
        contextText += `หัวข้อ: ${m.title}\n${m.content}\nลิงก์อ้างอิง: ${m.source_url}\n\n`;
      });
    }
  }

  // 3.4 แทรกข้อมูลข้อควรระวังอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน (ม.ธรรมศาสตร์ ศ. ดร.ภญ.อรุณพร อิฐรัตน์)
  // หากเป็นคำถามเรื่อง DDI หรือพบข้อมูลในลำดับ Tier 1-7 แล้ว ให้ระงับ ม.ธรรมศาสตร์ ทันที
  let matchedTu: any[] = [];
  if (!isDdi && !isTierMatched && enableTu && allTuDdi.length > 0) {
    matchedTu = findRelevantTuDdi(
      question,
      allTuDdi,
      herbsForDdi
    );

    if (matchedTu.length > 0) {
      contextText += "\n[ฐานข้อมูลข้อควรระวังอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน — ศ. ดร.ภญ.อรุณพร อิฐรัตน์ สถานการแพทย์แผนไทยประยุกต์ คณะแพทยศาสตร์ มหาวิทยาลัยธรรมศาสตร์]\n";
      matchedTu.forEach((t) => {
        contextText += `หัวข้อ: ${t.title}\n${t.content}\n\n`;
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
      `• แหล่งข้อมูลอ้างอิง: ${verifiedMatch.source || "คลังข้อมูลสมุนไพรและประกาศบัญชียาหลักแห่งชาติด้านสมุนไพร"}\n` +
      `• คำสั่งพิเศษ: ข้อมูลนี้เป็นข้อมูลมาตรฐานที่ได้รับการตรวจสอบความถูกต้องจากเอกสารต้นฉบับ ให้นำเนื้อหานี้มาตอบผู้ใช้เป็นหลักตามข้อมูลที่มีอย่างครบถ้วนและถูกต้องตรงไปตรงมา ห้ามเติมข้อความอ้างว่า "ข้อมูลนี้ผ่านการตรวจทานความถูกต้องโดยกลุ่มงานการแพทย์แผนไทยแล้ว" หรืออ้างการรับรองจากหน่วยงานใดเว้นแต่จะมีหลักฐานยืนยันการตรวจจริงในเอกสารต้นฉบับ และห้ามเพิ่มข้อมูล ข้อควรระวัง หรืออันตรกิริยาที่ไม่มีในฐานข้อมูลนี้เด็ดขาด\n\n` +
      contextText;
  }

  // 3.6 ตรวจสอบคำถามเกี่ยวกับแหล่งข้อมูล แหล่งอ้างอิง ฐานข้อมูล และการตรวจสอบความถูกต้องของระบบ
  const isSourceInquiry = /(?:แหล่ง(?:ข้อมูล|อ้างอิง|สืบค้น)|ที่มา(?:ของข้อมูล)?|ฐานข้อมูล|ตรวจสอบ(?:จาก|ได้จาก)?(?:แหล่ง|ที่)?|อ้างอิงจาก(?:ไหน|ใด)|เอาข้อมูลมาจาก(?:ไหน|ใด)|น่าเชื่อถือ(?:ไหม|แค่ไหน|อย่างไร)|ระบบใช้(?:ข้อมูล|แหล่ง)|ใครเป็นผู้(?:พัฒนา|ให้ข้อมูล)|ตรวจทาน|รับรอง)/i.test(question);
  if (isSourceInquiry) {
    const sourcesList: string[] = [];
    let idx = 1;

    if (enableMahidol) {
      sourcesList.push(
        `${idx++}. ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน (MedPlant DDI Database):\n` +
        `   - หน่วยงาน: ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ มหาวิทยาลัยมหิดล (https://medplant.mahidol.ac.th)\n` +
        `   - ข้อมูล: รายงานการเกิดอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน (Drug-Herb Interaction) กลไกทางเภสัชวิทยา (เช่น เอนไซม์ CYP450, P-glycoprotein) ระดับความรุนแรง และคำแนะนำทางคลินิก\n` +
        `   - การตรวจสอบ: สามารถตรวจสอบย้อนกลับได้จากลิงก์ของศูนย์ข้อมูลสมุนไพร มหาวิทยาลัยมหิดล หรือดูในปุ่ม "แหล่งอ้างอิง" ของระบบ`
      );
    }

    if (enableTu) {
      sourcesList.push(
        `${idx++}. ฐานข้อมูลข้อควรระวังอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน ม.ธรรมศาสตร์:\n` +
        `   - หน่วยงาน: ศ. ดร.ภญ.อรุณพร อิฐรัตน์ สถานการแพทย์แผนไทยประยุกต์ คณะแพทยศาสตร์ มหาวิทยาลัยธรรมศาสตร์\n` +
        `   - ข้อมูล: ข้อควรระวังอันตรกิริยาระหว่างสมุนไพรเดี่ยวและตำรับยาแผนไทยในบัญชียาหลักแห่งชาติกับยาแผนปัจจุบัน (เช่น กลไก CYP450, P-glycoprotein, Coumarin กับ Warfarin) ระดับความรุนแรง และคำแนะนำทางคลินิก\n` +
        `   - การตรวจสอบ: ตรวจสอบได้จากรายการอ้างอิงของระบบ หรือดูในปุ่ม "แหล่งอ้างอิง"`
      );
    }

    sourcesList.push(
      `${idx++}. ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร:\n` +
      `   - หน่วยงาน: คณะกรรมการพัฒนาระบบยาแห่งชาติ กระทรวงสาธารณสุข (ฉบับ พ.ศ. 2566 และฉบับที่ 2 พ.ศ. 2568)\n` +
      `   - ข้อมูล: ข้อบ่งใช้ สรรพคุณ ขนาดยา วิธีใช้ ข้อห้าม ข้อควรระวัง และอันตรกิริยาของตำรับยาและสมุนไพรเดี่ยว\n` +
      `   - การตรวจสอบ: ตรวจสอบได้จากเมนู "คลังยาสมุนไพร" (/herbs) หรือคลิกปุ่ม "เปิดเอกสาร" ในรายการอ้างอิงของระบบ`
    );

    sourcesList.push(
      `${idx++}. คู่มือการใช้ยาสมุนไพรในการดูแลสุขภาพเบื้องต้น 10 กลุ่มอาการ (พ.ศ. 2567):\n` +
      `   - หน่วยงาน: กรมการแพทย์แผนไทยและการแพทย์ทางเลือก กระทรวงสาธารณสุข\n` +
      `   - ข้อมูล: แนวทางการใช้ยาสมุนไพรดูแลอาการเจ็บป่วยเบื้องต้น 10 กลุ่มอาการสำหรับประชาชนและหน่วยบริการปฐมภูมิ`
    );

    if (enableHerbBooks) {
      sourcesList.push(
        `${idx++}. หนังสือข้อมูลความรู้ด้านยาและแนวทางเวชปฏิบัติ (Clinical Practice Guidelines & Drug Reference Books):\n` +
        `   - หน่วยงาน: กรมการแพทย์ และ กรมการแพทย์แผนไทยและการแพทย์ทางเลือก กระทรวงสาธารณสุข\n` +
        `   - ข้อมูล: คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ กรมการแพทย์ (เม.ย. 2568), แนวทางการใช้ยาสมุนไพรในบัญชียาหลักแห่งชาติทดแทนยาแผนปัจจุบัน 32 รายการ (ธ.ค. 2567), แผนภูมิการรักษาอาการเจ็บป่วยด้วยยาสมุนไพรในระบบบริการปฐมภูมิ 11 กลุ่มอาการ (ICD-10 / ICD-10-TM), และประกาศบัญชียาหลักแห่งชาติด้านสมุนไพร (ฉบับที่ 2) พ.ศ. 2568\n` +
        `   - การตรวจสอบ: ตรวจสอบได้จากเมนู "คลังความรู้" หมวดหนังสือข้อมูลความรู้ด้านยา (/knowledge) หรือดูในปุ่ม "แหล่งอ้างอิง" ของระบบ พร้อมรูปแบบการอ้างอิงตามมาตรฐาน APA 7th Edition`
      );
    }

    if (enableExternal) {
      sourcesList.push(
        `${idx++}. ฐานข้อมูลงานวิจัยทางการแพทย์สากลและไทย (Evidence-based Research):\n` +
        `   - ระดับสากล: ฐานข้อมูล PubMed / MEDLINE ของ National Center for Biotechnology Information (NCBI) สหรัฐอเมริกา ค้นหาผ่าน PubMed API ตามชื่อวิทยาศาสตร์และชื่อสามัญทางยา พร้อมรหัส PMID ที่ตรวจสอบได้จริง\n` +
        `   - ระดับชาติ: ศูนย์ดัชนีการอ้างอิงวารสารไทย (ThaiJO / TCI) จากวารสารการแพทย์แผนไทยและการแพทย์ทางเลือก และวารสารเภสัชศาสตร์ในไทย`
      );
    }

    if (enableInternal) {
      sourcesList.push(
        `${idx++}. คลังข้อมูลสมุนไพรและตำรับยา 97 รายการ และการตรวจทานโดยทีมผู้เชี่ยวชาญ:\n` +
        `   - หน่วยงาน: กลุ่มงานการแพทย์แผนไทยและสมุนไพร สำนักงานสาธารณสุขจังหวัดพิษณุโลก\n` +
        `   - ข้อมูล: ผ่านการคัดกรองตามหลักฐานเชิงประจักษ์ และมีระบบ Learning & Clinical Verification ตรวจทานความถูกต้องโดยทีมเภสัชกรและบุคลากรการแพทย์แผนไทย`
      );
    }

    const verifyCheckItems = [
      'ปุ่มแหล่งอ้างอิง',
      enableHerbBooks ? 'หมวดหนังสือความรู้ด้านยา (/knowledge)' : '',
      enableExternal ? 'รหัส PMID' : '',
      enableMahidol ? 'ลิงก์มหิดล' : '',
      enableTu ? 'เอกสารวิชาการ ม.ธรรมศาสตร์' : '',
      'หน้ารายละเอียดสมุนไพรในระบบ (/herbs)',
    ].filter(Boolean).join(', ');

    contextText =
      `\n[โครงสร้างแหล่งข้อมูลและเอกสารอ้างอิงที่ระบบ "หมอยาพิษณุโลก" ใช้ตอบ (System Reference & Evidence Architecture)]:\n` +
      `ระบบ "หมอยาพิษณุโลก" ประจำกลุ่มงานการแพทย์แผนไทยและสมุนไพร สำนักงานสาธารณสุขจังหวัดพิษณุโลก ใช้ข้อมูลจากแหล่งอ้างอิงมาตรฐานที่น่าเชื่อถือทางวิชาการและการแพทย์ ${sourcesList.length} แหล่งหลัก ดังนี้:\n` +
      sourcesList.join('\n') +
      `\n* คำสั่งพิเศษ: คำถามนี้ถามถึงแหล่งข้อมูลของระบบ ให้ตอบอย่างภาคภูมิใจ ละเอียด ครบถ้วน โปร่งใส และจัดรูปแบบให้อ่านง่าย โดยแจกแจงแหล่งข้อมูลทั้ง ${sourcesList.length} แหล่งข้างต้น พร้อมระบุวิธีที่ผู้ใช้สามารถตรวจสอบย้อนกลับได้ (เช่น ${verifyCheckItems}) ห้ามตอบปฏิเสธเด็ดขาด${!enableMahidol ? " และห้ามระบุถึง มหาวิทยาลัยมหิดล หรือศูนย์ข้อมูลสมุนไพร ม.มหิดล โดยเด็ดขาดเนื่องจากปัจจุบันระบบปิดการใช้งาน" : ""}${!enableTu ? " และห้ามระบุถึง มหาวิทยาลัยธรรมศาสตร์ หรือ ศ. ดร.ภญ.อรุณพร อิฐรัตน์ โดยเด็ดขาดเนื่องจากปัจจุบันระบบปิดการใช้งาน" : ""}*\n\n` +
      contextText;
  }

  if (!contextText.trim()) {
    contextText = "ไม่พบข้อมูลเฉพาะเจาะจงสำหรับคำถามนี้ในฐานข้อมูลภายใน ในส่วนอ้างอิงให้อ้างอิงเฉพาะ 'คู่มือการใช้ยาสมุนไพร กรมการแพทย์แผนไทยฯ' โดยไม่ต้องใส่ URL ห้ามแต่งข้อมูลหรืออ้างอิงขึ้นเอง หากไม่มีข้อมูลในระบบ ให้แจ้งผู้ใช้อย่างตรงไปตรงมาว่าไม่มีข้อมูลในฐานข้อมูลปัจจุบัน และแนะนำให้ปรึกษาแพทย์แผนไทยหรือเภสัชกรโดยตรง";
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
    dynamicInstructions += "\n\n⚠️ ข้อห้ามเด็ดขาด: ขณะนี้ระบบปิดการใช้ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบันของ ม.มหิดล (Herb-Drug Interaction) ห้ามนำข้อมูล DDI มหิดลมาใช้ และห้ามเอ่ยถึง อ้างอิง หรือระบุชื่อ 'มหาวิทยาลัยมหิดล', 'ม.มหิดล', 'ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ มหาวิทยาลัยมหิดล' หรือเว็บไซต์ 'medplant.mahidol.ac.th' ในเนื้อหาคำตอบและในหัวข้อ '📚 เอกสารอ้างอิง (APA 7th Edition)' โดยเด็ดขาด!";
  }
  if (!enableTu) {
    dynamicInstructions += "\n\n⚠️ ข้อห้ามเด็ดขาด: ขณะนี้ระบบปิดการใช้ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบันของ ม.ธรรมศาสตร์ (ศ. ดร.ภญ.อรุณพร อิฐรัตน์) ห้ามนำข้อมูล DDI ม.ธรรมศาสตร์มาใช้ และห้ามเอ่ยถึง อ้างอิง หรือระบุชื่อ 'มหาวิทยาลัยธรรมศาสตร์', 'ม.ธรรมศาสตร์', 'อรุณพร อิฐรัตน์' หรือ 'สถานการแพทย์แผนไทยประยุกต์ คณะแพทยศาสตร์ มหาวิทยาลัยธรรมศาสตร์' ในเนื้อหาคำตอบและในหัวข้อ '📚 เอกสารอ้างอิง (APA 7th Edition)' โดยเด็ดขาด!";
  }
  if (isTierMatched) {
    const activeTierMeta = HERB_BOOK_CATEGORIES.find((c) => c.tier === matchedTier);
    const sourceFileName = activeTierMeta?.sourceFile || matchedHerbBooks[0]?.sourceFile;
    const apaCite = activeTierMeta?.apa || matchedHerbBooks[0]?.apaCitation;

    contextText =
      `\n[แหล่งข้อมูลหลักตามลำดับความสำคัญ (Tier ${matchedTier} Primary Authority Source)]:\n` +
      `คำถามนี้พบข้อมูลตอบคำถามจากแหล่งข้อมูลหลักลำดับที่ ${matchedTier}: "${sourceFileName}"\n` +
      `ตามระเบียบของระบบ ให้ใช้ข้อมูลจากลำดับที่ ${matchedTier} นี้เป็น **แกนหลักในการตอบประเด็นคำถามหลัก (Primary Core Answer)** อย่างเคร่งครัด\n` +
      `หากมีประเด็นอื่นๆ ในคำตอบที่เสริมกับคำตอบ (เช่น ข้อมูลทางพฤกษศาสตร์, กลไกการออกฤทธิ์, ขนาดยาตามประกาศกระทรวง, คำแนะนำการดูแลสุขภาพ, หรืองานวิจัยสนับสนุน) สามารถค้นหาและดึงข้อมูลจากแหล่งอื่นในระบบมาตอบเสริมได้ **แต่คำตอบและข้อมูลเสริมต้องห้ามขัดแย้ง คัดง้าง หรือทำให้สับสนกับคำตอบที่ตอบในประเด็นคำถามหลักจาก Tier ${matchedTier} โดยเด็ดขาด**\n` +
      `ในหัวข้อเอกสารอ้างอิง (APA 7th Edition) ให้อ้างอิงแหล่งข้อมูลหลักลำดับที่ ${matchedTier} คือ "${apaCite}" เป็นรายการแรกเสมอ และสามารถระบุเอกสารอ้างอิงเสริมที่นำมาใช้ตอบจริงต่อท้ายได้\n\n` +
      contextText;

    dynamicInstructions += `\n\n⚠️ **กฎลำดับความสำคัญของแหล่งข้อมูลและการตอบประเด็นเสริม (Tiered Authority & Supplementary Rules):**\n` +
      `1. **ประเด็นคำถามหลัก:** คำถามนี้พบข้อมูลตอบคำถามจากแหล่งข้อมูลหลักลำดับที่ ${matchedTier}: "${sourceFileName}" ให้ใช้ข้อมูลจากแหล่งนี้เป็น **แกนหลักในการตอบประเด็นคำถามหลัก** อย่างเคร่งครัด\n` +
      `2. **การเสริมข้อมูลจากแหล่งอื่น:** หากมีประเด็นอื่นๆ ในคำตอบที่เสริมกับคำตอบ สามารถค้นหาและดึงข้อมูลจากแหล่งอื่นในระบบ (เช่น คลังยาสมุนไพร 97 รายการ, บัญชียาหลักแห่งชาติ, หรืองานวิจัย) มาตอบเสริมเพื่อความสมบูรณ์ได้\n` +
      `3. **กฎเหล็กเรื่องความไม่ขัดแย้ง (Strict Non-Contradiction Rule):** ข้อมูลที่นำมาตอบเสริม **ต้องไม่ขัดแย้ง คัดง้าง หรือทำให้สับสนกับคำตอบที่ตอบในประเด็นคำถามหลักจาก Tier ${matchedTier} โดยเด็ดขาด** หากพบข้อมูลเสริมที่ขัดแย้งกับ Tier ${matchedTier} ให้ยึดข้อมูลของ Tier ${matchedTier} เป็นข้อยุติเท่านั้น และห้ามนำข้อมูลที่ขัดแย้งมาตอบเด็ดขาด\n` +
      `4. **การอ้างอิง APA 7th Edition:** ในหัวข้อ '📚 เอกสารอ้างอิง (APA 7th Edition)' ให้ระบุเอกสารหลัก "${apaCite}" เป็นอันดับแรกเสมอ หากมีการนำข้อมูลเสริมจากแหล่งอื่นมาใช้ตอบจริง สามารถระบุเอกสารอ้างอิงเสริมต่อท้ายได้`;
  } else if (isDdi) {
    contextText =
      `\n[แหล่งข้อมูลเฉพาะสำหรับอันตรกิริยาระหว่างสมุนไพรกับยา (Herb-Drug Interactions Exclusive Source)]:\n` +
      `ตามนโยบายมาตรฐานการรักษาด้านสมุนไพร สำหรับคำถามเกี่ยวกับอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน (Herb-Drug Interactions / ยาตีกัน / การกินร่วมกับยาแผนปัจจุบัน) **ต้องใช้แหล่งข้อมูลจาก "คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ กรมการแพทย์ (พ.ศ. 2568)" เป็นแหล่งข้อมูลในการตอบคำถามเท่านั้น** ห้ามใช้หรืออ้างอิงแหล่งข้อมูล DDI อื่นเด็ดขาด และเขียนรายการอ้างอิง (APA 7th Edition) คือ "กรมการแพทย์. (2568). คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ. กระทรวงสาธารณสุข."\n\n` +
      contextText;
    dynamicInstructions += "\n\n⚠️ **กฎสำคัญสูงสุดเรื่องอันตรกิริยาระหว่างสมุนไพรกับยา (Herb-Drug Interactions):** คำถามนี้เป็นคำถามเกี่ยวกับอันตรกิริยาระหว่างสมุนไพรกับยา หรือการกินสมุนไพรร่วมกับยาแผนปัจจุบัน **ต้องใช้แหล่งข้อมูลจาก 'คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ กรมการแพทย์ (พ.ศ. 2568)' ในการเป็นแหล่งข้อมูลในการตอบคำถามเท่านั้น** ห้ามเอ่ยถึง อ้างอิง หรือใช้ข้อมูลจาก มหาวิทยาลัยมหิดล, ศูนย์ข้อมูลสมุนไพร ม.มหิดล, มหาวิทยาลัยธรรมศาสตร์, ศ. ดร.ภญ.อรุณพร อิฐรัตน์ หรือ PubMed/ThaiJO โดยเด็ดขาด และในหัวข้อ '📚 เอกสารอ้างอิง (APA 7th Edition)' ให้ระบุเฉพาะ 'กรมการแพทย์. (2568). คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ. กระทรวงสาธารณสุข.' เท่านั้น";
  }
  if (/กัญชา|cannabis|thc|cbd/i.test(question)) {
    dynamicInstructions += "\n\n⚠️ คำแนะนำพิเศษเรื่องกัญชา: หากผู้ใช้ถามถึงกัญชาหรือยาที่มีส่วนผสมของกัญชา ให้ตรวจสอบและตอบโดยอ้างอิงตำรับยาที่มีกัญชาในบัญชี 97 รายการ (เช่น ยาศุขไสยาศน์, ยาแก้ลมแก้เส้น, ยาทำลายพระสุเมรุ, ยาอัมฤตย์โอสถ, ยาประสะกัญชา, ยาทาขมิ้นชันและกัญชา และยาน้ำมันสารสกัดกัญชาสูตรต่างๆ) โดยเน้นย้ำว่าเป็นยาควบคุมทางการแพทย์ ข้อห้ามใช้ในสตรีมีครรภ์/ให้นมบุตร/เด็ก และข้อควรระวังปฏิกิริยากับยาแผนปัจจุบัน (DDI) อย่างเคร่งครัด";
  }
  if (currentSettings.show_apa_citations === false) {
    dynamicInstructions += "\n\n⚠️ **คำสั่งสำคัญเรื่องเอกสารอ้างอิง:** ขณะนี้ระบบปิดการแสดงผลหัวข้อเอกสารอ้างอิง APA 7th Edition ห้ามใส่หัวข้อ '### 📚 เอกสารอ้างอิง (APA 7th Edition)' หรือรายการอ้างอิง APA ใดๆ ท้ายคำตอบเด็ดขาด";
  }


  // 4. เตรียมชุดข้อความส่งไปยัง AI Model (จัดรูปแบบ strict alternating user/assistant สำหรับ DeepSeek & OpenAI-compatible)
  const fullSystemPrompt = `${buildSystemPrompt(currentSettings)}${dynamicInstructions}\n\n<CONTEXT>\n${contextText}\n</CONTEXT>`;
  const messagesToSend = buildNormalizedChatMessages(fullSystemPrompt, history, question);

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
    const configuredModel = provider.model_name?.trim() || (isGoogle ? "gemini-1.5-flash" : "deepseek-chat");
    const modelCandidates = isGoogle
      ? Array.from(new Set([configuredModel, "gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-flash-latest"]))
      : [configuredModel];

    for (const modelToUse of modelCandidates) {
      try {
        let resp: Response;
        const provSignal = safeTimeoutSignal(35000);
        try {
          resp = await fetch(endpoint, {
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
            ...(provSignal ? { signal: provSignal } : {}),
          });
        } catch (fetchErr: any) {
          if (fetchErr?.message?.includes("AbortSignal") || fetchErr?.message?.includes("signal")) {
            resp = await fetch(endpoint, {
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
          } else {
            throw fetchErr;
          }
        }

        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          console.warn(`Model ${modelToUse} returned HTTP ${resp.status}:`, errText);
          lastError = new Error(`HTTP ${resp.status}: ${errText.slice(0, 150)}`);
          if (resp.status === 404 || resp.status === 503 || resp.status === 429) {
            continue;
          }
          throw lastError;
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
        pubmed: (enableExternal && !isDdi) ? pubmedResults : [],
        thaijo: (enableExternal && !isDdi) ? thaijoResults : [],
      };

  if (!isOutOfScope) {
    const knowledgeItems: any[] = [];
    if (!isTierMatched && enableMahidol && matchedMahidol.length > 0) {
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
    if (!isTierMatched && enableTu && matchedTu.length > 0) {
      knowledgeItems.push(
        ...matchedTu.map((t: any) => ({
          id: t.id,
          title: t.title,
          category: t.category,
          content: t.content,
          source: t.source || "สถานการแพทย์แผนไทยประยุกต์ คณะแพทยศาสตร์ มหาวิทยาลัยธรรมศาสตร์",
          source_url: t.source_url || undefined,
        }))
      );
    }
    if (enableInternal && allKnowledge.length > 0) {
      if (!isTierMatched && matchedHerbs.length === 0 && matchedFormulas.length === 0) {
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
            ...matchedKnowledgeDocs.slice(0, 3).map((k: any) => {
              let docUrl = k.source_url || undefined;
              const isNlem =
                k.category === "บัญชียาหลักแห่งชาติด้านสมุนไพร" ||
                (k.title && k.title.includes("บัญชียาหลักแห่งชาติ")) ||
                (docUrl && docUrl.includes("ratchakitcha"));
              if (isNlem) {
                const mDrug = (k.title || "").match(/บัญชียาหลักแห่งชาติด้านสมุนไพร:\s*(.+?)(?:\s*\(พ\.ศ\.|\s*$)/);
                const drugName = mDrug
                  ? mDrug[1].trim()
                  : (k.title || "").replace(/^บัญชียาหลักแห่งชาติด้านสมุนไพร:\s*/, "").replace(/\s*\(พ\.ศ\..*?\)$/, "").trim();
                docUrl = drugName ? `/herbs?name=${encodeURIComponent(drugName)}` : "/herbs";
              }
              return {
                id: k.id,
                title: k.title,
                category: k.category,
                content: k.content,
                source: k.source || "บัญชียาหลักแห่งชาติด้านสมุนไพร",
                source_url: docUrl,
              };
            })
          );
        }
      }
    }
    if (enableHerbBooks && matchedHerbBooks.length > 0) {
      knowledgeItems.push(
        ...matchedHerbBooks.map((b) => ({
          id: b.id,
          tier: b.tier,
          sourceFile: b.sourceFile,
          title: b.title,
          category: "หนังสือข้อมูลความรู้ด้านยาและเวชปฏิบัติ",
          bookCategory: b.bookCategory,
          chapter: b.chapter,
          content: b.content,
          source: b.bookTitle,
          source_url: `/knowledge?tab=books&id=${encodeURIComponent(b.id)}`,
          apaCitation: b.apaCitation,
          herbs: b.herbs,
          modernDrugs: b.modernDrugs,
        }))
      );
    }
    if (knowledgeItems.length > 0) {
      rawSourcesPayload.knowledge = knowledgeItems;
    }
  }

  // ตรวจสอบและคัดกรองอ้างอิงอย่างเข้มงวดก่อนส่งออก (Strict Reference Validation & Pruning)
  const sourcesPayload = isOutOfScope
    ? { internal: [], pubmed: [], thaijo: [], knowledge: [] }
    : validateAndPruneSources(question, answer, rawSourcesPayload, currentSettings);

  let cleanAnswer = answer;
  if (!enableMahidol || isDdi || isTierMatched) {
    cleanAnswer = sanitizeMahidolReferences(cleanAnswer);
  }
  if (!enableTu || isDdi || isTierMatched) {
    cleanAnswer = sanitizeTuReferences(cleanAnswer);
  }

  const allowedEntities = extractAllowedEntitiesFromSources(sourcesPayload);
  cleanAnswer = sanitizeUnrelatedApaReferences(cleanAnswer, allowedEntities);
  if (currentSettings.show_apa_citations === false) {
    cleanAnswer = stripAllApaReferences(cleanAnswer);
  }

  const finalResponse = `${cleanAnswer}\n\n[SOURCES]${JSON.stringify(sourcesPayload)}[/SOURCES]`;

  // บันทึกคำถาม-คำตอบลงคิวเรียนรู้และตรวจสอบความถูกต้องสำหรับแอดมิน
  if (!isOutOfScope && cleanAnswer.trim()) {
    try {
      addToLearningQueue(question, cleanAnswer);
    } catch {
      // ignore
    }
  }

  if (onChunk) {
    onChunk(finalResponse);
  }

  return finalResponse;
}
