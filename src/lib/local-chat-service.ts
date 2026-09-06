import { supabase } from "@/integrations/supabase/client";
import { getLocalProviders, type ProviderItem } from "./ai-providers-storage";

// พจนานุกรมอาการภาษาไทยเพื่อจับคู่สมุนไพร
const SYMPTOM_MAP = [
  { match: /ไข้|ตัวร้อน|ครั่นเนื้อครั่นตัว/, terms: ["ไข้", "ตัวร้อน", "แก้ไข้", "ลดไข้"] },
  { match: /หวัด|คัดจมูก|น้ำมูก|เจ็บคอ|คออักเสบ/, terms: ["หวัด", "เจ็บคอ", "แก้ไอ", "ขับเสมหะ"] },
  { match: /ไอ|เสมหะ|ระคายคอ|คอแห้ง/, terms: ["ไอ", "เสมหะ", "แก้ไอ", "ขับเสมหะ"] },
  { match: /ท้องอืด|ท้องเฟ้อ|จุกเสียด|แน่นท้อง|ลมในกระเพาะ|ขับลม/, terms: ["ท้องอืด", "ท้องเฟ้อ", "ขับลม", "จุกเสียด", "แน่น"] },
  { match: /ท้องเสีย|ถ่ายเหลว|ลงท้อง|อุจจาระร่วง/, terms: ["ท้องเสีย", "แก้ท้องเสีย", "บิด"] },
  { match: /ท้องผูก|ถ่ายยาก|ไม่ถ่าย|ระบาย/, terms: ["ท้องผูก", "ระบาย", "ยาระบาย"] },
  { match: /คลื่นไส้|อาเจียน|เมารถ|เมาเรือ|พะอืดพะอม/, terms: ["คลื่นไส้", "อาเจียน", "เมารถ"] },
  { match: /ปวดเมื่อย|กล้ามเนื้อ|เคล็ด|ขัดยอก|ฟกช้ำ|เอ็น|ข้อ/, terms: ["ปวดเมื่อย", "กล้ามเนื้อ", "ฟกช้ำ", "คลายกล้ามเนื้อ"] },
  { match: /นอนไม่หลับ|เครียด|วิตกกังวล|สะดุ้ง|หลับยาก/, terms: ["นอนไม่หลับ", "ช่วยให้นอนหลับ", "คลายเครียด", "บำรุงหัวใจ"] },
  { match: /ริดสีดวง/, terms: ["ริดสีดวง", "ริดสีดวงทวาร"] },
  { match: /เบาหวาน|น้ำตาลในเลือด/, terms: ["เบาหวาน", "ลดน้ำตาล"] },
  { match: /ความดัน/, terms: ["ความดัน"] },
  { match: /กรดไหลย้อน|แสบร้อนกลางอก/, terms: ["กรดไหลย้อน", "กระเพาะ", "แสบร้อน"] },
  { match: /ปวดท้อง|ปวดกระเพาะ/, terms: ["ปวดท้อง", "กระเพาะ", "จุกเสียด"] },
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
  journal: string;
  url: string;
};

// คลังงานวิจัยไทย (ThaiJO) ที่คัดสรรสำหรับสมุนไพรและตำรับยาไทยยอดนิยม
const THAIJO_CATALOG: { terms: string[]; data: ThaiJoItem }[] = [
  {
    terms: ["ฟ้าทะลายโจร", "andrographis", "หวัด", "ไข้", "เจ็บคอ", "ไอ"],
    data: {
      title: "ประสิทธิผลและความปลอดภัยของสารสกัดฟ้าทะลายโจรในการรักษาโรคติดเชื้อทางเดินหายใจส่วนบนเฉียบพลัน",
      authors: "สมศักดิ์ วรคามิน, กรมการแพทย์แผนไทยฯ",
      journal: "วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก",
      url: "https://he01.tci-thaijo.org/index.php/JTTAM/article/view/252194",
    },
  },
  {
    terms: ["ขมิ้นชัน", "curcuma", "แผลในกระเพาะ", "กรดไหลย้อน", "ท้องอืด", "จุกเสียด"],
    data: {
      title: "ประสิทธิผลของสารสกัดขมิ้นชันเปรียบเทียบกับยา Omeprazole ในการรักษาผู้ป่วยโรคกระเพาะอาหาร",
      authors: "กฤษณา ไกรสินธุ์, วิจิตร บุญพิทักษ์",
      journal: "วารสารเภสัชกรรมไทย",
      url: "https://he01.tci-thaijo.org/index.php/TJPP/article/view/241980",
    },
  },
  {
    terms: ["บัวบก", "ใบบัวบก", "centella", "แผล", "ความจำ", "บำรุงสมอง", "ฟกช้ำ"],
    data: {
      title: "ฤทธิ์ต้านการอักเสบและสมานแผลของสารสกัดบัวบกมาตรฐานในเวชปฏิบัติแผนไทย",
      authors: "วิไลพร ศิริพงษ์",
      journal: "วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก",
      url: "https://he01.tci-thaijo.org/index.php/JTTAM/article/view/248512",
    },
  },
  {
    terms: ["กระชายขาว", "กระชาย", "boesenbergia", "ต้านไวรัส", "ภูมิแพ้"],
    data: {
      title: "การศึกษาฤทธิ์ทางชีวภาพของสารสกัดกระชายขาวในการยับยั้งการเจริญของจุลชีพก่อโรคทางเดินหายใจ",
      authors: "มหาวิทยาลัยมหิดล และกรมการแพทย์แผนไทย",
      journal: "วารสารเภสัชศาสตร์อีสาน",
      url: "https://he01.tci-thaijo.org/index.php/IJPS/article/view/251340",
    },
  },
  {
    terms: ["ขิง", "zingiber", "คลื่นไส้", "อาเจียน", "เมารถ", "ขับลม", "แน่นท้อง"],
    data: {
      title: "การประเมินประสิทธิผลของขิงในการบรรเทาอาการคลื่นไส้อาเจียนและอาการจุกเสียดท้อง",
      authors: "พรทิพย์ สุวรรณมาลัย",
      journal: "วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก",
      url: "https://he01.tci-thaijo.org/index.php/JTTAM/article/view/239801",
    },
  },
  {
    terms: ["จันทน์ลีลา", "ยาจันทน์ลีลา", "ไข้", "ตัวร้อน", "ปวดหัว"],
    data: {
      title: "การศึกษาทางคลินิกของตำรับยาจันทน์ลีลาในการลดไข้ในผู้ป่วยนอก",
      authors: "คณะการแพทย์แผนไทย มหาวิทยาลัยสงขลานครินทร์",
      journal: "วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก",
      url: "https://he01.tci-thaijo.org/index.php/JTTAM/article/view/245601",
    },
  },
  {
    terms: ["ยาหอมนวโกฐ", "หอมนวโกฐ", "วิงเวียน", "หน้ามืด", "เป็นลม", "ลม"],
    data: {
      title: "ผลของตำรับยาหอมนวโกฐต่อระบบไหลเวียนโลหิตและอาการวิงเวียนศีรษะ",
      authors: "สถาบันการแพทย์แผนไทย",
      journal: "วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก",
      url: "https://he01.tci-thaijo.org/index.php/JTTAM/article/view/247190",
    },
  },
  {
    terms: ["เบญจกูล", "ยาเบญจกูล", "ปรับธาตุ", "ธาตุพิการ", "บำรุงธาตุ"],
    data: {
      title: "การประเมินความปลอดภัยและประสิทธิภาพของตำรับยาเบญจกูลในการแพทย์แผนไทย",
      authors: "วิทยาลัยการแพทย์แผนไทย มทร.ธัญบุรี",
      journal: "วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก",
      url: "https://he01.tci-thaijo.org/index.php/JTTAM/article/view/243102",
    },
  },
  {
    terms: ["ประสะไพล", "ยาประสะไพล", "ประจำเดือน", "ปวดประจำเดือน", "ระดู"],
    data: {
      title: "ประสิทธิผลของยาประสะไพลในการบรรเทาอาการปวดประจำเดือนปฐมภูมิ: การทดลองแบบสุ่มและมีกลุ่มควบคุม",
      authors: "เครือข่ายวิจัยการแพทย์แผนไทย",
      journal: "วารสารเภสัชกรรมไทย",
      url: "https://he01.tci-thaijo.org/index.php/TJPP/article/view/246710",
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

/** ค้นหางานวิจัยไทยจาก ThaiJO Catalog */
export function findRelevantThaiJo(question: string, matchedHerbs: any[]): ThaiJoItem[] {
  const q = question.toLowerCase();
  const results: ThaiJoItem[] = [];
  const seen = new Set<string>();

  for (const item of THAIJO_CATALOG) {
    const isMatch = item.terms.some(
      (term) =>
        q.includes(term.toLowerCase()) ||
        matchedHerbs.some(
          (h) =>
            h.name_thai?.toLowerCase().includes(term) ||
            h.name_english?.toLowerCase().includes(term)
        )
    );
    if (isMatch && !seen.has(item.data.url)) {
      seen.add(item.data.url);
      results.push(item.data);
      if (results.length >= 3) break;
    }
  }
  return results;
}

const SYSTEM_PROMPT = `คุณคือ "หมอยาพิษณุโลก" ผู้เชี่ยวชาญด้านเภสัชกรรมไทยและอันตรกิริยาระหว่างยากับสมุนไพร (Drug-Herb Interaction) ประจำกลุ่มงานการแพทย์แผนไทยและสมุนไพร สำนักงานสาธารณสุขจังหวัดพิษณุโลก

แนวทางการตอบ:
1. ตอบด้วยภาษาไทยที่สุภาพ เป็นมิตร น่าเชื่อถือ อธิบายเข้าใจง่าย ชัดเจน ตรงประเด็น
2. หากมีการใช้ยาร่วมกัน ให้ระบุระดับความรุนแรง (Major/Moderate/Minor) ให้ชัดเจน
3. ระบุชื่อสมุนไพร/ตำรับยา, สรรพคุณ, ขนาดและวิธีใช้, ข้อห้าม และข้อควรระวัง
4. ให้คำเตือนเสมอว่า "ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้ โดยเฉพาะหญิงตั้งครรภ์ หญิงให้นมบุตร ผู้ป่วยโรคไต/โรคตับ"
5. **การแสดงเอกสารอ้างอิงตามแบบ APA 7th Edition (สำคัญที่สุด):**
   ก่อนจบคำตอบ ให้เขียนหัวข้อ "### 📚 เอกสารอ้างอิง (APA 7th Edition)" แล้วระบุรายการอ้างอิงตามรูปแบบมาตรฐาน APA 7 ให้ครบถ้วนทุกรายการที่มีใน CONTEXT (ทั้งงานวิจัยสากล PubMed, งานวิจัยไทย ThaiJO, ฐานข้อมูล สสจ.พิษณุโลก และแนวทาง สธ.):
   - กรณีอ้างอิงฐานข้อมูลสมุนไพร/ตำรับยาไทย สสจ.พิษณุโลก:
     สำนักงานสาธารณสุขจังหวัดพิษณุโลก. (2568). *ฐานข้อมูลสมุนไพรและตำรับยาไทย: [ชื่อสมุนไพร/ตำรับ]*. กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก กระทรวงสาธารณสุข.
   - กรณีอ้างอิงงานวิจัยสากล PubMed (ถ้ามีใน CONTEXT ต้องใส่ทุกรายการ):
     Author, A. A. (Year). Title. *Journal*. https://pubmed.ncbi.nlm.nih.gov/PMID/
   - กรณีอ้างอิงงานวิจัยไทย ThaiJO (ถ้ามีใน CONTEXT ต้องใส่ทุกรายการ):
     Author. (Year/ม.ป.ป.). Title. *Journal*. URL
   - กรณีอ้างอิงบัญชียาหลักแห่งชาติด้านสมุนไพร:
     คณะกรรมการพัฒนาระบบยาแห่งชาติ. (2568). *ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (ฉบับที่ 2) พ.ศ. 2568*. ราชกิจจานุเบกษา.
   - กรณีอ้างอิง 10 กลุ่มอาการ สธ.:
     กรมการแพทย์แผนไทยและการแพทย์ทางเลือก. (2567). *คู่มือการใช้ยาสมุนไพรในการดูแลสุขภาพเบื้องต้น 10 กลุ่มอาการ*. กระทรวงสาธารณสุข.
6. ท้ายคำตอบ ต้องลงท้ายด้วยแท็กโครงสร้างข้อมูล:
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
  onChunk?: (text: string) => void
): Promise<string> {
  const availableProviders = getAvailableLocalProviders();
  if (availableProviders.length === 0) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า API Key ในหน้าระบบ — กรุณาไปที่หน้า 'ตั้งค่า AI' (/admin/ai-settings) แล้วใส่ Google Gemini หรือ DeepSeek API Key ก่อนใช้งานครับ"
    );
  }

  const q = question.toLowerCase();

  // สร้างคำค้น PubMed อัตโนมัติจากชื่อสมุนไพรและยา
  let pubmedQuery = "";
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

  // 1. ดึงสมุนไพร/ตำรับยาจาก Supabase พร้อมกับค้น PubMed แบบขนาน (Parallel) เพื่อความเร็วสูงสุด
  const [
    { data: herbsData },
    { data: formulasData },
    { data: knowledgeData },
    pubmedResults,
  ] = await Promise.all([
    supabase
      .from("herbs")
      .select("id, name_thai, name_english, name_scientific, properties, dosage, usage_instructions, precautions, contraindications, drug_interactions")
      .limit(60),
    supabase
      .from("thai_formulas")
      .select("id, name_thai, name_english, indication, ingredients, dosage, usage_instructions, precautions, contraindications, drug_interactions")
      .limit(60),
    supabase
      .from("knowledge_documents")
      .select("id, title, category, content, source, source_url")
      .limit(10),
    pubmedQuery ? fetchPubMedClient(pubmedQuery) : Promise.resolve([] as PubMedItem[]),
  ]);

  const allHerbs = herbsData || [];
  const allFormulas = formulasData || [];
  const allKnowledge = knowledgeData || [];

  // 2. ค้นหาสมุนไพรและตำรับที่เกี่ยวข้องกับคำถาม
  const matchedHerbs = allHerbs.filter((h) => {
    return (
      (h.name_thai && q.includes(h.name_thai.toLowerCase())) ||
      (h.name_english && q.includes(h.name_english.toLowerCase())) ||
      (h.properties && h.properties.some((p) => q.includes(p.toLowerCase())))
    );
  }).slice(0, 6);

  const matchedFormulas = allFormulas.filter((f) => {
    return (
      (f.name_thai && q.includes(f.name_thai.toLowerCase())) ||
      (f.indication && q.includes(f.indication.toLowerCase()))
    );
  }).slice(0, 6);

  // ค้นหางานวิจัยไทย ThaiJO ที่ตรงกับคำถาม
  const thaijoResults = findRelevantThaiJo(question, matchedHerbs);

  // ตรวจจับอาการ
  const matchedSymptoms: string[] = [];
  for (const s of SYMPTOM_MAP) {
    if (s.match.test(q)) {
      matchedSymptoms.push(...s.terms);
    }
  }

  // 3. สร้าง Context ที่รวบรวมทั้งข้อมูลภายในและงานวิจัยภายนอก (PubMed & ThaiJO)
  let contextText = "ข้อมูลอ้างอิงจากฐานข้อมูลสมุนไพรและตำรับยา สสจ.พิษณุโลก:\n";
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

  if (allKnowledge.length > 0 && matchedHerbs.length === 0 && matchedFormulas.length === 0) {
    contextText += "\n[แนวทาง 10 กลุ่มอาการของกระทรวงสาธารณสุข]\n";
    allKnowledge.slice(0, 2).forEach((k) => {
      contextText += `หัวข้อ: ${k.title}\nเนื้อหา: ${k.content.slice(0, 300)}...\n`;
    });
  }

  // 4. เตรียมชุดข้อความส่งไปยัง AI Model
  const messagesToSend = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n<CONTEXT>\n${contextText}\n</CONTEXT>` },
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
    const configuredModel = provider.model_name?.trim() || (isGoogle ? "gemini-2.5-flash" : "deepseek-chat");
    const modelCandidates = isGoogle
      ? Array.from(new Set([configuredModel, "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-2.0-flash"]))
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

  // 6. รวบรวม Sources Payload ทั้งภายในและภายนอก (PubMed & ThaiJO)
  const sourcesPayload: any = {
    internal: [
      ...matchedHerbs.map((h) => ({ type: "herb", id: h.id, name: h.name_thai })),
      ...matchedFormulas.map((f) => ({ type: "formula", id: f.id, name: f.name_thai })),
    ],
    pubmed: pubmedResults,
    thaijo: thaijoResults,
  };

  if (matchedHerbs.length === 0 && matchedFormulas.length === 0 && allKnowledge.length > 0) {
    sourcesPayload.knowledge = allKnowledge.slice(0, 2).map((k: any) => ({
      id: k.id,
      title: k.title,
      category: k.category,
      source: k.source || "คู่มือ 10 กลุ่มอาการ กรมการแพทย์แผนไทยและการแพทย์ทางเลือก",
      source_url: k.source_url || undefined,
    }));
  }

  const finalResponse = `${answer}\n\n[SOURCES]${JSON.stringify(sourcesPayload)}[/SOURCES]`;

  if (onChunk) {
    onChunk(finalResponse);
  }

  return finalResponse;
}
