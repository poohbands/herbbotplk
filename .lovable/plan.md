# อัปเดตโมเดล Gemini เป็นรุ่นล่าสุด

## สิ่งที่จะทำ
เปลี่ยนโมเดลใน `supabase/functions/herbal-chat/index.ts` ทั้ง 5 จุด:

| งาน | เดิม | ใหม่ |
|---|---|---|
| จำแนกเจตนา (Intent) | `google/gemini-2.5-flash-lite` | `google/gemini-3.1-flash-lite` |
| ตอบคำถามหลัก (streaming) | `google/gemini-2.5-flash` | `google/gemini-3.7-flash` |
| AI Fallback | `google/gemini-2.5-flash` | `google/gemini-3.7-flash` |
| ตรวจสอบคำตอบ (Verification) | `google/gemini-2.5-flash` | `google/gemini-3.7-flash` |
| แก้คำตอบที่ปฏิเสธผิดพลาด | `google/gemini-2.5-flash` | `google/gemini-3.7-flash` |

พร้อมรวมค่าโมเดลไว้เป็นค่าคงที่ (`MODEL_FAST`, `MODEL_MAIN`) ที่ด้านบนไฟล์ เพื่อให้สลับรุ่นในอนาคตทำได้ในบรรทัดเดียว

## การทดสอบ
- Deploy edge function แล้วยิงคำถามจริง 2 แบบ (คำถามสมุนไพร + คำถาม drug interaction) ตรวจว่าไม่มี error 400 และคำตอบยังอ้างอิงแหล่งข้อมูลถูกต้อง
- ตรวจ log ของ edge function หลังทดสอบ

## เรื่องการย้อนกลับเวอร์ชัน
ย้อนกลับได้ครับ 2 ทาง:
1. ประวัติเวอร์ชันของ Lovable — กด Revert กลับไปยัง version ก่อนหน้าได้ทันที (รวมถึงโค้ด edge function)
2. เนื่องจากรวมค่าโมเดลเป็นค่าคงที่ 2 ตัว ถ้าโมเดลใหม่ให้ผลแย่กว่า แค่แก้ 2 บรรทัดกลับเป็น `gemini-2.5-*` แล้ว deploy ใหม่

การเปลี่ยนครั้งนี้ไม่แตะฐานข้อมูลหรือ schema จึงไม่มีความเสี่ยงด้านข้อมูล
