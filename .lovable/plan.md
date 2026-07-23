## ปัญหา
AI ตอบด้วยแหล่งอ้างอิงที่ "hallucinate" (แต่งขึ้นเอง) — ทั้ง URL, PMID, และชื่องานวิจัย ทำให้กดแล้วเจอลิงก์เสียหรือไปเจอเนื้อหาคนละเรื่อง เพราะ LLM ไม่มีสิทธิ์เข้าถึงข้อมูลจริง

## แนวทางแก้
เปลี่ยนจาก "AI จินตนาการแหล่งอ้างอิง" → "AI ตอบจากแหล่งข้อมูลจริงเท่านั้น" โดยใช้ 2 แหล่ง:

1. **ฐานข้อมูลภายใน** (herbs, thai_formulas) — ค้นหาก่อนทุกครั้ง
2. **PubMed API จริง** — ค้นหางานวิจัยด้วย NCBI E-utilities (ฟรี ไม่ต้องใช้ API key)

## ขั้นตอนการทำงาน (ใหม่)

```text
คำถามผู้ใช้
    ↓
[1] Query herbs + thai_formulas จาก DB ด้วยคีย์เวิร์ด
    ↓
[2] Query PubMed E-utilities (esearch → esummary)
    ดึง PMID, title, authors, year, journal จริง
    ↓
[3] ประกอบ context จากทั้ง 2 แหล่ง ส่งให้ LLM
    ↓
[4] LLM ตอบโดยอ้างอิงเฉพาะข้อมูลที่ได้รับ
    ห้ามสร้างแหล่งอ้างอิงใหม่
    ↓
[5] แสดงแหล่งอ้างอิงพร้อมลิงก์จริง
    - PubMed: https://pubmed.ncbi.nlm.nih.gov/{PMID}
    - ฐานข้อมูลภายใน: อ้างอิงชื่อสมุนไพร/ตำรับในระบบ
```

## รายการงานที่ต้องทำ

### 1. แก้ Edge Function `herbal-chat`
- เพิ่มขั้นตอน pre-fetch ก่อนเรียก LLM:
  - Extract คีย์เวิร์ด (ชื่อสมุนไพร/ยา) จากคำถาม
  - Query `herbs` และ `thai_formulas` ด้วย ilike/full-text search
  - Query PubMed E-utilities API (esearch + esummary) — ไม่ต้องใช้ API key แต่จำกัด 3 req/sec
- ปรับ system prompt:
  - บอก AI ว่ามี context จริง 2 ชุด
  - บังคับให้อ้างอิงเฉพาะจาก context ที่ให้ ห้ามสร้าง citation ใหม่
  - ถ้าไม่มีข้อมูล ให้บอก "ไม่พบข้อมูลในฐานข้อมูล" ตรงๆ
- ส่งกลับ sources เป็น JSON structured ท้าย response

### 2. อัปเดต ChatPage (frontend)
- Parse sources จาก response
- Render แหล่งอ้างอิงเป็นการ์ดคลิกได้:
  - PubMed link → เปิด pubmed.ncbi.nlm.nih.gov/{PMID}
  - Internal DB → ลิงก์ไปหน้า /herbs (สารานุกรม)
- แสดงบอก user ชัดเจนว่าแหล่งไหนมาจาก DB ภายใน แหล่งไหนจาก PubMed

## รายละเอียดเชิงเทคนิค

**PubMed E-utilities endpoints (ฟรี ไม่ต้อง key):**
- `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={query}&retmax=5&retmode=json`
- `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={pmids}&retmode=json`

**Rate limit:** 3 requests/second โดยไม่มี key — พอสำหรับ chat 1 คำถามต่อครั้ง

**Keyword extraction:** ใช้ LLM รอบแรกสั้นๆ หรือใช้ regex ดึงชื่อสมุนไพร/ยาที่ match ในตาราง herbs.name_thai / name_english / name_scientific

## ผลที่คาดหวัง
- ทุกลิงก์ที่แสดงคลิกได้จริง เปิดไปเจอบทความจริง
- ถ้าไม่มีข้อมูลจริง AI จะบอกตรงๆ ว่าไม่พบ ไม่แต่ง
- ผู้ใช้เชื่อถือคำตอบได้มากขึ้น เพราะตรวจสอบได้

## ข้อจำกัดที่ควรทราบ
- PubMed มีเฉพาะภาษาอังกฤษ — ถ้าค้นด้วยชื่อไทยอาจไม่เจอ ต้องแปลงเป็นชื่อวิทยาศาสตร์/อังกฤษก่อน (ใช้ mapping จากตาราง herbs)
- Response จะช้าขึ้นเล็กน้อย (~1-2 วินาที) เพราะต้องเรียก API เพิ่ม
- ครั้งแรกอาจไม่พบข้อมูลใน DB ภายในถ้าถามสมุนไพรที่ยังไม่มีในตาราง — ต้องพึ่ง PubMed เป็นหลัก
