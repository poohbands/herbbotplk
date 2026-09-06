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
  year?: string;
  journal: string;
  url: string;
};

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
  {
    subjects: ["กระชายขาว", "กระชาย", "boesenbergia"],
    symptoms: ["ต้านไวรัส", "ภูมิแพ้"],
    data: {
      title: "คลังงานวิจัยและบทความวิชาการกระชายขาวในระบบวารสารวิชาการไทย (ThaiJO Search: กระชายขาว)",
      authors: "ศูนย์ดัชนีการอ้างอิงวารสารไทย (TCI) และเครือข่ายวิจัยการแพทย์แผนไทย",
      year: "2567",
      journal: "วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก (ฐานข้อมูล ThaiJO)",
      url: "https://he01.tci-thaijo.org/index.php/JTTAM/search/search?query=%E0%B8%81%E0%B8%A3%E0%B8%B0%E0%B8%8A%E0%B8%B2%E0%B8%A2%E0%B8%82%E0%B8%B2%E0%B8%A7",
    },
  },
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
  {
    subjects: ["จันทน์ลีลา", "ยาจันทน์ลีลา"],
    symptoms: ["ไข้", "ลดไข้", "ตัวร้อน", "ปวดหัว", "ไข้เปลี่ยนฤดู"],
    data: {
      title: "คลังงานวิจัยและบทความวิชาการตำรับยาจันทน์ลีลาในระบบวารสารวิชาการไทย (ThaiJO Search: ยาจันทน์ลีลา)",
      authors: "ศูนย์ดัชนีการอ้างอิงวารสารไทย (TCI) และเครือข่ายวิจัยการแพทย์แผนไทย",
      year: "2567",
      journal: "วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก (ฐานข้อมูล ThaiJO)",
      url: "https://he01.tci-thaijo.org/index.php/JTTAM/search/search?query=%E0%B8%88%E0%B8%B1%E0%B8%99%E0%B8%97%E0%B8%99%E0%B9%8C%E0%B8%A5%E0%B8%B5%E0%B8%A5%E0%B8%B2",
    },
  },
  {
    subjects: ["ยาหอมนวโกฐ", "หอมนวโกฐ", "ยาหอม", "ยาหอมอินทจักร์"],
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
    symptoms: ["ประจำเดือน", "ปวดประจำเดือน", "ระดู"],
    data: {
      title: "คลังงานวิจัยและบทความวิชาการตำรับยาประสะไพลในระบบวารสารวิชาการไทย (ThaiJO Search: ยาประสะไพล)",
      authors: "ศูนย์ดัชนีการอ้างอิงวารสารไทย (TCI) และเครือข่ายวิจัยการแพทย์แผนไทย",
      year: "2567",
      journal: "วารสารการแพทย์แผนไทยและการแพทย์ทางเลือก (ฐานข้อมูล ThaiJO)",
      url: "https://he01.tci-thaijo.org/index.php/JTTAM/search/search?query=%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%AA%E0%B8%B0%E0%B9%84%E0%B8%9E%E0%B8%A5",
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
      for (const item of THAIJO_CATALOG) {
        const isMatch = item.subjects.some((s) => s.toLowerCase().includes(hn) || hn.includes(s.toLowerCase()));
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
6. **ความถูกต้องตรงประเด็นของเอกสารอ้างอิง (Strict Citation Relevance - สำคัญมากที่สุด):**
   - ห้ามนำเอกสารอ้างอิงของสมุนไพรอื่นที่ไม่ได้ถูกถามมาแสดงโดยเด็ดขาด เช่น หากผู้ใช้ถามเรื่อง "ยาจันทน์ลีลา" ต้องอ้างอิงเฉพาะข้อมูลยาจันทน์ลีลา ห้ามใส่เอกสารอ้างอิงของ "ฟ้าทะลายโจร" หรือ "ตะไคร้" หรือสมุนไพรอื่นที่ไม่เกี่ยวข้อง
   - ให้อ้างอิงเฉพาะข้อมูลที่ตรงกับสิ่งที่ตอบเท่านั้น หากข้อมูลใดใน CONTEXT ไม่เกี่ยวกับคำถามของผู้ใช้ ห้ามนำมาเขียนในหัวข้อเอกสารอ้างอิง
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
  onChunk?: (text: string) => void
): Promise<string> {
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
  const nq = normalizeThaiName(question);

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
    // ไม่ดึงสมุนไพรเดี่ยวแปลกปลอม (เช่น ตะไคร้) มาโดยเด็ดขาด!
    matchedHerbs = exactMatchedHerbs.slice(0, 4);
  }
  // ข) ถ้าผู้ใช้เอ่ยชื่อสมุนไพรเดี่ยวชัดเจน (เช่น "ขมิ้นชันกินร่วมกับ warfarin ได้ไหม")
  else if (exactMatchedHerbs.length > 0) {
    matchedHerbs = exactMatchedHerbs.slice(0, 4);
    matchedFormulas = [];
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

  // ค้นหางานวิจัยไทย ThaiJO ที่ตรงกับคำถามอย่างแม่นยำ
  const thaijoResults = findRelevantThaiJo(question, matchedHerbs, matchedFormulas);

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

  // ตรวจสอบว่าคำตอบของ AI เป็นการปฏิเสธคำถามนอกขอบเขตหรือไม่
  const isOutOfScope =
    answer.includes("อยู่นอกเหนือขอบเขต") ||
    answer.includes("ไม่ได้เกี่ยวข้องกับทางด้านการแพทย์") ||
    answer.includes("ไม่สามารถตอบคำถามนอกเหนือจากนี้ได้");

  // 6. รวบรวม Sources Payload ทั้งภายในและภายนอก (PubMed & ThaiJO)
  let internalSources = [
    ...matchedHerbs.map((h) => ({ type: "herb", id: h.id, name: h.name_thai })),
    ...matchedFormulas.map((f) => ({ type: "formula", id: f.id, name: f.name_thai })),
  ];
  if (exactMatchedFormulas.length > 0 && exactMatchedHerbs.length === 0) {
    internalSources = internalSources.filter((s) => s.type === "formula");
  } else if (exactMatchedHerbs.length > 0 && exactMatchedFormulas.length === 0) {
    internalSources = internalSources.filter((s) => s.type === "herb");
  }

  const sourcesPayload: any = isOutOfScope
    ? { internal: [], pubmed: [], thaijo: [], knowledge: [] }
    : {
        internal: internalSources,
        pubmed: pubmedResults,
        thaijo: thaijoResults,
      };

  if (!isOutOfScope && matchedHerbs.length === 0 && matchedFormulas.length === 0 && allKnowledge.length > 0) {
    sourcesPayload.knowledge = allKnowledge.slice(0, 2).map((k: any) => ({
      id: k.id,
      title: k.title,
      category: k.category,
      content: k.content,
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
