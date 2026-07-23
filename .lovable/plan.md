## ปัญหา (ยืนยันแล้ว)
คำถาม "ใบแปะก๊วยกินร่วมกับยาละลายลิ่มเลือดได้ไหม" ตอบไม่ได้ เพราะ:

1. ตาราง `herbs` ในฐานข้อมูล **ไม่มีข้อมูลแปะก๊วย** (query ยืนยันแล้ว: 0 rows สำหรับ `แปะ%` และ `ginkgo`)
2. ฟังก์ชัน `findRelevantHerbs` จับคู่คำในคำถามกับชื่อในตารางเท่านั้น → ไม่เจอ
3. `buildPubMedQuery` ใช้ `name_scientific`/`name_english` จาก herb ที่ match เท่านั้น → เมื่อไม่ match จึงคืน query ว่าง (คำภาษาไทยไม่ถูก fallback ASCII จับ) → PubMed ก็ไม่ค้น
4. CONTEXT ว่างทั้งหมด → System prompt สั่งให้ตอบว่า "ยังไม่มีข้อมูลจากฐานข้อมูล..." อย่างเคร่งครัด

สรุป: ระบบไม่ได้ "ห้ามตอบ" แต่ **RAG หาข้อมูลไม่เจอ** เพราะฐานข้อมูลสมุนไพรมีจำกัด และตัวแปลง keyword ไทย→อังกฤษไม่มี

## แผนการแก้

### 1. เพิ่ม Thai→Scientific Dictionary ใน edge function
ใน `supabase/functions/herbal-chat/index.ts` เพิ่ม static map สมุนไพรยอดนิยมที่มักถูกถามแต่อาจยังไม่มีใน DB เช่น:
```
แปะก๊วย → Ginkgo biloba
กระเทียม → Allium sativum
ขิง → Zingiber officinale
โสม → Panax ginseng
St. John's wort / เซนต์จอห์นเวิร์ต → Hypericum perforatum
...
```
ปรับ `findRelevantHerbs` / `buildPubMedQuery`:
- ตรวจ dictionary ก่อน — ถ้าคำถามมีชื่อไทยตรงกัน ให้เพิ่ม scientific term เข้า PubMed query แม้จะไม่มีใน DB
- ยัง detect intent "ร่วมกับ / ละลายลิ่มเลือด / warfarin / anticoagulant" เพื่อเติม `AND (drug interaction OR anticoagulant OR warfarin)`

### 2. เพิ่ม fallback keyword ยาแผนปัจจุบัน (ไทย→อังกฤษ)
เช่น "ยาละลายลิ่มเลือด → warfarin OR anticoagulant", "แอสไพริน → aspirin", "ยาคุม → oral contraceptive" — ใช้ประกอบใน PubMed query

### 3. ผ่อนคลาย System Prompt เมื่อไม่มีข้อมูลใน internal DB
แก้กติกาข้อ 3 ให้:
- ถ้า **ไม่มีใน internal DB แต่มีผลจาก PubMed** → ตอบได้ โดยอ้างอิงเฉพาะ PubMed
- ถ้า **ไม่มีทั้งสอง** → ค่อยตอบว่าไม่มีข้อมูล + แนะนำปรึกษาแพทย์
คงหลัก "ห้ามแต่ง PMID/URL"

### 4. เพิ่มข้อมูลสมุนไพรยอดนิยมลง DB (migration + insert)
เพิ่ม 6–10 รายการที่มักถูกถามเรื่อง interaction: แปะก๊วย, กระเทียม, ขิง, โสม, ขมิ้นชัน (ถ้ายังไม่มี), เซนต์จอห์นเวิร์ต, ชาเขียว, ตังกุย — เน้น field `drug_interactions` ให้ครบ เพื่อให้ RAG ตอบได้แม่นแม้ PubMed ล่ม

### 5. เพิ่ม logging
Log จำนวน herbs matched, formulas matched, PubMed query, PubMed results count ใน edge function เพื่อดีบั๊กในอนาคต

## ไฟล์ที่จะแก้
- `supabase/functions/herbal-chat/index.ts` — dictionary, ปรับ RAG, ผ่อน prompt, logging
- migration ใหม่ + insert — เพิ่มสมุนไพรลงตาราง `herbs`

## หลังทำเสร็จ
ทดสอบคำถามเดิม "ใบแปะก๊วยกินร่วมกับยาละลายลิ่มเลือดได้ไหม" ผ่าน preview + ตรวจ edge function logs ว่า PubMed คืนผล และคำตอบมี citation จริง
