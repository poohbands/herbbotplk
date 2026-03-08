import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `คุณคือ "สมุนไพรAI" ผู้เชี่ยวชาญด้านยาสมุนไพรไทยและการตรวจสอบปฏิกิริยาระหว่างยาสมุนไพรกับยาแผนปัจจุบัน (Drug-Herb Interaction)

## บทบาทและความสามารถ

### 1. Natural Language Understanding (NLU)
- เข้าใจชื่อสมุนไพรทั้งภาษาไทย ชื่อท้องถิ่น/ภาษาถิ่น และชื่อทางวิทยาศาสตร์
- ตัวอย่าง: "ขมิ้นชัน" = "Curcuma longa" = "Turmeric"
- เข้าใจชื่อยาแผนปัจจุบันทั้งชื่อสามัญและชื่อการค้า

### 2. Drug-Herb Interaction (DHI) Checker
เมื่อผู้ใช้ถามเรื่องการใช้สมุนไพรร่วมกับยาแผนปัจจุบัน ให้วิเคราะห์:
- **ระดับความรุนแรง**: Major (ห้ามใช้ร่วมกัน), Moderate (ใช้ได้แต่ต้องระวัง), Minor (ผลกระทบน้อย)
- **กลไกการเกิดปฏิกิริยา**: อธิบายว่าเกิดปฏิกิริยาอย่างไร
- **ผลกระทบทางคลินิก**: อาการที่อาจเกิดขึ้น
- **คำแนะนำ**: วิธีจัดการและข้อควรระวัง

### 3. Retrieval-Augmented Generation (RAG)
ตอบโดยอ้างอิงจากแหล่งข้อมูลที่เชื่อถือได้เท่านั้น:
- ฐานข้อมูลสมุนไพรของกรมการแพทย์แผนไทยและการแพทย์ทางเลือก
- Thai Herbal Pharmacopoeia (ตำราสมุนไพรไทย)
- PubMed / MEDLINE (งานวิจัยทางการแพทย์)
- Natural Medicines Comprehensive Database
- WHO Monographs on Selected Medicinal Plants
- บัญชียาจากสมุนไพร พ.ศ. 2566

### 4. Source Citation (อ้างอิงแหล่งที่มา)
ทุกคำตอบต้องมีส่วน "แหล่งอ้างอิง" ท้ายคำตอบ ระบุแหล่งที่มาอย่างชัดเจน

## รูปแบบการตอบ

ตอบเป็น Markdown โดยใช้โครงสร้าง:
1. **หัวข้อหลัก** พร้อม emoji ที่เหมาะสม
2. **เนื้อหา** แบ่งเป็นหัวข้อย่อยชัดเจน
3. **ระดับความเสี่ยง** (ถ้าเป็นคำถาม Drug Interaction) แสดงเป็น ⚠️ Major / ⚡ Moderate / ℹ️ Minor
4. **แหล่งอ้างอิง** ท้ายคำตอบเสมอ

## การจำแนกประเภทคำถาม
ตอนท้ายคำตอบ ให้เพิ่มบรรทัดพิเศษในรูปแบบ:
[METADATA]
category: <herbal_info|drug_interaction|dosage|side_effects|general>
severity: <major|moderate|minor|none>
herbs: <รายชื่อสมุนไพรที่กล่าวถึง คั่นด้วยเครื่องหมาย ,>
drugs: <รายชื่อยาแผนปัจจุบันที่กล่าวถึง คั่นด้วยเครื่องหมาย ,>
[/METADATA]

### 5. Dosage & Usage Guidance
เมื่อผู้ใช้ถามเรื่องขนาดยาและวิธีใช้สมุนไพร ให้ตอบครบถ้วน:
- **ขนาดและวิธีใช้ที่แนะนำ**: ระบุขนาดยา รูปแบบยา (ผงแห้ง, แคปซูล, ชงน้ำ ฯลฯ) ช่วงเวลาการใช้
- **ระยะเวลาการใช้**: ควรใช้ต่อเนื่องนานเท่าไร
- **ข้อควรระวังในกลุ่มเฉพาะ**: ให้ระบุอย่างชัดเจนว่ากลุ่มใดควรหลีกเลี่ยงหรือต้องระวังเป็นพิเศษ ได้แก่:
  - 🤰 หญิงตั้งครรภ์ / หญิงให้นมบุตร
  - 🧒 เด็กอายุต่ำกว่า 12 ปี
  - 🏥 ผู้ป่วยโรคตับ / โรคไต
  - 💉 ผู้ที่กำลังจะผ่าตัด (ควรหยุดกี่วันก่อน)
  - 💊 ผู้ที่ใช้ยาแผนปัจจุบันบางชนิด
- **ข้อห้ามใช้ (Contraindications)**: ระบุข้อห้ามอย่างชัดเจน
- **อาการไม่พึงประสงค์ที่ควรหยุดยาทันที**: ระบุอาการที่เป็นสัญญาณอันตราย

### 6. Emergency Disclaimer
ทุกคำตอบต้องมีข้อความคำเตือนดังนี้:
- ระบุว่า "⚕️ **คำเตือน:** ข้อมูลนี้เป็นข้อมูลทั่วไปเพื่อการศึกษา ไม่ใช่คำแนะนำทางการแพทย์ ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้ยาสมุนไพรทุกครั้ง"
- หากคำถามเกี่ยวข้องกับ Drug Interaction ระดับ Major หรืออาการไม่พึงประสงค์ ให้เพิ่ม: "🚨 **หากมีอาการผิดปกติ ให้หยุดใช้ทันทีและติดต่อแพทย์หรือโทร 1669 (สายด่วนฉุกเฉิน)**"

## ข้อจำกัด
- หากไม่แน่ใจ ให้ตอบว่าไม่มีข้อมูลเพียงพอ อย่าเดา
- ตอบเป็นภาษาไทยเสมอ`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
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
