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

const SYSTEM_PROMPT = `คุณคือ "หมอยาพิษณุโลก" ผู้เชี่ยวชาญด้านเภสัชกรรมไทยและอันตรกิริยาระหว่างยากับสมุนไพร (Drug-Herb Interaction) ประจำกลุ่มงานการแพทย์แผนไทยและสมุนไพร สำนักงานสาธารณสุขจังหวัดพิษณุโลก

แนวทางการตอบ:
1. ตอบด้วยภาษาไทยที่สุภาพ เป็นมิตร น่าเชื่อถือ อธิบายเข้าใจง่าย ชัดเจน ตรงประเด็น
2. หากมีการใช้ยาร่วมกัน ให้ระบุระดับความรุนแรง (Major/Moderate/Minor) ให้ชัดเจน
3. ระบุชื่อสมุนไพร/ตำรับยา, สรรพคุณ, ขนาดและวิธีใช้, ข้อห้าม และข้อควรระวัง
4. ให้คำเตือนเสมอว่า "ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้ โดยเฉพาะหญิงตั้งครรภ์ หญิงให้นมบุตร ผู้ป่วยโรคไต/โรคตับ"
5. **การแสดงเอกสารอ้างอิงตามแบบ APA 7th Edition (สำคัญ):**
   ก่อนจบคำตอบ ให้เขียนหัวข้อ "### 📚 เอกสารอ้างอิง (APA 7th Edition)" แล้วระบุรายการอ้างอิงตามรูปแบบมาตรฐาน APA 7 ดังนี้:
   - กรณีอ้างอิงฐานข้อมูลสมุนไพร/ตำรับยาไทย สสจ.พิษณุโลก:
     สำนักงานสาธารณสุขจังหวัดพิษณุโลก. (2568). *ฐานข้อมูลสมุนไพรและตำรับยาไทย: [ชื่อสมุนไพร/ตำรับ]*. กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก กระทรวงสาธารณสุข.
   - กรณีอ้างอิงบัญชียาหลักแห่งชาติด้านสมุนไพร:
     คณะกรรมการพัฒนาระบบยาแห่งชาติ. (2568). *ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (ฉบับที่ 2) พ.ศ. 2568*. ราชกิจจานุเบกษา.
   - กรณีอ้างอิง 10 กลุ่มอาการ สธ.:
     กรมการแพทย์แผนไทยและการแพทย์ทางเลือก. (2567). *คู่มือการใช้ยาสมุนไพรในการดูแลสุขภาพเบื้องต้น 10 กลุ่มอาการ*. กระทรวงสาธารณสุข.
   - กรณีอ้างอิงงานวิจัย/วารสาร: ให้ระบุตามรูปแบบ APA 7 เช่น Author, A. A. (Year). Title. *Journal*, Volume(Issue), Pages. DOI/URL
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

  // 1. ดึงสมุนไพรและตำรับยาจากฐานข้อมูล Supabase (ใช้ anon key อ่านได้โดยตรง)
  const [{ data: herbsData }, { data: formulasData }, { data: knowledgeData }] = await Promise.all([
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
      .select("id, title, category, content")
      .limit(10),
  ]);

  const allHerbs = herbsData || [];
  const allFormulas = formulasData || [];
  const allKnowledge = knowledgeData || [];

  // 2. ค้นหาสมุนไพรและตำรับที่เกี่ยวข้องกับคำถาม
  const q = question.toLowerCase();
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

  // ตรวจจับอาการ
  const matchedSymptoms: string[] = [];
  for (const s of SYMPTOM_MAP) {
    if (s.match.test(q)) {
      matchedSymptoms.push(...s.terms);
    }
  }

  // 3. สร้าง Context สำหรับ AI
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

  // 5. เรียกใช้ AI โดยรองรับ Auto-Failover และ Resilience ต่อปัญหา 503 High Demand
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
            temperature: 0.3,
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

        const result = await resp.json();
        answer = result?.choices?.[0]?.message?.content || "";
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

  // เพิ่ม Sources Payload ในคำตอบ
  const sourcesPayload: any = {
    internal: [
      ...matchedHerbs.map((h) => ({ type: "herb", id: h.id, name: h.name_thai })),
      ...matchedFormulas.map((f) => ({ type: "formula", id: f.id, name: f.name_thai })),
    ],
  };

  if (matchedHerbs.length === 0 && matchedFormulas.length === 0 && allKnowledge.length > 0) {
    sourcesPayload.knowledge = allKnowledge.slice(0, 2).map((k: any) => ({
      id: k.id,
      title: k.title,
      category: k.category,
      source: "คู่มือ 10 กลุ่มอาการ กรมการแพทย์แผนไทยและการแพทย์ทางเลือก",
      source_url: k.source_url || undefined,
    }));
  }

  const finalResponse = `${answer}\n\n[SOURCES]${JSON.stringify(sourcesPayload)}[/SOURCES]`;

  if (onChunk) {
    onChunk(finalResponse);
  }

  return finalResponse;
}
