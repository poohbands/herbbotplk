## เป้าหมาย
ให้แอดมินเพิ่ม/แก้ไข/ลบ "ความรู้" (เช่น แนวทาง สธ., 10 กลุ่มอาการ, บทความ, FAQ, ตำรับใหม่) ได้เองผ่านหน้าเว็บ โดยที่ AI chatbot ดึงมาใช้เป็น context อัตโนมัติ ไม่ต้องแก้โค้ด edge function ทุกครั้ง

## สถาปัตยกรรมที่แนะนำ (2 ชั้น)

### ชั้นที่ 1 — Structured tables (มีอยู่แล้ว)
`herbs`, `thai_formulas` — สำหรับข้อมูลที่มี schema ชัด (สรรพคุณ, ขนาดยา, interactions)
- แอดมินเพิ่ม/แก้ผ่านฟอร์มในหน้า Admin

### ชั้นที่ 2 — Knowledge Base แบบยืดหยุ่น (สร้างใหม่)
ตาราง `knowledge_documents` สำหรับความรู้ที่ไม่ตายตัว (นโยบาย, แนวทาง, FAQ, บทความ)

```
knowledge_documents
- id, title, category (policy|guideline|faq|article|formula_note)
- content (markdown ยาว)
- tags text[] (keyword ค้นหา)
- source (แหล่งอ้างอิง เช่น "กรมการแพทย์แผนไทยฯ")
- source_url (ถ้ามี)
- is_published boolean
- created_at, updated_at
- embedding vector(3072)   ← สำหรับ semantic search
```

## แผนดำเนินการ

### 1. Database
- เปิด extension `pgvector`
- สร้างตาราง `knowledge_documents` + HNSW index สำหรับ embedding
- สร้าง SQL function `match_knowledge(query_embedding, match_count, min_similarity)`
- RLS: อ่านได้ทุกคน (published เท่านั้น), เขียนได้เฉพาะ service_role
- Seed ข้อมูล "10 กลุ่มอาการ common disease" เป็น document แรก (ย้ายออกจากโค้ด edge function)

### 2. Edge Function ใหม่: `embed-knowledge`
- รับ document id → เรียก Lovable AI embeddings (`google/gemini-embedding-2`) → บันทึก vector
- Trigger อัตโนมัติเมื่อสร้าง/แก้ไข document (ผ่าน DB trigger เรียก pg_net หรือเรียกจากฝั่ง client หลัง insert)

### 3. ปรับปรุง `herbal-chat`
- Embed คำถามผู้ใช้ → เรียก `match_knowledge` → ดึง top 3-5 documents ที่ relevant
- แทรกเข้า `<CONTEXT>` เช่นเดียวกับ herbs/formulas
- แสดงใน `[SOURCES]` เป็นประเภท "knowledge" พร้อม title + source

### 4. หน้า Admin ใหม่: Knowledge Manager
เพิ่ม tab ใน `AdminPage` หรือหน้าใหม่ `/admin/knowledge`:
- ตารางรายการ documents พร้อม filter (category, published)
- ปุ่ม "+ เพิ่มความรู้ใหม่" → dialog ฟอร์ม (title, category, content markdown, tags, source)
- ปุ่มแก้ไข/ลบ/toggle publish
- แสดงสถานะ embedding (pending / ready)
- Preview markdown

### 5. (Optional) นำเข้าไฟล์
- อัปโหลดไฟล์ .md / .txt / .pdf → parse → ตัด chunk → สร้างเป็นหลาย documents อัตโนมัติ
  (เฟสถัดไป ถ้าต้องการ)

## ประโยชน์
- แอดมินเพิ่มข้อมูลได้เองโดยไม่ต้องแก้โค้ด
- ระบบตอบได้ครอบคลุมมากขึ้นเรื่อยๆ ตามข้อมูลที่ใส่
- Semantic search ทำให้ AI หา context ที่ตรงกับคำถามได้แม่นแม้ผู้ใช้ถามคนละคำ
- Source citation ตรวจสอบย้อนหลังได้

## ไฟล์ที่จะสร้าง/แก้
- Migration: `knowledge_documents` table + `match_knowledge` function + pgvector
- Seed data: 10 กลุ่มอาการ (ย้ายจาก edge function)
- `supabase/functions/embed-knowledge/index.ts` (ใหม่)
- `supabase/functions/herbal-chat/index.ts` (เพิ่ม semantic retrieval)
- `src/pages/AdminKnowledgePage.tsx` หรือ tab ใน `AdminPage.tsx` (ใหม่)
- `src/components/KnowledgeEditor.tsx` (ใหม่ — ฟอร์มเพิ่ม/แก้)
- Route ใน `App.tsx`

## คำถามก่อนเริ่ม
1. ต้องการทำครบทุกส่วนในรอบเดียว หรือเริ่มจาก MVP (ตาราง + หน้า Admin CRUD + ให้ chatbot อ่าน โดยยังไม่ใช้ embedding — ใช้ keyword/tag match ก่อน) แล้วค่อยเพิ่ม semantic search ทีหลัง?
2. ต้องการฟีเจอร์อัปโหลดไฟล์ (PDF/Word) ในเฟสแรกไหม หรือแค่พิมพ์/วาง markdown ก็พอ?
