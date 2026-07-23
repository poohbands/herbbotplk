import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

type InternalSource = {
  type: "herb" | "formula";
  id: string;
  name: string;
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
  "ยาเบาหวาน": "antidiabetic OR metformin",
  "อินซูลิน": "insulin",
  "ยากดภูมิ": "immunosuppressant",
  "ยาปฏิชีวนะ": "antibiotic",
  "ยาแก้ปวด": "analgesic OR NSAID",
  "ยาแก้อักเสบ": "NSAID",
  "สแตติน": "statin",
  "ยาลดไขมัน": "statin",
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
    - สมุนไพร/ตำรับ: ขี้เหล็ก (ใบขี้เหล็ก), ยาหอมเทพจิตร, ยาหอมนวโกฐ
    - สรรพคุณ: ช่วยให้นอนหลับ คลายเครียด บำรุงหัวใจ

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

/** ค้นหาสมุนไพร/ตำรับที่ชื่อปรากฏในคำถาม */
async function findRelevantHerbs(supabase: any, question: string) {
  const q = question.toLowerCase();

  const { data: allHerbs } = await supabase
    .from("herbs")
    .select("id, name_thai, name_english, name_scientific, local_names, description, properties, dosage, usage_instructions, precautions, contraindications, drug_interactions");

  const { data: allFormulas } = await supabase
    .from("thai_formulas")
    .select("id, name_thai, name_english, formula_code, indication, ingredients, dosage, usage_instructions, precautions, contraindications, drug_interactions");

  const matchedHerbs: HerbRow[] = [];
  const matchedFormulas: FormulaRow[] = [];

  for (const h of (allHerbs || []) as HerbRow[]) {
    const names = [h.name_thai, h.name_english, h.name_scientific, ...(h.local_names || [])]
      .filter(Boolean)
      .map((s) => (s as string).toLowerCase());
    if (names.some((n) => n && q.includes(n))) matchedHerbs.push(h);
  }

  for (const f of (allFormulas || []) as FormulaRow[]) {
    const names = [f.name_thai, f.name_english].filter(Boolean).map((s) => (s as string).toLowerCase());
    if (names.some((n) => n && q.includes(n))) matchedFormulas.push(f);
  }

  return { herbs: matchedHerbs, formulas: matchedFormulas };
}

/** สร้าง PubMed query โดยใช้ทั้ง (1) herb ที่ match ใน DB (2) dictionary ไทย→sci (3) dictionary ยาไทย→อังกฤษ */
function buildPubMedQuery(question: string, herbs: HerbRow[]): { query: string; extraHerbNames: string[] } {
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
  // English drug names in the question itself
  const asciiDrugs = q.match(/\b(warfarin|aspirin|clopidogrel|heparin|digoxin|metformin|insulin|statin|ibuprofen|paracetamol)\b/gi);
  if (asciiDrugs) for (const d of asciiDrugs) drugTerms.add(d.toLowerCase());

  // Intent: interaction / adverse
  const interactionIntent = /interaction|ปฏิกิริยา|ตีกัน|ร่วมกับ|ร่วมกัน|กินร่วม/i.test(q) || drugTerms.size > 0;

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

  return { query, extraHerbNames };
}

async function fetchPubMed(query: string): Promise<PubMedSource[]> {
  if (!query.trim()) return [];
  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=5&retmode=json&sort=relevance`;
    const searchResp = await fetch(searchUrl);
    if (!searchResp.ok) return [];
    const searchData = await searchResp.json();
    const pmids: string[] = searchData?.esearchresult?.idlist || [];
    if (pmids.length === 0) return [];

    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=json`;
    const summaryResp = await fetch(summaryUrl);
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

function buildContext(herbs: HerbRow[], formulas: FormulaRow[], pubmed: PubMedSource[], extraHerbNames: string[], includeCommonDisease = false): string {
  const parts: string[] = [];

  if (includeCommonDisease) {
    parts.push("### แนวทางกระทรวงสาธารณสุข: การใช้ยาสมุนไพรใน 10 กลุ่มอาการ (Common Diseases)");
    parts.push(COMMON_DISEASE_GROUPS);
  }


  if (herbs.length > 0) {
    parts.push("### ข้อมูลสมุนไพรจากฐานข้อมูลภายใน (กลุ่มงานการแพทย์แผนไทยและสมุนไพร สสจ.พิษณุโลก)");
    for (const h of herbs) {
      parts.push(`
**${h.name_thai}** (${h.name_scientific || h.name_english || "-"})
- คำอธิบาย: ${h.description || "-"}
- สรรพคุณ: ${(h.properties || []).join(", ") || "-"}
- ขนาดยา: ${h.dosage || "-"}
- วิธีใช้: ${h.usage_instructions || "-"}
- ข้อควรระวัง: ${(h.precautions || []).join("; ") || "-"}
- ข้อห้ามใช้: ${(h.contraindications || []).join("; ") || "-"}
- Drug interactions: ${(h.drug_interactions || []).join("; ") || "-"}
- แหล่งอ้างอิงภายใน id: ${h.id}`);
    }
  }

  if (formulas.length > 0) {
    parts.push("\n### ตำรับยาแผนไทยจากฐานข้อมูลภายใน");
    for (const f of formulas) {
      parts.push(`
**${f.name_thai}** ${f.formula_code ? `(${f.formula_code})` : ""}
- ข้อบ่งใช้: ${f.indication || "-"}
- ส่วนประกอบ: ${(f.ingredients || []).slice(0, 8).join(", ") || "-"}
- ขนาดยา: ${f.dosage || "-"}
- ข้อควรระวัง: ${(f.precautions || []).join("; ") || "-"}
- ข้อห้ามใช้: ${(f.contraindications || []).join("; ") || "-"}
- Drug interactions: ${(f.drug_interactions || []).join("; ") || "-"}
- แหล่งอ้างอิงภายใน id: ${f.id}`);
    }
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

  if (parts.length === 0) {
    return "ไม่พบข้อมูลสมุนไพร/ตำรับ/งานวิจัยที่เกี่ยวข้องในฐานข้อมูลและ PubMed สำหรับคำถามนี้";
  }

  return parts.join("\n");
}

// ---------- System Prompt ----------

const SYSTEM_PROMPT = `คุณคือผู้เชี่ยวชาญด้านยาสมุนไพรไทยและ Drug-Herb Interaction ของ "กลุ่มงานการแพทย์แผนไทยและสมุนไพร สำนักงานสาธารณสุขจังหวัดพิษณุโลก"

## ข้อจำกัดสำคัญที่สุด (บังคับปฏิบัติ)
1. ตอบได้เฉพาะคำถามด้านการแพทย์ ยาสมุนไพร Drug-Herb Interaction เท่านั้น ถ้าถามเรื่องอื่นให้ตอบ: "ผมเป็นที่ปรึกษาด้านยาสมุนไพรและ Drug Interaction ไม่สามารถตอบคำถามนอกเหนือจากนี้ได้ครับ"
2. **ห้ามสร้างหรือแต่งแหล่งอ้างอิงเอง (No Hallucination)** — ใช้ได้เฉพาะแหล่งอ้างอิงที่มีอยู่ใน <CONTEXT> ที่ระบบให้มาเท่านั้น
3. **ลำดับความสำคัญของข้อมูล**:
   - ถ้ามีทั้ง internal DB และ PubMed → ใช้ทั้งสอง
   - ถ้ามีแค่ PubMed (ไม่มีใน internal DB) → **ตอบได้** โดยอ้างอิงเฉพาะ PubMed และแจ้งว่า "สมุนไพร/ยานี้ยังไม่มีในฐานข้อมูลภายใน แต่มีงานวิจัยอ้างอิงจาก PubMed"
   - ถ้าไม่มีทั้งสอง → ตอบว่า "ยังไม่มีข้อมูลจากฐานข้อมูลและงานวิจัยที่ตรวจสอบได้" แล้วแนะนำให้ปรึกษาแพทย์/เภสัชกร
   - **ถ้า CONTEXT มีข้อมูลแนวทาง/นโยบายกระทรวงสาธารณสุข (เช่น 10 กลุ่มอาการ common disease, บัญชียาหลักแห่งชาติด้านสมุนไพร) → ตอบได้เต็มที่ตามเนื้อหาที่ให้มา โดยอ้างอิงว่า "อ้างอิงจากกรมการแพทย์แผนไทยฯ/บัญชียาหลักแห่งชาติด้านสมุนไพร"**
4. **ห้ามใส่ URL หรือ PMID ที่ไม่ได้อยู่ใน CONTEXT** เวลาอ้าง PubMed ให้ใส่แค่ "(PMID: 12345678)" — ระบบจะทำลิงก์ให้เอง

## รูปแบบคำตอบ
- ตอบเป็น Markdown ภาษาไทย มีโครงสร้างชัดเจน
- ถ้าเป็น Drug Interaction ระบุระดับ ⚠️ Major / ⚡ Moderate / ℹ️ Minor
- ถ้าเป็นขนาดยา ระบุกลุ่มเฉพาะที่ต้องระวัง (หญิงตั้งครรภ์, เด็ก, ผู้ป่วยตับ/ไต ฯลฯ)
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
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const question: string = lastUserMsg?.content || "";

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { herbs, formulas } = await findRelevantHerbs(supabase, question);
    const isCommonDisease = isCommonDiseaseQuestion(question);
    const { query: pubmedQuery, extraHerbNames } = buildPubMedQuery(question, herbs);
    // ข้าม PubMed สำหรับคำถามเชิงนโยบาย 10 กลุ่มอาการ (ไม่เกี่ยวข้อง)
    const pubmed = isCommonDisease ? [] : await fetchPubMed(pubmedQuery);

    console.log("[herbal-chat] question:", question);
    console.log("[herbal-chat] common disease intent:", isCommonDisease);
    console.log("[herbal-chat] matched herbs:", herbs.map((h) => h.name_thai));
    console.log("[herbal-chat] matched formulas:", formulas.map((f) => f.name_thai));
    console.log("[herbal-chat] extra herbs from dict:", extraHerbNames);
    console.log("[herbal-chat] pubmed query:", pubmedQuery);
    console.log("[herbal-chat] pubmed results:", pubmed.length);

    const internalSources: InternalSource[] = [
      ...herbs.map((h) => ({ type: "herb" as const, id: h.id, name: h.name_thai })),
      ...formulas.map((f) => ({ type: "formula" as const, id: f.id, name: f.name_thai })),
    ];

    const contextBlock = buildContext(herbs, formulas, pubmed, extraHerbNames, isCommonDisease);
    const sourcesJson = JSON.stringify({
      pubmed,
      internal: internalSources,
      ...(isCommonDisease ? { policy: ["กรมการแพทย์แผนไทยและการแพทย์ทางเลือก กระทรวงสาธารณสุข", "บัญชียาหลักแห่งชาติด้านสมุนไพร"] } : {}),
    });


    const contextMessage = {
      role: "system" as const,
      content: `<CONTEXT>
${contextBlock}
</CONTEXT>

<แหล่งอ้างอิงที่ใช้จริง>
${sourcesJson}
</แหล่งอ้างอิงที่ใช้จริง>

จำไว้: อ้างอิงเฉพาะจาก CONTEXT ข้างต้นเท่านั้น ห้ามแต่งแหล่งอ้างอิงใหม่ และเวลาใส่ [SOURCES] ให้คัดลอก JSON ในแท็ก <แหล่งอ้างอิงที่ใช้จริง> ทั้งหมดโดยไม่แก้ไข`,
    };

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          contextMessage,
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. กรุณารอสักครู่แล้วลองใหม่' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Credits หมด กรุณาเติม credits ที่ Lovable workspace' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      return new Response(JSON.stringify({ error: 'AI gateway error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
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
