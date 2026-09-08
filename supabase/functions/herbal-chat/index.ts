import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiComplete, loadActiveProviders, AllProvidersFailedError, type ProviderRow } from "../_shared/ai-router.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ---------- Types ----------

type HerbRow = {
  id: string;
  name_thai: string;
  name_english: string | null;
  name_scientific: string | null;
  local_names: string[] | null;
  description: string | null;
  properties: string[] | null;
  dosage: string | null;
  usage_instructions: string | null;
  precautions: string[] | null;
  contraindications: string[] | null;
  drug_interactions: string[] | null;
};

type FormulaRow = {
  id: string;
  name_thai: string;
  name_english: string | null;
  formula_code: string | null;
  indication: string | null;
  ingredients: string[] | null;
  dosage: string | null;
  usage_instructions: string | null;
  precautions: string[] | null;
  contraindications: string[] | null;
  drug_interactions: string[] | null;
};

type PubMedSource = {
  pmid: string;
  title: string;
  authors: string;
  year: string;
  journal: string;
};

type ThaiJoSource = {
  title: string;
  authors: string;
  year?: string;
  journal: string;
  url: string;
};


type InternalSource = {
  type: "herb" | "formula";
  id: string;
  name: string;
};

type KnowledgeDoc = {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[] | null;
  source: string | null;
  source_url: string | null;
};

type KnowledgeSource = {
  id: string;
  title: string;
  category: string;
  source: string | null;
  source_url: string | null;
  content?: string;
};

type AiFallback = {
  summary: string;
  used: boolean;
};



// ---------- Thai keyword dictionaries ----------

// สมุนไพร: คำภาษาไทย (lowercase) → ชื่อวิทยาศาสตร์สำหรับค้น PubMed
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
  "ชาเขียว": "Camellia sinensis",
  "ตังกุย": "Angelica sinensis",
  "เซนต์จอห์นเวิร์ต": "Hypericum perforatum",
  "เซนต์จอห์น": "Hypericum perforatum",
  "มะรุม": "Moringa oleifera",
  "ว่านหางจระเข้": "Aloe vera",
  "รางจืด": "Thunbergia laurifolia",
  "บัวบก": "Centella asiatica",
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
  "อะม็อกซิลลิน": "amoxicillin",
  "ยาแก้ปวด": "analgesic OR NSAID OR paracetamol",
  "ยาแก้อักเสบ": "NSAID",
  "พารา": "paracetamol OR acetaminophen",
  "พาราเซตามอล": "paracetamol OR acetaminophen",
  "ยาลดไข้": "paracetamol OR antipyretic",
  "ไอบูโพรเฟน": "ibuprofen",
  "บรูเฟน": "ibuprofen",
  "ยาลดกรด": "omeprazole OR proton pump inhibitor OR antacid",
  "โอเมพราโซล": "omeprazole",
  "ยาแก้แพ้": "antihistamine",
  "เซทิริซีน": "cetirizine",
  "ลอราทาดีน": "loratadine",
  "สแตติน": "statin",
  "ยาลดไขมัน": "statin",
  "ซิมวาสแตติน": "simvastatin",
  "อะทอร์วาสแตติน": "atorvastatin",
  "ยาต้านซึมเศร้า": "antidepressant OR SSRI",
  "ยาโรคหัวใจ": "digoxin OR cardiovascular drug",
  "ดิจอกซิน": "digoxin",
};

// ---------- Common Disease 10 กลุ่มอาการ (กระทรวงสาธารณสุข) ----------
// อ้างอิง: กรมการแพทย์แผนไทยและการแพทย์ทางเลือก + บัญชียาหลักแห่งชาติด้านสมุนไพร (Self-care)
const COMMON_DISEASE_GROUPS = `
### 10 กลุ่มอาการ (Common Diseases) ที่ดูแลตนเองด้วยยาสมุนไพร — กระทรวงสาธารณสุข

1. **ไข้ หวัด เจ็บคอ**
   - สมุนไพร/ตำรับ: ฟ้าทะลายโจร (แคปซูล/ยาผง), ยาจันทน์ลีลา, ยาห้าราก (เบญจโลกวิเชียร)
   - สรรพคุณ: บรรเทาไข้ ลดไข้ตัวร้อน แก้เจ็บคอ
2. **ไอ ระคายคอ มีเสมหะ**
   - สมุนไพร/ตำรับ: มะแว้ง (ยาอมมะแว้ง), ยาประสะมะแว้ง, ยาตรีผลา
   - สรรพคุณ: บรรเทาอาการไอ ขับเสมหะ ชุ่มคอ
3. **ท้องอืด ท้องเฟ้อ อาหารไม่ย่อย**
   - สมุนไพร/ตำรับ: ขิง, ขมิ้นชัน, ยาธาตุอบเชย, ยาธาตุบรรจบ, ยาประสะกะเพรา
   - สรรพคุณ: ขับลม แก้ท้องอืด กระตุ้นการย่อย
4. **ท้องเสีย (ไม่ติดเชื้อ)**
   - สมุนไพร/ตำรับ: ฟ้าทะลายโจร, กล้วยน้ำว้าดิบ (ผงกล้วย), ยาเหลืองปิดสมุทร
   - สรรพคุณ: บรรเทาอาการท้องเสียชนิดไม่ติดเชื้อ
5. **ท้องผูก**
   - สมุนไพร/ตำรับ: มะขามแขก, ชุมเห็ดเทศ, ยาถ่ายดีเกลือฝรั่ง (ตามข้อบ่งใช้)
   - สรรพคุณ: ระบาย บรรเทาอาการท้องผูก (ไม่ใช้ต่อเนื่องนาน)
6. **คลื่นไส้ อาเจียน เมารถเมาเรือ**
   - สมุนไพร/ตำรับ: ขิง (แคปซูลขิง)
   - สรรพคุณ: บรรเทาอาการคลื่นไส้อาเจียนจากการเมารถ/แพ้ท้อง/หลังผ่าตัด
7. **ปวดเมื่อยกล้ามเนื้อ เคล็ดขัดยอก**
   - สมุนไพร/ตำรับ: ไพล (ครีมไพล/น้ำมันไพล), เถาวัลย์เปรียง, ยาประคบสมุนไพร
   - สรรพคุณ: บรรเทาอาการปวดเมื่อย ฟกช้ำ อักเสบเฉพาะที่
8. **แผล ผื่นคัน โรคผิวหนัง**
   - สมุนไพร/ตำรับ: ว่านหางจระเข้ (แผลไฟไหม้/น้ำร้อนลวก), พญายอ (เริม/งูสวัด), ทิงเจอร์ทองพันชั่ง (กลาก เกลื้อน)
   - สรรพคุณ: สมานแผล ลดการอักเสบ ต้านเชื้อรา/ไวรัสผิวหนัง
9. **ริดสีดวงทวาร**
   - สมุนไพร/ตำรับ: เพชรสังฆาต (แคปซูล), ยาริดสีดวงมหากาฬ
   - สรรพคุณ: บรรเทาอาการริดสีดวงทวารระยะแรก
10. **นอนไม่หลับ เครียด วิตกกังวล**
    - สมุนไพร/ตำรับ: ยาศุขไสยาศน์ (ตำรับกัญชา — ช่วยให้นอนหลับ เจริญอาหาร), ยาประสะกัญชา, ขี้เหล็ก (ใบขี้เหล็ก), ยาหอมเทพจิตร, ยาหอมนวโกฐ
    - สรรพคุณ: ช่วยให้นอนหลับ คลายเครียด บำรุงหัวใจ (ตำรับกัญชาต้องสั่งจ่ายโดยผู้ประกอบวิชาชีพที่ได้รับอนุญาต)

**แหล่งอ้างอิงหลัก:**
- กรมการแพทย์แผนไทยและการแพทย์ทางเลือก กระทรวงสาธารณสุข — คู่มือการใช้ยาสมุนไพรในการดูแลสุขภาพเบื้องต้น
- บัญชียาหลักแห่งชาติด้านสมุนไพร (NLEM Herbal) พ.ศ. ปัจจุบัน
- สำนักงานคณะกรรมการอาหารและยา (อย.)
`;

function isCommonDiseaseQuestion(q: string): boolean {
  const s = q.toLowerCase();
  return /10\s*กลุ่มอาการ|สิบกลุ่มอาการ|common\s*disease|self[-\s]?care|อาการทั่วไป|โรคทั่วไป|ดูแลตนเอง|ดูแลตัวเอง|บัญชียาหลัก.*สมุนไพร/i.test(s);
}

// ---------- Helpers ----------

/** cache ข้อมูลตารางไว้ใน memory ของ instance (TTL 5 นาที) เพื่อลดเวลา query ซ้ำ */
let _catalogCache: { at: number; herbs: HerbRow[]; formulas: FormulaRow[] } | null = null;
const CATALOG_TTL_MS = 5 * 60 * 1000;

async function loadCatalog(supabase: any): Promise<{ herbs: HerbRow[]; formulas: FormulaRow[] }> {
  if (_catalogCache && Date.now() - _catalogCache.at < CATALOG_TTL_MS) {
    return { herbs: _catalogCache.herbs, formulas: _catalogCache.formulas };
  }
  const [{ data: allHerbs }, { data: allFormulas }] = await Promise.all([
    supabase
      .from("herbs")
      .select("id, name_thai, name_english, name_scientific, local_names, description, properties, dosage, usage_instructions, precautions, contraindications, drug_interactions"),
    supabase
      .from("thai_formulas")
      .select("id, name_thai, name_english, formula_code, indication, ingredients, dosage, usage_instructions, precautions, contraindications, drug_interactions"),
  ]);
  const herbs = (allHerbs || []) as HerbRow[];
  const formulas = (allFormulas || []) as FormulaRow[];
  _catalogCache = { at: Date.now(), herbs, formulas };
  return { herbs, formulas };
}

/** normalize ชื่อยาไทยเพื่อเทียบแบบยืดหยุ่น (ตัดคำนำหน้า/เว้นวรรค/ไม้ทัณฑฆาต/ศ-ษ→ส) */
function normalizeThaiName(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[\s\u0E4C().,\-–—/]/g, "")
    .replace(/^(ยาตำรับ|ตำรับยา|ตำรับ|ยา)/, "")
    .replace(/[ศษ]/g, "ส")
    .replace(/ณ/g, "น");
}

/** คำถามแบบขอ "รายชื่อ" เช่น มีอะไรบ้าง / มีกี่ตำรับ / รายการ */
function isListQuestion(q: string): boolean {
  return /มีอะไรบ้าง|มีอะไร|มีกี่|รายชื่อ|รายการ|ทั้งหมด|บ้าง\s*$|ประกอบด้วยอะไร/.test(q);
}

/** ตารางอาการ → คำที่ใช้ค้นในข้อบ่งใช้/สรรพคุณของฐานข้อมูล */
const SYMPTOM_MAP: { match: RegExp; terms: string[] }[] = [
  { match: /นอนไม่หลับ|หลับยาก|นอนหลับ|insomnia|เครียด|วิตกกังวล/, terms: ["นอนหลับ", "นอนไม่หลับ", "หลับ", "คลายเครียด", "กล่อมประสาท"] },
  { match: /เบื่ออาหาร|ไม่อยากอาหาร|กินข้าวไม่ลง|เจริญอาหาร/, terms: ["เจริญอาหาร", "เบื่ออาหาร", "บำรุงร่างกาย"] },
  { match: /ท้องอืด|ท้องเฟ้อ|จุกเสียด|แน่นท้อง|ขับลม/, terms: ["ท้องอืด", "ท้องเฟ้อ", "ขับลม", "จุกเสียด"] },
  { match: /ท้องผูก|ถ่ายยาก|ระบาย/, terms: ["ระบาย", "ท้องผูก", "ถ่าย"] },
  { match: /ท้องเสีย|ท้องร่วง|ถ่ายเหลว/, terms: ["ท้องเสีย", "ท้องร่วง", "บรรเทาอาการท้องเสีย"] },
  { match: /ไข้|ตัวร้อน|fever/, terms: ["ไข้", "ลดไข้", "แก้ไข้"] },
  { match: /ไอ|เจ็บคอ|ขับเสมหะ|เสมหะ|หวัด/, terms: ["ไอ", "เจ็บคอ", "เสมหะ", "หวัด"] },
  { match: /ปวดเมื่อย|เคล็ด|ขัดยอก|ปวดหลัง|ปวดกล้ามเนื้อ|ปวดข้อ|ข้อเข่า|ข้ออักเสบ|ข้อบวม/, terms: ["ปวดเมื่อย", "เคล็ด", "ปวดข้อ", "ข้อเข่า", "กล้ามเนื้อ"] },
  { match: /คลื่นไส้|อาเจียน|เมารถ|แพ้ท้อง/, terms: ["คลื่นไส้", "อาเจียน"] },
  { match: /ริดสีดวง/, terms: ["ริดสีดวง"] },
  { match: /ผื่น|คัน|กลาก|เกลื้อน|แผล|ผิวหนัง|เริม|งูสวัด/, terms: ["ผิวหนัง", "แผล", "ผื่น", "คัน", "กลาก", "เกลื้อน", "เริม", "งูสวัด"] },
  { match: /ประจำเดือน|ขับน้ำคาวปลา|หลังคลอด/, terms: ["ประจำเดือน", "น้ำคาวปลา", "หลังคลอด"] },
  { match: /เบาหวาน|น้ำตาลในเลือด/, terms: ["เบาหวาน", "น้ำตาล"] },
  { match: /ความดัน/, terms: ["ความดัน"] },
  { match: /มะเร็ง|เคมีบำบัด|ประคับประคอง/, terms: ["มะเร็ง", "ประคับประคอง", "เคมีบำบัด"] },
  { match: /อัมพฤกษ์|อัมพาต|เส้นตึง|ลมปลายปัตคาต/, terms: ["อัมพฤกษ์", "อัมพาต", "เส้น", "ลม"] },
  { match: /ปวดท้อง|ปวดเกร็งท้อง|ปวดกระเพาะ|โรคกระเพาะ|แสบท้อง/, terms: ["ปวดท้อง", "ท้องอืด", "ขับลม", "จุกเสียด", "กระเพาะ", "แน่นท้อง"] },
  { match: /กรดไหลย้อน|แสบร้อนกลางอก/, terms: ["กรดไหลย้อน", "กระเพาะ", "แสบร้อน"] },
  { match: /ปวดหัว|ปวดศีรษะ|ไมเกรน|มึนหัว/, terms: ["ปวดศีรษะ", "ปวดหัว", "ไมเกรน", "มึน"] },
  { match: /เวียนหัว|เวียนศีรษะ|หน้ามืด|วิงเวียน|เป็นลม/, terms: ["วิงเวียน", "หน้ามืด", "เป็นลม", "บำรุงหัวใจ"] },
  { match: /ปวดฟัน|รำมะนาด|เหงือก/, terms: ["ปวดฟัน", "เหงือก", "ช่องปาก"] },
  { match: /ปวดประจำเดือน|ประจำเดือนมาไม่ปกติ/, terms: ["ประจำเดือน", "ปวดประจำเดือน", "ขับประจำเดือน"] },
  { match: /ภูมิแพ้|คัดจมูก|น้ำมูก|ไซนัส|จาม/, terms: ["ภูมิแพ้", "คัดจมูก", "น้ำมูก", "หวัด"] },
  { match: /ตาแดง|เจ็บตา|ตาอักเสบ/, terms: ["ตา", "อักเสบ"] },
  { match: /ผมร่วง|รังแค|หนังศีรษะ/, terms: ["ผม", "หนังศีรษะ", "รังแค"] },
  { match: /ไขมัน|คอเลสเตอรอล/, terms: ["ไขมัน", "คอเลสเตอรอล"] },
  { match: /บำรุงน้ำนม|น้ำนมน้อย/, terms: ["น้ำนม", "บำรุงน้ำนม"] },
  { match: /ริดสีดวงจมูก|โรคผิวหนัง|สิว|ฝ้า/, terms: ["ผิวหนัง", "สิว", "ฝ้า"] },
];

function symptomTermsFor(question: string, extraTerms: string[] = []): string[] {
  const q = question.toLowerCase();
  const terms = new Set<string>();
  for (const s of SYMPTOM_MAP) {
    if (s.match.test(q)) s.terms.forEach((t) => terms.add(t));
  }
  for (const t of extraTerms) {
    const v = (t || "").trim();
    if (v.length >= 2) terms.add(v);
  }
  return [...terms];
}

const MAX_LIST_RESULTS = 30;

type QuestionIntent = {
  in_scope: boolean;
  type: string;
  symptoms: string[];
  herbs: string[];
  drugs: string[];
  is_follow_up: boolean;
  wants_list: boolean;
};

/** ค้นหาสมุนไพร/ตำรับ: (1) ชื่อในคำถาม (2) อาการ/ข้อบ่งใช้ (3) ส่วนประกอบ */
async function findRelevantHerbs(supabase: any, question: string, intent?: QuestionIntent) {
  const extraNames = (intent?.herbs || []).join(" ");
  const q = `${question} ${extraNames}`.toLowerCase();
  const nq = normalizeThaiName(`${question} ${extraNames}`);
  const listMode = isListQuestion(question) || !!intent?.wants_list;

  const { herbs: allHerbs, formulas: allFormulas } = await loadCatalog(supabase);

  const herbIds = new Set<string>();
  const formulaIds = new Set<string>();
  const matchedHerbs: HerbRow[] = [];
  const matchedFormulas: FormulaRow[] = [];

  const addHerb = (h: HerbRow) => {
    if (!herbIds.has(h.id)) { herbIds.add(h.id); matchedHerbs.push(h); }
  };
  const addFormula = (f: FormulaRow) => {
    if (!formulaIds.has(f.id)) { formulaIds.add(f.id); matchedFormulas.push(f); }
  };

  // (1) ชื่อปรากฏในคำถาม (เทียบทั้งแบบตรงและแบบ normalize)
  const nameMatchedHerbNames: string[] = [];
  for (const h of (allHerbs || []) as HerbRow[]) {
    const names = [h.name_thai, h.name_english, h.name_scientific, ...(h.local_names || [])]
      .filter(Boolean)
      .map((s) => (s as string).toLowerCase());
    const hit = names.some((n) => {
      if (!n || n.length < 2) return false;
      if (q.includes(n)) return true;
      const nn = normalizeThaiName(n);
      return nn.length >= 3 && nq.includes(nn);
    });
    if (hit) { addHerb(h); nameMatchedHerbNames.push(h.name_thai); }
  }

  const nameMatchedFormulaNames: string[] = [];
  for (const f of (allFormulas || []) as FormulaRow[]) {
    const names = [f.name_thai, f.name_english].filter(Boolean).map((s) => (s as string).toLowerCase());
    const hit = names.some((n) => {
      if (!n || n.length < 3) return false;
      if (q.includes(n)) return true;
      const nn = normalizeThaiName(n);
      return nn.length >= 4 && nq.includes(nn);
    });
    if (hit) { addFormula(f); nameMatchedFormulaNames.push(f.name_thai); }
  }

  // (2) ค้นด้วยอาการ/ข้อบ่งใช้/สรรพคุณ (รวมคำอาการที่ AI สกัดมาจากคำถาม)
  // หมายเหตุ: หากผู้ใช้ระบุชื่อตำรับยาหรือสมุนไพรเดี่ยวโดยตรงแล้ว ห้ามดึงสมุนไพรเดี่ยวหรือตำรับยาแปลกปลอมตามอาการมาใส่โดยเด็ดขาด!
  const hasSpecificTarget = nameMatchedHerbNames.length > 0 || nameMatchedFormulaNames.length > 0;
  const symptomTerms = symptomTermsFor(`${question} ${(intent?.symptoms || []).join(" ")}`, intent?.symptoms || []);

  if (symptomTerms.length > 0 && (!hasSpecificTarget || listMode || intent?.type === "symptom")) {
    const limit = listMode ? MAX_LIST_RESULTS : 6;
    if (nameMatchedHerbNames.length === 0) {
      let count = 0;
      for (const f of (allFormulas || []) as FormulaRow[]) {
        if (count >= limit) break;
        const text = `${f.indication || ""} ${f.name_thai}`.toLowerCase();
        if (symptomTerms.some((t) => text.includes(t.toLowerCase()))) { addFormula(f); count++; }
      }
    }
    if (nameMatchedFormulaNames.length === 0) {
      let hcount = 0;
      for (const h of (allHerbs || []) as HerbRow[]) {
        if (hcount >= limit) break;
        const text = `${(h.properties || []).join(" ")} ${h.description || ""}`.toLowerCase();
        if (symptomTerms.some((t) => text.includes(t.toLowerCase()))) { addHerb(h); hcount++; }
      }
    }
  }

  // (3) ค้นตำรับจาก "ส่วนประกอบ" เมื่อคำถามพูดถึงสมุนไพรตัวหนึ่ง (เช่น ตำรับกัญชามีอะไรบ้าง)
  if (nameMatchedFormulaNames.length === 0) {
    const ingredientTargets = new Set<string>(nameMatchedHerbNames);
    const ingredientHint = q.match(/ตำรับ(?:ยา)?\s*([\u0E00-\u0E7F]{2,20})/);
    if (ingredientHint?.[1]) ingredientTargets.add(ingredientHint[1]);
    if (ingredientTargets.size > 0) {
      const limit = listMode ? MAX_LIST_RESULTS : 12;
      let count = 0;
      for (const f of (allFormulas || []) as FormulaRow[]) {
        if (count >= limit) break;
        const ing = (f.ingredients || []).join(" ").toLowerCase();
        if (!ing) continue;
        for (const target of ingredientTargets) {
          const t = target.toLowerCase();
          if (t.length >= 2 && ing.includes(t)) { addFormula(f); count++; break; }
        }
      }
    }
  }

  return {
    herbs: matchedHerbs.slice(0, MAX_LIST_RESULTS),
    formulas: matchedFormulas.slice(0, MAX_LIST_RESULTS),
    nameMatchedHerbNames,
    nameMatchedFormulaNames,
    listMode,
  };
}


/** ค้นหาเอกสารความรู้จากตาราง knowledge_documents ด้วย full-text search */
async function findRelevantKnowledge(supabase: any, question: string, enableMahidol = true): Promise<KnowledgeDoc[]> {
  const q = question.trim();
  if (!q) return [];

  // แยกคำ (ไทย/อังกฤษ) และตัดคำที่สั้นเกินไป
  const tokens = q
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 20);
  if (tokens.length === 0) return [];

  const tsQuery = tokens.map((t) => `${t.replace(/[:&|!()<>]/g, "")}:*`).join(" | ");

  let queryBuilder = supabase
    .from("knowledge_documents")
    .select("id, title, category, content, tags, source, source_url")
    .eq("is_published", true);

  if (!enableMahidol) {
    queryBuilder = queryBuilder.neq("category", "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)");
  }

  const { data, error } = await queryBuilder
    .textSearch("search_vector", tsQuery, { config: "simple" })
    .limit(6);

  if (error) {
    console.error("[herbal-chat] knowledge search error:", error.message);
    // fallback: match by tag/title ilike
    let fallbackBuilder = supabase
      .from("knowledge_documents")
      .select("id, title, category, content, tags, source, source_url")
      .eq("is_published", true);

    if (!enableMahidol) {
      fallbackBuilder = fallbackBuilder.neq("category", "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)");
    }

    const { data: fallback } = await fallbackBuilder
      .or(tokens.slice(0, 3).map((t) => `title.ilike.%${t}%,content.ilike.%${t}%`).join(","))
      .limit(6);
    return (fallback || []) as KnowledgeDoc[];
  }
  return (data || []) as KnowledgeDoc[];
}

/** กรองเอกสาร DDI ของ ม.มหิดล ให้ตรงกับสมุนไพรและยาที่ผู้ใช้ถามจริง ห้ามปนสมุนไพรอื่น */
function filterStrictDdiKnowledge(
  question: string,
  docs: KnowledgeDoc[],
  intentHerbs: string[] = [],
  intentDrugs: string[] = []
): KnowledgeDoc[] {
  const qLower = (question || "").toLowerCase();
  const askedHerbs = intentHerbs.map((h) => h.toLowerCase()).filter(Boolean);
  const askedDrugs = intentDrugs.map((d) => d.toLowerCase()).filter(Boolean);

  return docs.filter((k) => {
    if (k.category !== "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)") return true;

    const m = (k.title || "").match(/อันตรกิริยาระหว่าง\s+(.+?)\s+กับ\s+(.+?)(?:\s+\(ม\.มหิดล\))?$/);
    const docHerb = (m ? m[1].trim() : "").toLowerCase();
    const docDrug = (m ? m[2].trim() : "").toLowerCase();

    // ตรวจสอบสมุนไพร
    const herbMatches =
      (docHerb && qLower.includes(docHerb)) ||
      askedHerbs.some((ah) => ah.includes(docHerb) || docHerb.includes(ah));

    // ตรวจสอบยา
    const drugMatches =
      (docDrug && qLower.includes(docDrug)) ||
      askedDrugs.some((ad) => ad.includes(docDrug) || docDrug.includes(ad));

    if (askedHerbs.length > 0 && askedDrugs.length > 0) {
      return herbMatches && drugMatches;
    } else if (askedHerbs.length > 0) {
      return herbMatches;
    } else if (askedDrugs.length > 0) {
      return drugMatches;
    }
    return herbMatches || drugMatches;
  });
}

/** สร้าง PubMed query โดยใช้ทั้ง (1) herb ที่ match ใน DB (2) dictionary ไทย→sci (3) dictionary ยาไทย→อังกฤษ */
function buildPubMedQuery(question: string, herbs: HerbRow[]): { query: string; extraHerbNames: string[]; drugTerms: string[] } {
  const q = question.toLowerCase();
  const herbTerms = new Set<string>();
  const extraHerbNames: string[] = [];

  // (1) จาก DB
  for (const h of herbs) {
    if (h.name_scientific) herbTerms.add(`"${h.name_scientific}"`);
    else if (h.name_english) herbTerms.add(`"${h.name_english}"`);
  }

  // (2) จาก dictionary
  for (const [thai, sci] of Object.entries(HERB_THAI_TO_SCI)) {
    if (q.includes(thai.toLowerCase())) {
      herbTerms.add(`"${sci}"`);
      if (!herbs.some((h) => h.name_scientific === sci)) extraHerbNames.push(`${thai} (${sci})`);
    }
  }

  // (3) drug terms
  const drugTerms = new Set<string>();
  for (const [thai, en] of Object.entries(DRUG_THAI_TO_EN)) {
    if (q.includes(thai.toLowerCase())) drugTerms.add(`(${en})`);
  }
  // English drug names / abbreviations in the question itself
  const asciiDrugs = q.match(/\b(warfarin|aspirin|clopidogrel|heparin|digoxin|metformin|insulin|statin|ibuprofen|paracetamol|acetaminophen|para|omeprazole|cetirizine|loratadine|simvastatin|atorvastatin|amlodipine|losartan|enalapril|amoxicillin)\b/gi);
  if (asciiDrugs) {
    for (const d of asciiDrugs) {
      const lower = d.toLowerCase();
      if (lower === "para") drugTerms.add("(paracetamol OR acetaminophen)");
      else drugTerms.add(lower);
    }
  }

  // Intent: interaction / adverse
  const interactionIntent = /interaction|ปฏิกิริยา|ตีกัน|ร่วมกับ|ร่วมกัน|กินร่วม|กินคู่|กินพร้อม|ใช้ร่วม/i.test(q) || drugTerms.size > 0;

  let query = "";
  if (herbTerms.size > 0 && drugTerms.size > 0) {
    query = `(${[...herbTerms].join(" OR ")}) AND (${[...drugTerms].join(" OR ")})`;
  } else if (herbTerms.size > 0 && interactionIntent) {
    query = `(${[...herbTerms].join(" OR ")}) AND (drug interaction OR herb-drug interaction)`;
  } else if (herbTerms.size > 0) {
    query = [...herbTerms].join(" OR ");
  } else {
    const ascii = question.match(/[A-Za-z][A-Za-z0-9-]{2,}/g);
    if (ascii && ascii.length > 0) query = ascii.slice(0, 4).join(" ");
  }

  return { query, extraHerbNames, drugTerms: [...drugTerms] };
}

const pubmedCache = new Map<string, { at: number; data: PubMedSource[] }>();
const PUBMED_CACHE_TTL = 30 * 60 * 1000;

async function fetchPubMed(query: string): Promise<PubMedSource[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const cached = pubmedCache.get(cleanQ);
  if (cached && Date.now() - cached.at < PUBMED_CACHE_TTL) return cached.data;

  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(cleanQ)}&retmax=5&retmode=json&sort=relevance`;
    const searchResp = await fetch(searchUrl, { signal: AbortSignal.timeout(4000) });
    if (!searchResp.ok) return [];
    const searchData = await searchResp.json();
    const pmids: string[] = searchData?.esearchresult?.idlist || [];
    if (pmids.length === 0) return [];

    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=json`;
    const summaryResp = await fetch(summaryUrl, { signal: AbortSignal.timeout(4000) });
    if (!summaryResp.ok) return [];
    const summaryData = await summaryResp.json();

    const results: PubMedSource[] = [];
    for (const pmid of pmids) {
      const item = summaryData?.result?.[pmid];
      if (!item) continue;
      const authors = (item.authors || []).slice(0, 3).map((a: any) => a.name).join(", ") + ((item.authors?.length || 0) > 3 ? ", et al." : "");
      const year = (item.pubdate || "").split(" ")[0] || "";
      results.push({
        pmid,
        title: item.title || "",
        authors: authors || "Unknown",
        year,
        journal: item.fulljournalname || item.source || "",
      });
    }
    return results;
  } catch (e) {
    console.error("PubMed fetch failed:", e);
    return [];
  }
}

// ---------- ThaiJO (งานวิจัยไทย) ----------

/** วารสารไทยกลุ่มการแพทย์/เภสัช/สมุนไพร บน ThaiJO (OJS) */
const THAIJO_JOURNALS = [
  { host: "he01", code: "JTTAM", name: "วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก" },
  { host: "he01", code: "TJPP", name: "วารสารเภสัชกรรมไทย" },
  { host: "he01", code: "IJPS", name: "วารสารเภสัชศาสตร์อีสาน" },
  { host: "he01", code: "JHR", name: "Journal of Health Research" },
];

const thaijoCache = new Map<string, { at: number; data: ThaiJoSource[] }>();
const THAIJO_TTL = 10 * 60 * 1000;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

async function searchThaiJoJournal(
  journal: { host: string; code: string; name: string },
  query: string,
  limit: number,
): Promise<ThaiJoSource[]> {
  const url = `https://${journal.host}.tci-thaijo.org/index.php/${journal.code}/search/search?query=${encodeURIComponent(query)}`;
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(4500),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PLK-HerbBot/1.0)" },
  });
  if (!resp.ok) return [];
  const html = await resp.text();

  const results: ThaiJoSource[] = [];
  const blocks = html.split('class="article-summary').slice(1);
  for (const block of blocks) {
    const linkMatch = block.match(/<a[^>]+href="([^"]+article\/view\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;
    const title = stripTags(linkMatch[2]);
    if (!title) continue;
    const authorsMatch = block.match(/class="authors"\s*>([\s\S]*?)<\/div>/);
    let articleUrl = linkMatch[1].trim();
    if (!articleUrl.startsWith("http://") && !articleUrl.startsWith("https://")) {
      articleUrl = `https://${journal.host}.tci-thaijo.org${articleUrl.startsWith("/") ? "" : "/"}${articleUrl}`;
    }
    results.push({
      title,
      authors: authorsMatch ? stripTags(authorsMatch[1]).slice(0, 120) : "",
      journal: journal.name,
      url: articleUrl,
    });
    if (results.length >= limit) break;
  }
  return results;
}

type ThaiJoCatalogEntry = {
  subjects: string[];
  symptoms?: string[];
  data: ThaiJoSource;
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
    subjects: ["ประสะไพล", "ยาประสะไพล", "ไพล"],
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

/** ค้นหางานวิจัยไทยจากคลัง ThaiJO Catalog โดยตรง ป้องกันการอ้างอิงข้ามสมุนไพรเด็ดขาด */
function findRelevantThaiJoCatalog(
  question: string,
  matchedHerbs: HerbRow[] = [],
  matchedFormulas: FormulaRow[] = [],
  nameMatchedFormulaNames: string[] = [],
  nameMatchedHerbNames: string[] = []
): ThaiJoSource[] {
  const q = question.toLowerCase();
  const nq = normalizeThaiName(question);
  const results: ThaiJoSource[] = [];
  const seen = new Set<string>();

  // ก) ถ้าคำถามเจาะจงตำรับยา (เช่น ยาจันทน์ลีลา) -> ค้นเฉพาะงานวิจัยของตำรับยานั้นเท่านั้น ห้ามเอาของสมุนไพรอื่นมาปน!
  const targetFormulas = nameMatchedFormulaNames.length > 0
    ? nameMatchedFormulaNames
    : matchedFormulas.filter((f) => f.name_thai && (q.includes(f.name_thai.toLowerCase()) || nq.includes(normalizeThaiName(f.name_thai)))).map((f) => f.name_thai);

  if (targetFormulas.length > 0) {
    for (const fn of targetFormulas) {
      const nfn = normalizeThaiName(fn);
      for (const item of THAIJO_CATALOG) {
        const isMatch = item.subjects.some((s) => {
          const sn = normalizeThaiName(s);
          return nfn.includes(sn) || sn.includes(nfn);
        });
        if (isMatch && !seen.has(item.data.url)) {
          seen.add(item.data.url);
          results.push(item.data);
        }
      }
    }
    return results;
  }

  // ข) ถ้าคำถามเจาะจงสมุนไพรเดี่ยว (เช่น ฟ้าทะลายโจร หรือ ขมิ้นชัน) -> ค้นเฉพาะงานวิจัยของสมุนไพรนั้น
  const targetHerbs = nameMatchedHerbNames.length > 0
    ? nameMatchedHerbNames
    : matchedHerbs.filter((h) => h.name_thai && (q.includes(h.name_thai.toLowerCase()) || nq.includes(normalizeThaiName(h.name_thai)))).map((h) => h.name_thai);

  if (targetHerbs.length > 0) {
    for (const hn of targetHerbs) {
      const nhn = normalizeThaiName(hn);
      for (const item of THAIJO_CATALOG) {
        const isMatch = item.subjects.some((s) => {
          const sn = normalizeThaiName(s);
          // Strict one-directional: subject ต้องตรงกับ herb name เป๊ะๆ หรือ subject ต้องครอบคลุม herb name
          // ป้องกัน: "กระชาย" ไม่ match catalog entry ที่ subject = "กระชายขาว"
          return sn === nhn || sn.includes(nhn) || s.toLowerCase() === hn.toLowerCase() || s.toLowerCase().endsWith(hn.toLowerCase());
        });
        if (isMatch && !seen.has(item.data.url)) {
          seen.add(item.data.url);
          results.push(item.data);
        }
      }
    }
    return results;
  }

  // ค) กรณีคำถามถามตามอาการโดยไม่ได้เอ่ยชื่อสมุนไพรหรือตำรับ
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

/** ค้นงานวิจัยไทยสดจาก ThaiJO ด้วยคำไทย พร้อมระบบคัดสรรและกรองตรงประเด็น */
async function fetchThaiJo(
  query: string,
  question: string,
  matchedHerbs: HerbRow[] = [],
  matchedFormulas: FormulaRow[] = [],
  nameMatchedFormulaNames: string[] = [],
  nameMatchedHerbNames: string[] = []
): Promise<ThaiJoSource[]> {
  // 1. ตรวจสอบคลังงานวิจัยที่คัดสรรและยืนยันแล้วก่อน (รับประกันความถูกต้องตรงประเด็น ไม่มีการดึงงานวิจัยอื่นมาปน)
  const catalogResults = findRelevantThaiJoCatalog(
    question,
    matchedHerbs,
    matchedFormulas,
    nameMatchedFormulaNames,
    nameMatchedHerbNames
  );
  if (catalogResults.length > 0) {
    return catalogResults;
  }

  const q = query.trim();
  if (!q) return [];

  const cached = thaijoCache.get(q);
  if (cached && Date.now() - cached.at < THAIJO_TTL) return cached.data;

  const settled = await Promise.allSettled(
    THAIJO_JOURNALS.map((j) => searchThaiJoJournal(j, q, 2)),
  );

  const queryTerms = [
    ...nameMatchedFormulaNames,
    ...nameMatchedHerbNames,
    ...q.split(/\s+/),
  ].filter((t) => t.length >= 2);

  const seen = new Set<string>();
  const merged: ThaiJoSource[] = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") {
      console.error("[herbal-chat] thaijo journal failed:", r.reason);
      continue;
    }
    for (const item of r.value) {
      if (seen.has(item.url)) continue;
      // ตรวจสอบว่าชื่อบทความต้องมีคำสำคัญตรงกับที่ค้นจริง ๆ ป้องกันการดึงบทความที่ไม่เกี่ยวข้องมา
      const normTitle = normalizeThaiName(item.title);
      const isRelevant = queryTerms.length === 0 || queryTerms.some((t) => {
        const nt = normalizeThaiName(t);
        return (nt.length >= 3 && normTitle.includes(nt)) || item.title.toLowerCase().includes(t.toLowerCase());
      });
      if (!isRelevant) continue;

      seen.add(item.url);
      merged.push(item);
    }
  }
  const data = merged.slice(0, 5);
  thaijoCache.set(q, { at: Date.now(), data });
  return data;
}

/** สร้างคำค้นภาษาไทยสำหรับ ThaiJO จากชื่อสมุนไพร/ตำรับที่ตรวจพบในคำถาม */
function buildThaiJoQuery(
  question: string,
  herbs: HerbRow[],
  formulas: FormulaRow[],
  nameMatchedFormulaNames: string[] = [],
  nameMatchedHerbNames: string[] = []
): string {
  const q = question.toLowerCase();
  const nq = normalizeThaiName(question);
  const terms: string[] = [];

  // ก) ถ้าคำถามเอ่ยชื่อตำรับยาโดยตรง ให้ใช้ชื่อตำรับยาเป็นคำค้นหลักก่อนเสมอ
  for (const fn of nameMatchedFormulaNames) {
    if (fn) { terms.push(fn); break; }
  }

  // ข) ถ้าคำถามเอ่ยชื่อสมุนไพรเดี่ยวโดยตรง
  if (terms.length === 0) {
    for (const hn of nameMatchedHerbNames) {
      if (hn) { terms.push(hn); break; }
    }
  }

  // ค) ตรวจหาชื่อตำรับในคำถาม
  if (terms.length === 0) {
    for (const f of formulas) {
      if (f.name_thai && (q.includes(f.name_thai.toLowerCase()) || nq.includes(normalizeThaiName(f.name_thai)))) {
        terms.push(f.name_thai);
        break;
      }
    }
  }

  // ง) ตรวจหาชื่อสมุนไพรในคำถาม
  if (terms.length === 0) {
    for (const h of herbs) {
      if (h.name_thai && (q.includes(h.name_thai.toLowerCase()) || nq.includes(normalizeThaiName(h.name_thai)))) {
        terms.push(h.name_thai);
        break;
      }
    }
  }

  if (terms.length === 0) {
    for (const thai of Object.keys(HERB_THAI_TO_SCI)) {
      if (q.includes(thai.toLowerCase())) {
        terms.push(thai);
        if (terms.length >= 2) break;
      }
    }
  }

  if (terms.length === 0 && formulas.length > 0 && formulas[0].name_thai) {
    terms.push(formulas[0].name_thai);
  }
  if (terms.length === 0 && herbs.length > 0 && herbs[0].name_thai) {
    terms.push(herbs[0].name_thai);
  }

  if (terms.length === 0) {
    // ดึงคำไทยยาว ๆ จากคำถามเป็นคำค้นสำรอง
    const thaiWords = (question.match(/[\u0E00-\u0E7F]{4,}/g) || [])
      .filter((w) => !/^(สมุนไพร|สามารถ|อย่างไร|เท่าไร|คืออะไร|ข้อมูล|คำถาม|อาการ|รักษา)$/.test(w))
      .slice(0, 2);
    terms.push(...thaiWords);
  }

  return terms.slice(0, 2).join(" ");
}



/**
 * จำแนกเจตนาคำถามด้วยโมเดลเร็ว — ใช้ตัดสินว่าอยู่ในขอบเขตหรือไม่
 * และสกัด "อาการ / ชื่อสมุนไพร / ชื่อยา" เพื่อใช้เป็นคำค้นเข้าฐานข้อมูล
 */
async function classifyIntent(question: string, history: any[], providers: ProviderRow[]): Promise<QuestionIntent> {
  const fallbackIntent: QuestionIntent = {
    in_scope: true, type: "unknown", symptoms: [], herbs: [], drugs: [], is_follow_up: false, wants_list: false,
  };
  try {
    const recent = (Array.isArray(history) ? history : [])
      .slice(-4)
      .map((m: any) => `${m.role}: ${String(m.content || "").slice(0, 300)}`)
      .join("\n");

    const aiRes = await aiComplete(providers, {
      light: true,
      timeoutMs: 12000,
      response_format: { type: "json_object" },
      messages: [
          {
            role: "system",
            content: `คุณคือตัวจำแนกเจตนาคำถามของระบบให้คำปรึกษาด้านการแพทย์แผนไทย การแพทย์แผนปัจจุบัน สมุนไพรไทย และ Drug Interaction
ตอบกลับเป็น JSON เท่านั้น รูปแบบ:
{"in_scope":true|false,"type":"symptom|herb|formula|drug_interaction|dosage|policy|other","symptoms":["..."],"herbs":["..."],"drugs":["..."],"is_follow_up":true|false,"wants_list":true|false}

กติกา:
- in_scope = true สำหรับทุกคำถามที่เกี่ยวกับ: การแพทย์แผนไทย สมุนไพร ตำรับยาไทย, การแพทย์แผนปัจจุบัน ยาทุกชนิด, อาการเจ็บป่วยและการดูแลตนเอง (เช่น "ปวดท้องกินไรดี", "นอนไม่หลับ", "ปวดหัว"), ขนาดยา ข้อห้าม ผลข้างเคียง, drug interaction, หรือคำถามต่อเนื่องจากบทสนทนาเดิม
- in_scope = false เมื่อคำถามไม่ได้เกี่ยวกับทางด้านการแพทย์แผนไทย การแพทย์แผนปัจจุบัน หรือการดูแลสุขภาพ เช่น การเขียนโปรแกรม/โค้ดดิ้ง, การเมือง/เลือกตั้ง, กีฬา/ฟุตบอล, พยากรณ์อากาศ, ดูดวง/โหราศาสตร์/หวย, แปลภาษาทั่วไป, บันเทิง/เพลง/ภาพยนตร์, ช่าง/ซ่อมแซม, การเงิน/หุ้น, เรื่องส่วนตัวของ AI
- symptoms: คำอาการภาษาไทยแบบมาตรฐาน พร้อมคำพ้องที่ใช้ค้นฐานข้อมูล (เช่น "ปวดท้อง" → ["ปวดท้อง","จุกเสียด","แน่นท้อง","ขับลม"]) สูงสุด 6 คำ
- herbs / drugs: ชื่อสมุนไพร ตำรับ หรือยาที่กล่าวถึง (รวมจากบทสนทนาก่อนหน้าถ้าคำถามเป็นคำถามต่อเนื่อง)
- is_follow_up = true เมื่อคำถามอ้างถึงหัวข้อในบทสนทนาก่อนหน้าโดยไม่ระบุชื่อใหม่
- wants_list = true เมื่อผู้ใช้ขอรายชื่อ/รายการ`,
          },
          { role: "user", content: `บทสนทนาก่อนหน้า:\n${recent || "(ไม่มี)"}\n\nคำถามล่าสุด: "${question}"` },
      ],
    });
    const raw = aiRes.text || "{}";
    const parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, "").trim());
    return {
      in_scope: parsed.in_scope !== false,
      type: String(parsed.type || "other"),
      symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms.map(String).slice(0, 8) : [],
      herbs: Array.isArray(parsed.herbs) ? parsed.herbs.map(String).slice(0, 8) : [],
      drugs: Array.isArray(parsed.drugs) ? parsed.drugs.map(String).slice(0, 8) : [],
      is_follow_up: parsed.is_follow_up === true,
      wants_list: parsed.wants_list === true,
    };
  } catch (e) {
    console.error("[herbal-chat] intent classify exception:", e);
    return fallbackIntent;
  }
}


/**
 * AI Fallback: เมื่อไม่พบข้อมูลใน DB ภายใน / knowledge / PubMed
 * เรียก Gemini เพื่อสรุปความรู้ทั่วไปเกี่ยวกับสมุนไพร/ตำรับที่ถูกถาม
 * (จากข้อมูลที่โมเดลได้รับการฝึกมา — ไม่ใช่ค้นเว็บสด)
 * ผลลัพธ์จะถูกแนบเข้า context พร้อม disclaimer ชัดเจน
 */
async function fetchAiFallback(question: string, providers: ProviderRow[]): Promise<AiFallback> {
  try {
    const prompt = `คุณคือผู้เชี่ยวชาญด้านเภสัชกรรมไทยและบัญชียาหลักแห่งชาติด้านสมุนไพร

ผู้ใช้ถามว่า: "${question}"

โปรดสรุปข้อมูลที่คุณรู้เกี่ยวกับสมุนไพร/ตำรับยาแผนไทย/ยาที่กล่าวถึงในคำถามนี้ โดยอ้างอิงตามหลักการของ:
- กรมการแพทย์แผนไทยและการแพทย์ทางเลือก กระทรวงสาธารณสุข
- บัญชียาหลักแห่งชาติด้านสมุนไพร (NLEM Herbal)
- ตำราแพทย์แผนไทย (เช่น คัมภีร์สรรพคุณ, ตำราพระโอสถพระนารายณ์)

**กรอบคำตอบ (ต้องมีครบ):**
1. ชื่อ/ประเภทตำรับ (สมุนไพรเดี่ยว หรือ ตำรับ)
2. ส่วนประกอบหลัก (ถ้าเป็นตำรับ)
3. ข้อบ่งใช้/สรรพคุณตามตำรา
4. ขนาดยาและวิธีใช้ (ถ้าทราบ)
5. ข้อควรระวัง / ข้อห้ามใช้ / กลุ่มเสี่ยง
6. Drug-Herb Interaction ที่ทราบ (ถ้ามี)
7. สถานะในบัญชียาหลักแห่งชาติ (ถ้าทราบ)

**สำคัญ:**
- ตอบเฉพาะสิ่งที่มั่นใจ ถ้าไม่ทราบให้ระบุ "ไม่มีข้อมูลที่ยืนยันได้"
- ห้ามแต่งชื่องานวิจัย, PMID, หรือ URL
- ตอบเป็นภาษาไทย รูปแบบ markdown สั้น กระชับ (ไม่เกิน 250 คำ)
- ห้ามใส่คำเตือน/disclaimer ท้ายคำตอบ (ระบบจะเพิ่มให้เอง)

ถ้าคำถามไม่ได้เกี่ยวกับสมุนไพร ยาแผนไทย หรือยาใดๆ เลย ให้ตอบเพียง: "NO_RELEVANT_INFO"`;

    const aiRes = await aiComplete(providers, {
      messages: [{ role: "user", content: prompt }],
      max_tokens: 700,
      temperature: 0.2,
      timeoutMs: 20000,
    });
    const text: string = (aiRes.text || "").trim();
    if (!text || text.includes("NO_RELEVANT_INFO") || text.length < 40) {
      return { summary: "", used: false };
    }
    return { summary: text, used: true };
  } catch (e) {
    console.error("[herbal-chat] fallback ai exception:", e);
    return { summary: "", used: false };
  }
}

function buildContext(herbs: HerbRow[], formulas: FormulaRow[], pubmed: PubMedSource[], extraHerbNames: string[], knowledge: KnowledgeDoc[] = [], includeCommonDisease = false, aiFallback: AiFallback = { summary: "", used: false }, thaijo: ThaiJoSource[] = []): string {

  const parts: string[] = [];

  if (knowledge.length > 0) {
    parts.push("### ความรู้จากคลังเอกสารภายใน (Knowledge Base — จัดการโดยแอดมิน)");
    knowledge.forEach((k, i) => {
      const ref = `K-${i + 1}`;
      parts.push(`
**${k.title}** [${k.category}]
${(k.content || "").length > 1500 ? (k.content || "").slice(0, 1500) + "\n…(ตัดเนื้อหาบางส่วน)" : k.content}
- แหล่งอ้างอิง: ${k.source || "-"}${k.source_url ? ` (${k.source_url})` : ""}
- อ้างอิงภายใน: ${ref}`);
    });
  }

  if (includeCommonDisease && knowledge.length === 0) {
    parts.push("### แนวทางกระทรวงสาธารณสุข: การใช้ยาสมุนไพรใน 10 กลุ่มอาการ (Common Diseases)");
    parts.push(COMMON_DISEASE_GROUPS);
  }



  if (herbs.length > 0) {
    parts.push("### ข้อมูลสมุนไพรจากฐานข้อมูลภายใน (กลุ่มงานการแพทย์แผนไทยและสมุนไพร สสจ.พิษณุโลก)");
    herbs.forEach((h, i) => {
      const ref = `H-${i + 1}`;
      parts.push(`
**${h.name_thai}** (${h.name_scientific || h.name_english || "-"})
- คำอธิบาย: ${h.description || "-"}
- สรรพคุณ: ${(h.properties || []).join(", ") || "-"}
- ขนาดยา: ${h.dosage || "-"}
- วิธีใช้: ${h.usage_instructions || "-"}
- ข้อควรระวัง: ${(h.precautions || []).join("; ") || "-"}
- ข้อห้ามใช้: ${(h.contraindications || []).join("; ") || "-"}
- Drug interactions: ${(h.drug_interactions || []).join("; ") || "-"}
- อ้างอิงภายใน: ${ref}`);
    });
  }

  if (formulas.length > 0) {
    parts.push("\n### ตำรับยาแผนไทยจากฐานข้อมูลภายใน");
    formulas.forEach((f, i) => {
      const ref = `F-${i + 1}`;
      parts.push(`
**${f.name_thai}** ${f.formula_code ? `(${f.formula_code})` : ""}
- ข้อบ่งใช้: ${f.indication || "-"}
- ส่วนประกอบ: ${(f.ingredients || []).slice(0, 8).join(", ") || "-"}
- ขนาดยา: ${f.dosage || "-"}
- ข้อควรระวัง: ${(f.precautions || []).join("; ") || "-"}
- ข้อห้ามใช้: ${(f.contraindications || []).join("; ") || "-"}
- Drug interactions: ${(f.drug_interactions || []).join("; ") || "-"}
- อ้างอิงภายใน: ${ref}`);
    });
  }

  if (extraHerbNames.length > 0) {
    parts.push(`\n### สมุนไพรที่ระบุจากคำถาม (ยังไม่มีในฐานข้อมูลภายใน แต่ใช้ค้น PubMed แล้ว)\n- ${extraHerbNames.join("\n- ")}`);
  }

  if (pubmed.length > 0) {
    parts.push("\n### งานวิจัยที่เกี่ยวข้องจาก PubMed (ดึงมาสด ๆ จาก NCBI)");
    for (const p of pubmed) {
      parts.push(`- PMID: ${p.pmid} | ${p.title} | ${p.authors} (${p.year}) — ${p.journal}`);
    }
  }

  if (thaijo.length > 0) {
    parts.push("\n### งานวิจัยไทยที่เกี่ยวข้องจาก ThaiJO (ดึงมาสด ๆ จากวารสารกลุ่มการแพทย์/เภสัช)");
    for (const t of thaijo) {
      parts.push(`- ${t.title} | ${t.authors || "-"} — ${t.journal} | ลิงก์: ${t.url}`);
    }
  }



  if (aiFallback.used && aiFallback.summary) {
    parts.push(`
### ข้อมูลเสริมจาก AI (ยังไม่ยืนยันจากฐานข้อมูลภายในหรืองานวิจัย — โปรดตรวจสอบซ้ำ)
> แหล่งที่มา: ความรู้ทั่วไปของโมเดล AI (Gemini) ที่ถูกฝึกจากตำราแพทย์แผนไทยและเอกสารสาธารณะ
> ข้อมูลนี้ยังไม่ผ่านการตรวจสอบจากฐานข้อมูลภายในของกลุ่มงานฯ

${aiFallback.summary}
`);
  }

  if (parts.length === 0) {
    return "ไม่พบข้อมูลสมุนไพร/ตำรับ/งานวิจัยที่เกี่ยวข้องในฐานข้อมูลและ PubMed สำหรับคำถามนี้";
  }

  return parts.join("\n");
}


// ---------- System Prompt ----------

const OUT_OF_SCOPE_REFUSAL_MESSAGE = `ขออภัยด้วยครับ ผมคือ **หมอยาพิษณุโลก** ผู้ช่วยให้คำปรึกษาเฉพาะทางด้าน **การแพทย์แผนไทย การแพทย์แผนปัจจุบัน สมุนไพรไทย และอันตรกิริยาระหว่างยา (Drug-Herb Interaction)** ประจำกลุ่มงานการแพทย์แผนไทยและสมุนไพร สำนักงานสาธารณสุขจังหวัดพิษณุโลก

เนื่องจากคำถามของท่านไม่ได้เกี่ยวข้องกับทางด้านการแพทย์แผนไทย การแพทย์แผนปัจจุบัน หรือการดูแลสุขภาพ จึงอยู่นอกเหนือขอบเขตที่ผมสามารถให้ข้อมูลได้ครับ 🙏

ท่านสามารถสอบถามหรือปรึกษาข้อมูลด้านสุขภาพและสมุนไพรได้ดังนี้ครับ:
🌿 **สมุนไพรและตำรับยาแผนไทย:** สรรพคุณ วิธีใช้ ขนาดยา และข้อควรระวัง
💊 **ยาแผนปัจจุบันและอันตรกิริยา:** การใช้ยาสมุนไพรร่วมกับยาแผนปัจจุบัน (Drug-Herb Interaction)
🩺 **การดูแลสุขภาพเบื้องต้น:** การดูแลตนเองตามแนวทาง 10 กลุ่มอาการของกระทรวงสาธารณสุข`;

const SYSTEM_PROMPT = `คุณคือผู้เชี่ยวชาญด้านยาสมุนไพรไทยและ Drug-Herb Interaction ของ "กลุ่มงานการแพทย์แผนไทยและสมุนไพร สำนักงานสาธารณสุขจังหวัดพิษณุโลก"

## ขอบเขตการตอบ (สำคัญที่สุด — อ่านให้เข้าใจก่อนปฏิเสธ)

**อยู่ในขอบเขต — ต้องตอบ:**
- สมุนไพร ตำรับยาแผนไทย บัญชียาหลักด้านสมุนไพร
- ยาแผนปัจจุบันทุกชนิด ทั้งชื่อเต็ม ชื่อสามัญ ชื่อการค้า และชื่อย่อ (เช่น "para" = paracetamol, "บรูเฟน" = ibuprofen, "วาร์ฟาริน" = warfarin)
- Drug-Herb Interaction, Drug-Drug Interaction ที่เกี่ยวกับสมุนไพร
- ขนาดยา วิธีใช้ ข้อห้าม ข้อควรระวัง ผลข้างเคียง
- อาการ/โรคทั่วไปที่ใช้สมุนไพรดูแลตนเอง (10 กลุ่มอาการ common disease)
- กลุ่มเฉพาะ: หญิงตั้งครรภ์ ให้นมบุตร เด็ก ผู้สูงอายุ ผู้ป่วยตับ/ไต

**พิจารณาบริบทสนทนา (Conversation History):**
- ถ้าเทิร์นก่อนหน้าพูดถึงสมุนไพร/ตำรับ/ยา แล้วเทิร์นใหม่เป็นคำถามสั้น/สรรพนาม/ต่อเนื่อง (เช่น "แล้วขนาดเท่าไร", "กินร่วมกับ para ได้ไหม", "ใช้กี่วัน", "มีผลข้างเคียงไหม") → **ถือว่าอยู่ในขอบเขตต่อเนื่อง ตอบต่อทันที** โดยผูกกับหัวข้อเดิม
- อย่าปฏิเสธเพียงเพราะคำถามใหม่สั้นหรือไม่มีคำว่า "สมุนไพร"

**นอกขอบเขต — ห้ามตอบคำถามเด็ดขาด และปฏิเสธด้วยข้อความสุภาพมาตรฐาน:**
${OUT_OF_SCOPE_REFUSAL_MESSAGE}

เฉพาะเมื่อคำถามชัดเจนว่าไม่เกี่ยวข้องกับการแพทย์แผนไทย การแพทย์แผนปัจจุบัน หรือการดูแลสุขภาพ เช่น การเมือง กีฬา พยากรณ์อากาศ เขียนโค้ด แปลภาษา ดูดวง เรื่องส่วนตัวของ AI
(ห้ามตอบเนื้อหาของคำถามนั้นแม้แต่น้อย และไม่ต้องใส่หัวข้อ "📚 เอกสารอ้างอิง (APA 7th Edition)")

**ตัวอย่าง:**
- "ยาจันทน์ลีลาใช้ลดไข้ได้ไหม ขนาดเท่าไร?" → ตอบ (ในขอบเขต)
- "กินร่วมกับ para ได้ไหม" (หลังพูดถึงยาจันทน์ลีลา) → ตอบเรื่อง interaction paracetamol × ยาจันทน์ลีลา
- "แปะก๊วยกินกับวาร์ฟารินได้ไหม" → ตอบ (ในขอบเขต)
- "วันนี้อากาศเป็นยังไง" → ปฏิเสธ
- "เขียนโปรแกรม python ให้หน่อย" → ปฏิเสธ


2. **ห้ามสร้างหรือแต่งแหล่งอ้างอิงเอง (No Hallucination)** — ใช้ได้เฉพาะแหล่งอ้างอิงที่มีอยู่ใน <CONTEXT> ที่ระบบให้มาเท่านั้น
3. **ลำดับความสำคัญของข้อมูล**:
   - ถ้ามีทั้ง internal DB และ PubMed → ใช้ทั้งสอง
   - ถ้ามีแค่ PubMed (ไม่มีใน internal DB) → **ตอบได้** โดยอ้างอิงเฉพาะ PubMed และแจ้งว่า "สมุนไพร/ยานี้ยังไม่มีในฐานข้อมูลภายใน แต่มีงานวิจัยอ้างอิงจาก PubMed"
   - ถ้ามีเฉพาะ "ข้อมูลเสริมจาก AI" (fallback) → **ตอบตามข้อมูลนั้นได้** โดยไม่ต้องขึ้นต้นด้วยข้อความเตือนพิเศษ แต่ให้แนะนำให้ปรึกษาผู้เชี่ยวชาญตามปกติ
   - ถ้าไม่มีข้อมูลจากแหล่งใดเลย → ตอบว่า "ยังไม่มีข้อมูลที่ตรวจสอบได้" แล้วแนะนำให้ปรึกษาแพทย์/เภสัชกร

   - **ถ้า CONTEXT มีข้อมูลแนวทาง/นโยบายกระทรวงสาธารณสุข (เช่น 10 กลุ่มอาการ common disease, บัญชียาหลักแห่งชาติด้านสมุนไพร) → ตอบได้เต็มที่ตามเนื้อหาที่ให้มา โดยอ้างอิงว่า "อ้างอิงจากกรมการแพทย์แผนไทยฯ/บัญชียาหลักแห่งชาติด้านสมุนไพร"**
4. **ห้ามใส่ URL หรือ PMID ที่ไม่ได้อยู่ใน CONTEXT** เวลาอ้าง PubMed ให้ใส่แค่ "(PMID: 12345678)" — ระบบจะทำลิงก์ให้เอง
5. **งานวิจัยไทยจาก ThaiJO** ถ้า CONTEXT มีหัวข้อ "งานวิจัยไทยที่เกี่ยวข้องจาก ThaiJO" ให้ใช้อ้างอิงได้ โดยระบุชื่อบทความและชื่อวารสารไทย (เช่น "(วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก)") — ห้ามใส่ URL เอง ระบบจะทำลิงก์ให้
6. **ความถูกต้องตรงประเด็นของเอกสารอ้างอิง (Strict Citation Relevance):**
   - ให้อ้างอิงเฉพาะสมุนไพร ตำรับยา หรือบทความวิจัยที่**ตรงกับประเด็นคำถามของผู้ใช้โดยตรงเท่านั้น**
   - **ห้าม** อ้างอิงสมุนไพรเดี่ยวหรือบทความวิจัยที่ไม่เกี่ยวข้องกับคำถามเด็ดขาด (เช่น หากถามถึง "ตำรับยาจันทน์ลีลา" ห้ามนำงานวิจัยฟ้าทะลายโจร หรืองานวิจัยสมุนไพรตัวอื่นที่ไม่เกี่ยวข้องมาอ้างอิงเป็นอันขาด แม้จะมีระบุอยู่ในบริบทอื่นก็ตาม)
   - หากไม่มีงานวิจัยที่ตรงกับสมุนไพรหรือตำรับนั้นโดยตรง ไม่ต้องยกบทความวิจัยอื่นที่ไม่เกี่ยวข้องมาใส่ ให้อ้างอิงจากฐานข้อมูลตำรับยาหรือคู่มือกรมการแพทย์แผนไทยฯ เท่านั้น
7. **ข้อมูลภายในจากฐานข้อมูล** ถ้าต้องอ้างอิง ให้ใช้รหัสย่อที่ปรากฏใน CONTEXT เช่น "(H-1)", "(F-1)" หรือ "(K-1)" — ห้ามเขียน UUID ยาว ๆ ในคำตอบ

## รูปแบบคำตอบ
- ตอบเป็น Markdown ภาษาไทย มีโครงสร้างชัดเจน
- **อันตรกิริยากับยาแผนปัจจุบัน (Drug-Herb Interaction) ต้องแสดงผลเป็นตาราง Markdown เสมอ:**
  เมื่อมีการวิเคราะห์อันตรกิริยาระหว่างยากับสมุนไพร หรือยาแผนปัจจุบันกับสมุนไพร/ตำรับยา ให้สรุปเป็นตาราง Markdown เพื่อให้อ่านง่าย มีโครงสร้างคอลัมน์ดังนี้:
  | สมุนไพร / ตำรับยา | ยาแผนปัจจุบัน | ระดับความรุนแรง | กลไก / ผลกระทบที่อาจเกิดขึ้น | คำแนะนำทางคลินิก |
  - ระบุระดับความรุนแรงด้วยไอคอนและข้อความชัดเจน: 🔴 รุนแรงมาก (Major) / 🟡 ปานกลาง (Moderate) / 🟢 เล็กน้อย (Minor)
  - หากมีรายละเอียดกลไกเชิงลึก สามารถอธิบายเพิ่มเติมใต้ตารางได้
- ถ้าเป็นขนาดยา ระบุกลุ่มเฉพาะที่ต้องระวัง (หญิงตั้งครรภ์, เด็ก, ผู้ป่วยตับ/ไต ฯลฯ)
- **แสดงเอกสารอ้างอิงตามมาตรฐาน APA 7th Edition:**
  ก่อนส่วนคำเตือน ให้แสดงหัวข้อ "### 📚 เอกสารอ้างอิง (APA 7th Edition)" แล้วระบุรายการอ้างอิงตามรูปแบบ APA 7:
  - ฐานข้อมูลภายใน (ต้องมีลิงก์เปิดดูข้อมูลยาเสมอ เพื่อให้ผู้ใช้กดดูรายละเอียดได้ทันที): สำนักงานสาธารณสุขจังหวัดพิษณุโลก. (2568). *[ฐานข้อมูลสมุนไพรและตำรับยาไทย: [ชื่อสมุนไพร/ตำรับ]](/herbs?name=[ชื่อสมุนไพร/ตำรับ])*. กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก กระทรวงสาธารณสุข.
  - ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน ม.มหิดล (อ้างอิงเฉพาะคู่สมุนไพรและยาที่ผู้ใช้ถามเท่านั้น ห้ามนำสมุนไพรอื่นที่ผู้ใช้ไม่ได้ถามมาอ้างอิงเด็ดขาด): ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ มหาวิทยาลัยมหิดล. (ม.ป.ป.). *ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน: [ชื่อสมุนไพร] กับ [ชื่อยา]*. URL
  - บัญชียาหลักแห่งชาติด้านสมุนไพร (ให้อ้างอิงปี พ.ศ. ตามฉบับของรายการยานั้น):
    - รายการยาฉบับปรับปรุงใหม่ พ.ศ. 2568: คณะกรรมการพัฒนาระบบยาแห่งชาติ. (2568). *ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (ฉบับที่ 2) พ.ศ. 2568*. ราชกิจจานุเบกษา.
    - รายการยาฉบับเดิม พ.ศ. 2566: คณะกรรมการพัฒนาระบบยาแห่งชาติ. (2566). *ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร พ.ศ. 2566*. ราชกิจจานุเบกษา.
  - 10 กลุ่มอาการ: กรมการแพทย์แผนไทยและการแพทย์ทางเลือก. (2567). *คู่มือการใช้ยาสมุนไพรในการดูแลสุขภาพเบื้องต้น 10 กลุ่มอาการ*. กระทรวงสาธารณสุข.
  - งานวิจัย PubMed: Author, A. A. (Year). Title of article. *Journal*, Volume(Issue), Pages. https://pubmed.ncbi.nlm.nih.gov/PMID/
- ปิดท้ายด้วยคำเตือน: "⚕️ ข้อมูลนี้เป็นข้อมูลทั่วไปเพื่อการศึกษา ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้"
- ถ้าเป็น Major interaction เพิ่ม: "🚨 หากมีอาการผิดปกติ ให้หยุดใช้ทันทีและติดต่อแพทย์หรือโทร 1669"

## Metadata (บังคับ)
ท้ายคำตอบให้ใส่ 2 บล็อกนี้เสมอ:

[METADATA]
category: <herbal_info|drug_interaction|dosage|side_effects|general>
severity: <major|moderate|minor|none>
herbs: <ชื่อสมุนไพรที่กล่าวถึง คั่นด้วย ,>
drugs: <ชื่อยาแผนปัจจุบันที่กล่าวถึง คั่นด้วย ,>
[/METADATA]

[SOURCES]
<คัดลอกส่วน "แหล่งอ้างอิงที่ใช้จริง" ที่ระบบให้มาใน CONTEXT — ห้ามเปลี่ยนแปลง>
[/SOURCES]`;

// ---------- Handler ----------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, settings } = await req.json();
    const enableExternal = settings?.enable_external_research !== false;
    const enableInternal = settings?.enable_internal_db !== false;
    const enableMahidol = settings?.enable_mahidol_ddi !== false;

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const question: string = lastUserMsg?.content || "";

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ผู้ให้บริการ AI ที่เปิดใช้งาน เรียงตามลำดับความสำคัญ (ใช้สลับอัตโนมัติเมื่อเจ้าแรกล่ม)
    const providers = await loadActiveProviders(supabase);
    console.log("[herbal-chat] active providers:", providers.map((p) => `${p.priority}:${p.name}`).join(", ") || "(none — ใช้ AI ภายในระบบ)");

    const isCommonDisease = isCommonDiseaseQuestion(question);

    // ขั้นที่ 0: ให้ AI จำแนกเจตนา + สกัดคำอาการ/ชื่อยา ก่อนค้นข้อมูล
    const intent = await classifyIntent(question, messages, providers);
    console.log("[herbal-chat] intent:", JSON.stringify(intent));

    // หากคำถามอยู่นอกขอบเขตการแพทย์แผนไทย การแพทย์แผนปัจจุบัน หรือการดูแลสุขภาพ ให้ปฏิเสธอย่างสุภาพทันที
    if (!intent.in_scope) {
      console.log("[herbal-chat] out-of-scope question detected:", question);
      const outOfScopeResponse = `${OUT_OF_SCOPE_REFUSAL_MESSAGE}\n\n[METADATA]\ncategory: general\nseverity: none\nherbs:\ndrugs:\n[/METADATA]\n\n[SOURCES]{"pubmed":[],"thaijo":[],"internal":[],"knowledge":[]}[/SOURCES]`;

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const CHUNK = 60;
          for (let i = 0; i < outOfScopeResponse.length; i += CHUNK) {
            const piece = outOfScopeResponse.slice(i, i + CHUNK);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`),
            );
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      });
    }

    // รันการค้นหาแบบขนาน (DB + knowledge) เฉพาะเมื่อเปิดใช้งานฐานข้อมูลภายในหรือฐานข้อมูลมหิดล
    const knowledgeQuery = [question, ...intent.symptoms, ...intent.herbs, ...intent.drugs].join(" ");
    const [{ herbs, formulas, nameMatchedHerbNames, nameMatchedFormulaNames, listMode }, rawKnowledge] = (enableInternal || enableMahidol)
      ? await Promise.all([
          enableInternal
            ? findRelevantHerbs(supabase, question, intent)
            : Promise.resolve({ herbs: [], formulas: [], nameMatchedHerbNames: [], nameMatchedFormulaNames: [], listMode: false }),
          findRelevantKnowledge(supabase, knowledgeQuery, enableMahidol),
        ])
      : [
          { herbs: [], formulas: [], nameMatchedHerbNames: [], nameMatchedFormulaNames: [], listMode: false },
          [],
        ];

    // กรองเอกสาร DDI ของ ม.มหิดล ให้ตรงกับสมุนไพรและยาที่ผู้ใช้ถามจริง ห้ามปนสมุนไพรอื่น
    const knowledge = enableMahidol
      ? filterStrictDdiKnowledge(question, rawKnowledge, intent.herbs, intent.drugs)
      : rawKnowledge;

    // รันการค้นหา PubMed และ ThaiJO เฉพาะเมื่อเปิดใช้งานแหล่งวิจัยภายนอก
    const { query: pubmedQuery, extraHerbNames, drugTerms } = enableExternal
      ? buildPubMedQuery(question, herbs)
      : { query: "", extraHerbNames: [], drugTerms: [] };

    const thaijoQuery = (!enableExternal || isCommonDisease)
      ? ""
      : buildThaiJoQuery(question, herbs, formulas, nameMatchedFormulaNames, nameMatchedHerbNames);

    const [pubmed, thaijo] = enableExternal
      ? await Promise.all([
          pubmedQuery ? fetchPubMed(pubmedQuery) : Promise.resolve([] as PubMedSource[]),
          thaijoQuery
            ? fetchThaiJo(thaijoQuery, question, herbs, formulas, nameMatchedFormulaNames, nameMatchedHerbNames)
            : Promise.resolve([] as ThaiJoSource[]),
        ])
      : [[], []];

    console.log("[herbal-chat] question:", question);
    console.log("[herbal-chat] common disease intent:", isCommonDisease);
    console.log("[herbal-chat] matched herbs:", herbs.map((h) => h.name_thai));
    console.log("[herbal-chat] matched formulas:", formulas.map((f) => f.name_thai));
    console.log("[herbal-chat] matched knowledge:", knowledge.map((k) => k.title));
    console.log("[herbal-chat] extra herbs from dict:", extraHerbNames);
    console.log("[herbal-chat] matched drug terms:", drugTerms);
    console.log("[herbal-chat] pubmed query:", pubmedQuery);
    console.log("[herbal-chat] pubmed results:", pubmed.length);
    console.log("[herbal-chat] thaijo query:", thaijoQuery, "results:", thaijo.length);


    // AI Fallback: ถ้าไม่มีข้อมูลจากทุกแหล่ง → ให้ Gemini สรุปความรู้ทั่วไปมาเป็น context
    // ใช้ผลจากตัวจำแนกเจตนา (is_follow_up) แทนเกณฑ์ "คำถามสั้นกว่า 40 ตัวอักษร"
    let aiFallback: AiFallback = { summary: "", used: false };
    const noInternal = herbs.length === 0 && formulas.length === 0 && knowledge.length === 0;
    const hasHistory = Array.isArray(messages) && messages.filter((m: any) => m.role === "assistant").length > 0;
    const isFollowUp = hasHistory && intent.is_follow_up;
    if (noInternal && pubmed.length === 0 && thaijo.length === 0 && !isCommonDisease && !isFollowUp && intent.in_scope) {
      console.log("[herbal-chat] triggering AI fallback (no internal/pubmed match)");
      aiFallback = await fetchAiFallback(question, providers);
      console.log("[herbal-chat] AI fallback used:", aiFallback.used, "len:", aiFallback.summary.length);
    } else if (isFollowUp) {
      console.log("[herbal-chat] skip AI fallback (follow-up question)");
    }


    let internalSources: InternalSource[] = enableInternal
      ? [
          ...herbs.map((h) => ({ type: "herb" as const, id: h.id, name: h.name_thai })),
          ...formulas.map((f) => ({ type: "formula" as const, id: f.id, name: f.name_thai })),
        ]
      : [];
    if (nameMatchedFormulaNames.length > 0 && nameMatchedHerbNames.length === 0) {
      internalSources = internalSources.filter(
        (s) => s.type === "formula" && nameMatchedFormulaNames.some((fn) => s.name.toLowerCase().includes(fn.toLowerCase()) || fn.toLowerCase().includes(s.name.toLowerCase())),
      );
    } else if (nameMatchedHerbNames.length > 0) {
      internalSources = internalSources.filter((s) => {
        if (s.type === "herb") {
          return nameMatchedHerbNames.some((hn) => s.name.toLowerCase().includes(hn.toLowerCase()) || hn.toLowerCase().includes(s.name.toLowerCase()));
        }
        if (s.type === "formula") {
          return nameMatchedHerbNames.some((hn) => s.name.toLowerCase().includes(hn.toLowerCase()));
        }
        return true;
      });
    }
    const knowledgeSources: KnowledgeSource[] = (enableInternal || enableMahidol)
      ? knowledge.map((k) => ({
          id: k.id, title: k.title, category: k.category, content: k.content, source: k.source, source_url: k.source_url,
        }))
      : [];

    // ใส่แนวทาง 10 กลุ่มอาการของกระทรวงฯ ให้ด้วย เมื่อเป็นคำถามอาการที่ค้นภายในไม่เจอ
    const includeCommonDisease = isCommonDisease || (intent.type === "symptom" && noInternal);
    const contextBlock = buildContext(
      enableInternal ? herbs : [],
      enableInternal ? formulas : [],
      enableExternal ? pubmed : [],
      enableExternal ? extraHerbNames : [],
      (enableInternal || enableMahidol) ? knowledge : [],
      includeCommonDisease,
      aiFallback,
      enableExternal ? thaijo : []
    );
    const sourcesJson = JSON.stringify({
      pubmed: enableExternal ? pubmed : [],
      thaijo: enableExternal ? thaijo : [],
      internal: enableInternal ? internalSources : [],
      knowledge: (enableInternal || enableMahidol) ? knowledgeSources : [],
      ...(includeCommonDisease ? { policy: ["กรมการแพทย์แผนไทยและการแพทย์ทางเลือก กระทรวงสาธารณสุข", "บัญชียาหลักแห่งชาติด้านสมุนไพร"] } : {}),
      ...(aiFallback.used ? { ai_fallback: ["ความรู้ทั่วไปของ AI (Gemini) — ยังไม่ยืนยันจากฐานข้อมูลภายใน"] } : {}),
    });

    const listInstruction = listMode && (formulas.length > 0 || herbs.length > 0)
      ? `\n\nคำถามนี้เป็นคำถามแบบ "ขอรายชื่อ" — ต้องระบุ **ชื่อทุกรายการ** ที่อยู่ใน CONTEXT ให้ครบ (ตำรับ ${formulas.length} รายการ, สมุนไพร ${herbs.length} รายการ) เป็นรายการหัวข้อย่อย ห้ามตอบว่า "ข้อมูลไม่ได้ระบุชื่อ" ทั้งที่มีชื่ออยู่ใน CONTEXT`
      : "";

    // คำสั่งพิเศษตามการตั้งค่าเปิด-ปิดแหล่งข้อมูล
    let settingsInstruction = "";
    if (!enableExternal) {
      settingsInstruction += "\n\n⚠️ คำสั่งพิเศษ: ขณะนี้ระบบปิดการดึงข้อมูลวิจัยภายนอก (PubMed และ ThaiJO) ห้ามแต่งหรืออ้างอิงงานวิจัยภายนอก และไม่ต้องใส่หัวข้อ '📚 เอกสารอ้างอิง (APA 7th Edition)' ของงานวิจัยภายนอก";
    }
    if (!enableInternal) {
      settingsInstruction += "\n\n⚠️ คำสั่งพิเศษ: ขณะนี้ระบบปิดการใช้ฐานข้อมูลภายในเว็บ ให้ตอบตามหลักวิชาการทั่วไปและการดูแลสุขภาพเบื้องต้น";
    }
    if (!enableMahidol) {
      settingsInstruction += "\n\n⚠️ คำสั่งพิเศษ: ขณะนี้ระบบปิดการใช้ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบันของ ม.มหิดล ห้ามนำข้อมูล DDI มหิดลมาอ้างอิง";
    }

    // ผลการจำแนกเจตนาเป็นตัวตัดสินว่าจะปฏิเสธหรือไม่ (โมเดลหลักไม่ต้องตัดสินเอง)
    const scopeInstruction = intent.in_scope
      ? `\n\n**ระบบได้ตรวจสอบแล้วว่าคำถามนี้อยู่ในขอบเขต (${intent.type}) — ห้ามปฏิเสธคำถามนี้เด็ดขาด ห้ามตอบว่า "ไม่สามารถตอบคำถามนอกเหนือจากนี้ได้"**
ต้องใช้ข้อมูลสมุนไพร ตำรับยา หรืองานวิจัยที่มีอยู่ใน CONTEXT ตอบเป็นลำดับแรกอย่างครบถ้วน หากไม่มีข้อมูลตรง ๆ ใน CONTEXT จริง จึงให้ตอบด้วยแนวทางการดูแลสุขภาพตาม 10 กลุ่มอาการของกรมการแพทย์แผนไทยฯ พร้อมระบุว่ายังไม่มีรายละเอียดเฉพาะในฐานข้อมูล และแนะนำให้ปรึกษาแพทย์แผนไทยหรือเภสัชกร — ห้ามตอบว่าอยู่นอกขอบเขต`
      : `\n\nระบบประเมินว่าคำถามนี้อาจอยู่นอกขอบเขต — ถ้าไม่เกี่ยวกับสุขภาพ ยา หรือสมุนไพรจริง ให้ปฏิเสธด้วยข้อความมาตรฐาน`;

    const contextMessage = {
      role: "system" as const,
      content: `<CONTEXT>
${contextBlock}
</CONTEXT>

<แหล่งอ้างอิงที่ใช้จริง>
${sourcesJson}
</แหล่งอ้างอิงที่ใช้จริง>

จำไว้: อ้างอิงเฉพาะจาก CONTEXT ข้างต้นเท่านั้น ห้ามแต่งแหล่งอ้างอิงใหม่ และเวลาใส่ [SOURCES] ให้คัดลอก JSON ในแท็ก <แหล่งอ้างอิงที่ใช้จริง> ทั้งหมดโดยไม่แก้ไข${listInstruction}${scopeInstruction}${settingsInstruction}`,
    };

    // ---- ขั้นที่ 1: ร่างคำตอบ ----
    let finalAnswer = "";
    try {
      const draftResult = await aiComplete(providers, {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          contextMessage,
          ...(Array.isArray(messages) ? messages.slice(-10) : messages),
        ],
        temperature: 0.2,
        timeoutMs: 35000,
      });
      finalAnswer = draftResult.text || "";
    } catch (err) {
      console.error("[herbal-chat] draft generation failed on all providers:", err);
      finalAnswer = "ขออภัยครับ ระบบให้คำปรึกษาไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้งในภายหลัง หรือปรึกษาแพทย์แผนไทย/เภสัชกรที่สถานพยาบาลใกล้บ้าน";
    }

    // ---- ขั้นที่ 1.5: ถ้าปฏิเสธทั้งที่คำถามอยู่ในขอบเขต → ร่างใหม่ทันที ----
    const looksRefusal = (t: string) =>
      t.includes("อยู่นอกเหนือขอบเขต") ||
      t.includes("ไม่ได้เกี่ยวข้องกับทางด้านการแพทย์") ||
      t.includes("ไม่สามารถตอบคำถามนอกเหนือจากนี้ได้");
    if (intent.in_scope && looksRefusal(finalAnswer)) {
      console.log("[herbal-chat] wrong refusal detected → regenerating");
      try {
        const retryResult = await aiComplete(providers, {
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            contextMessage,
            ...(Array.isArray(messages) ? messages.slice(-10) : messages),
            {
              role: 'system',
              content: `คำตอบก่อนหน้าปฏิเสธคำถามนี้ ซึ่ง**ผิด** — คำถามนี้อยู่ในขอบเขตด้านสุขภาพ/สมุนไพร (${intent.type}${intent.symptoms.length ? `: ${intent.symptoms.join(", ")}` : ""})
ให้ตอบใหม่แบบเป็นประโยชน์ทันที: แนะนำสมุนไพร/ตำรับที่เหมาะกับอาการตาม CONTEXT และแนวทาง 10 กลุ่มอาการของกรมการแพทย์แผนไทยฯ พร้อมขนาดยา ข้อควรระวัง คำเตือนให้ปรึกษาแพทย์/เภสัชกร และบล็อก [METADATA]/[SOURCES] ตามรูปแบบ ห้ามปฏิเสธ`,
            },
          ],
          temperature: 0.2,
          timeoutMs: 35000,
        });
        const retryText: string = retryResult.text || "";
        if (retryText.trim().length > 40 && !looksRefusal(retryText)) finalAnswer = retryText;
      } catch (e) {
        console.error("[herbal-chat] regenerate failed:", e);
      }
    }

    // ---- ขั้นที่ 2: ตรวจสอบคำตอบก่อนส่งให้ผู้ใช้ (Answer Verification) ----
    const isRefusal = looksRefusal(finalAnswer);
    if (finalAnswer.trim().length > 0 && !isRefusal) {
      try {
        const verifyResult = await aiComplete(providers, {
          messages: [
            {
              role: 'system',
              content: `คุณคือผู้ตรวจสอบความถูกต้องของคำตอบด้านยาสมุนไพรไทย ตรวจ "ร่างคำตอบ" เทียบกับ CONTEXT ตามเกณฑ์:
1. ชื่อสมุนไพร/ตำรับที่ตอบต้องมีอยู่จริงใน CONTEXT (ห้ามแต่งชื่อขึ้นเอง หรือเอา "ข้อบ่งใช้" มาใช้เป็นชื่อยา)
2. ข้อบ่งใช้ ขนาดยา ข้อห้าม ข้อควรระวัง ต้องตรงกับ CONTEXT
3. ถ้าคำถามขอ "รายชื่อ" ต้องระบุชื่อรายการที่มีใน CONTEXT ให้ครบ ห้ามตอบว่าไม่ได้ระบุชื่อทั้งที่ CONTEXT มี
4. PMID/ลิงก์/แหล่งอ้างอิง ต้องมาจาก CONTEXT เท่านั้น
5. แหล่งอ้างอิงและงานวิจัยที่ระบุในคำตอบต้องตรงกับเรื่องที่ผู้ใช้ถามโดยตรงเท่านั้น ห้ามอ้างอิงสมุนไพรเดี่ยวหรือบทความวิจัยที่ไม่เกี่ยวข้องกับคำถาม (เช่น ถามตำรับยาจันทน์ลีลา ห้ามอ้างอิงฟ้าทะลายโจร หรือตะไคร้)
6. ต้องคงรูปแบบเดิมไว้ทั้งหมด รวมถึงบล็อก [METADATA] และ [SOURCES] ห้ามแก้ไขเนื้อหาในบล็อกเหล่านั้น

ผลลัพธ์:
- ถ้าถูกต้องครบถ้วน ตอบกลับคำเดียวว่า: PASS
- ถ้าไม่ถูกต้อง ให้ส่ง "คำตอบฉบับแก้ไข" ฉบับเต็ม (ภาษาไทย Markdown พร้อมบล็อก [METADATA] และ [SOURCES]) โดยไม่ต้องอธิบายเหตุผลใด ๆ`,
            },
            {
              role: 'user',
              content: `<CONTEXT>\n${contextBlock}\n</CONTEXT>\n\n<แหล่งอ้างอิงที่ใช้จริง>\n${sourcesJson}\n</แหล่งอ้างอิงที่ใช้จริง>\n\n<คำถามผู้ใช้>\n${question}\n</คำถามผู้ใช้>\n\n<ร่างคำตอบ>\n${finalAnswer}\n</ร่างคำตอบ>`,
            },
          ],
          timeoutMs: 25000,
        });
        const verdict = (verifyResult.text || "").trim();
        if (verdict && !/^pass\b/i.test(verdict) && verdict.length > 80) {
          console.log("[herbal-chat] verification: corrected answer");
          finalAnswer = verdict;
        } else {
          console.log("[herbal-chat] verification: PASS");
        }
      } catch (e) {
        console.error("[herbal-chat] verification exception:", e);
      }
    }

    // หากคำตอบเป็นการปฏิเสธ ต้องมั่นใจว่า Sources เป็นค่าว่าง ไม่มี citation ติดมา
    if (looksRefusal(finalAnswer)) {
      finalAnswer = finalAnswer.replace(
        /\[SOURCES\][\s\S]*?\[\/SOURCES\]/,
        `[SOURCES]{"pubmed":[],"thaijo":[],"internal":[],"knowledge":[]}[/SOURCES]`
      );
    }

    // ตัด code fence ที่โมเดลบางครั้งครอบคำตอบมา (```markdown ... ```)
    finalAnswer = finalAnswer.trim().replace(/^```(?:markdown|md)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

    // ---- ส่งคำตอบกลับเป็น SSE (รูปแบบเดิมที่หน้าเว็บรองรับ) ----
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const CHUNK = 60;
        for (let i = 0; i < finalAnswer.length; i += CHUNK) {
          const piece = finalAnswer.slice(i, i + CHUNK);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`),
          );
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (e) {
    console.error('herbal-chat error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
