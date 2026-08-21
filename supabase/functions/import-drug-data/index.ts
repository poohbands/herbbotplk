import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-3-flash-preview";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ---------- AI extraction schema ----------

const strArr = { type: "array", items: { type: "string" } };

const extractionSchema = {
  type: "object",
  properties: {
    herbs: {
      type: "array",
      description: "สมุนไพรเดี่ยว",
      items: {
        type: "object",
        properties: {
          name_thai: { type: "string" },
          name_english: { type: "string" },
          name_scientific: { type: "string" },
          local_names: strArr,
          family: { type: "string" },
          category: { type: "string" },
          description: { type: "string" },
          properties: strArr,
          usage_instructions: { type: "string" },
          dosage: { type: "string" },
          precautions: strArr,
          contraindications: strArr,
          drug_interactions: strArr,
          is_in_nlem: { type: "boolean" },
        },
        required: ["name_thai"],
      },
    },
    formulas: {
      type: "array",
      description: "ตำรับยาแผนไทย",
      items: {
        type: "object",
        properties: {
          name_thai: { type: "string" },
          name_english: { type: "string" },
          formula_code: { type: "string" },
          category: { type: "string" },
          indication: { type: "string" },
          ingredients: strArr,
          preparation: { type: "string" },
          dosage: { type: "string" },
          usage_instructions: { type: "string" },
          precautions: strArr,
          contraindications: strArr,
          drug_interactions: strArr,
          properties: strArr,
          is_in_nlem: { type: "boolean" },
        },
        required: ["name_thai"],
      },
    },
    knowledge: {
      type: "array",
      description: "เนื้อหาความรู้/บทความ/แนวทางที่ไม่ใช่ข้อมูลยารายตัว",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          category: { type: "string" },
          content: { type: "string" },
          tags: strArr,
          source: { type: "string" },
          source_url: { type: "string" },
        },
        required: ["title", "content"],
      },
    },
  },
  required: ["herbs", "formulas", "knowledge"],
} as const;

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยจัดระเบียบข้อมูลยาสมุนไพรไทยของกลุ่มงานการแพทย์แผนไทยและสมุนไพร สำนักงานสาธารณสุขจังหวัดพิษณุโลก
หน้าที่: อ่านเอกสารที่ได้รับ แล้วแยกข้อมูลออกเป็นโครงสร้าง JSON ตาม tool ที่กำหนด
กติกา:
- ห้ามแต่งข้อมูลที่ไม่มีในเอกสาร ถ้าไม่มีข้อมูลในช่องใดให้เว้นว่างหรือไม่ต้องใส่
- สมุนไพรตัวเดียว (เช่น ฟ้าทะลายโจร ขมิ้นชัน) ให้ลงใน herbs
- ตำรับยาที่มีหลายตัวยา (เช่น ยาจันทน์ลีลา ยาหอมเทพจิตร) ให้ลงใน formulas
- เนื้อหาที่เป็นบทความ แนวทาง หรือความรู้ทั่วไป ให้ลงใน knowledge (คงเนื้อหาสำคัญให้ครบ)
- ใช้ภาษาไทยตามต้นฉบับ`;

async function callAI(content: unknown[], signal?: AbortSignal) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    signal,
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_extracted_data",
            description: "บันทึกข้อมูลยา/สมุนไพร/ความรู้ที่แยกได้จากเอกสาร",
            parameters: extractionSchema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_extracted_data" } },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("ระบบ AI มีคำขอมากเกินไป กรุณาลองใหม่ในอีกสักครู่");
    if (res.status === 402) throw new Error("เครดิต AI ของ workspace หมด กรุณาเติมเครดิตก่อนใช้งาน");
    throw new Error(`AI_${res.status}: ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("AI ไม่ได้ส่งข้อมูลที่แยกได้กลับมา");
  try {
    return JSON.parse(call.function.arguments);
  } catch {
    throw new Error("ไม่สามารถอ่านผลลัพธ์จาก AI ได้");
  }
}

function b64(bytes: Uint8Array) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function chunkText(text: string, size = 24000): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out.slice(0, 6);
}

function mergeResults(list: any[]) {
  const merged = { herbs: [] as any[], formulas: [] as any[], knowledge: [] as any[] };
  for (const r of list) {
    merged.herbs.push(...(r?.herbs || []));
    merged.formulas.push(...(r?.formulas || []));
    merged.knowledge.push(...(r?.knowledge || []));
  }
  return merged;
}

async function extractFromText(text: string) {
  const parts = chunkText(text);
  const results = [];
  for (const p of parts) {
    results.push(await callAI([{ type: "text", text: `เอกสาร:\n\n${p}` }]));
  }
  return mergeResults(results);
}

async function readDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("npm:mammoth@1.8.0");
  const res = await mammoth.extractRawText({ buffer: bytes });
  return res.value || "";
}

async function readSheet(bytes: Uint8Array): Promise<string> {
  const XLSX = await import("npm:xlsx@0.18.5");
  const wb = XLSX.read(bytes, { type: "array" });
  return wb.SheetNames.map(
    (n: string) => `# ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`,
  ).join("\n\n");
}

async function extractFromFile(filePath: string, fileName: string) {
  const { data, error } = await admin.storage.from("imports").download(filePath);
  if (error || !data) throw new Error(`ดาวน์โหลดไฟล์ไม่สำเร็จ: ${error?.message || "ไม่พบไฟล์"}`);
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.length === 0) throw new Error("ไฟล์ว่างเปล่า");
  const lower = fileName.toLowerCase();
  const mime = data.type || "application/octet-stream";

  if (lower.endsWith(".pdf")) {
    return await callAI([
      { type: "text", text: "อ่านเอกสาร PDF นี้แล้วแยกข้อมูลยา/สมุนไพร" },
      {
        type: "file",
        file: { filename: fileName, file_data: `data:application/pdf;base64,${b64(bytes)}` },
      },
    ]);
  }
  if (/\.(png|jpg|jpeg|webp)$/.test(lower)) {
    const imgMime = mime.startsWith("image/") ? mime : "image/png";
    return await callAI([
      { type: "text", text: "อ่านข้อความจากภาพเอกสารนี้แล้วแยกข้อมูลยา/สมุนไพร" },
      { type: "image_url", image_url: { url: `data:${imgMime};base64,${b64(bytes)}` } },
    ]);
  }
  if (lower.endsWith(".docx")) return await extractFromText(await readDocx(bytes));
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return await extractFromText(await readSheet(bytes));
  }
  // txt / md / csv / อื่น ๆ
  return await extractFromText(new TextDecoder().decode(bytes));
}

// ---------- Commit ----------

const clean = (v: unknown) =>
  typeof v === "string" ? (v.trim() || null) : Array.isArray(v) ? v : v ?? null;

async function upsertRow(table: string, row: Record<string, unknown>, matchCol: string) {
  const name = String(row[matchCol] || "").trim();
  if (!name) return "skipped";
  const { data: existing } = await admin
    .from(table)
    .select("id")
    .eq(matchCol, name)
    .maybeSingle();
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    payload[k] = clean(v);
  }
  if (existing) {
    const { error } = await admin.from(table).update(payload).eq("id", existing.id);
    if (error) throw new Error(`${table}: ${error.message}`);
    return "updated";
  }
  const { error } = await admin.from(table).insert(payload);
  if (error) throw new Error(`${table}: ${error.message}`);
  return "inserted";
}

async function snapshot(label: string, note?: string) {
  const [h, f, k] = await Promise.all([
    admin.from("herbs").select("*"),
    admin.from("thai_formulas").select("*"),
    admin.from("knowledge_documents").select("*"),
  ]);
  const herbs = h.data || [];
  const formulas = f.data || [];
  const knowledge = k.data || [];
  const { data, error } = await admin
    .from("data_versions")
    .insert({
      label,
      note: note || null,
      herbs,
      thai_formulas: formulas,
      knowledge_documents: knowledge,
      herbs_count: herbs.length,
      formulas_count: formulas.length,
      knowledge_count: knowledge.length,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function restore(versionId: string) {
  const { data: v, error } = await admin
    .from("data_versions")
    .select("*")
    .eq("id", versionId)
    .single();
  if (error || !v) throw new Error("ไม่พบเวอร์ชันที่ต้องการย้อนกลับ");

  await snapshot(`สำรองอัตโนมัติก่อนย้อนกลับ`, `ก่อนย้อนไปเวอร์ชัน: ${v.label}`);

  const restoreTable = async (table: string, rows: any[]) => {
    const { error: delErr } = await admin
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) throw new Error(`${table}: ${delErr.message}`);
    if (rows.length) {
      const clean = rows.map(({ search_vector: _sv, ...rest }) => rest);
      for (let i = 0; i < clean.length; i += 100) {
        const { error: insErr } = await admin.from(table).insert(clean.slice(i, i + 100));
        if (insErr) throw new Error(`${table}: ${insErr.message}`);
      }
    }
  };

  await restoreTable("herbs", v.herbs || []);
  await restoreTable("thai_formulas", v.thai_formulas || []);
  await restoreTable("knowledge_documents", v.knowledge_documents || []);
  return {
    herbs: (v.herbs || []).length,
    formulas: (v.thai_formulas || []).length,
    knowledge: (v.knowledge_documents || []).length,
  };
}

// ---------- Handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = body?.action;

    if (action === "extract") {
      const { file_path, file_name, text, job_id } = body;
      let jobId = job_id as string | undefined;
      if (!jobId) {
        const { data, error } = await admin
          .from("import_jobs")
          .insert({
            file_name: file_name || "ข้อความที่วาง",
            file_path: file_path || null,
            source_type: file_path ? "file" : "text",
            status: "processing",
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        jobId = data.id;
      }

      try {
        const result = file_path
          ? await extractFromFile(file_path, file_name || file_path)
          : await extractFromText(String(text || ""));
        await admin
          .from("import_jobs")
          .update({ status: "extracted", extracted: result, error: null })
          .eq("id", jobId);
        return json({ job_id: jobId, extracted: result });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await admin.from("import_jobs").update({ status: "failed", error: msg }).eq("id", jobId);
        return json({ error: msg, job_id: jobId }, 400);
      }
    }

    if (action === "commit") {
      const { job_id, herbs = [], formulas = [], knowledge = [], create_version = true } = body;
      if (create_version) {
        await snapshot(
          `ก่อนนำเข้า ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`,
          "สำรองอัตโนมัติก่อนบันทึกข้อมูลนำเข้า",
        );
      }
      const summary = { inserted: 0, updated: 0, skipped: 0 };
      for (const h of herbs) {
        const r = await upsertRow("herbs", h, "name_thai");
        (summary as any)[r]++;
      }
      for (const f of formulas) {
        const r = await upsertRow("thai_formulas", f, "name_thai");
        (summary as any)[r]++;
      }
      for (const k of knowledge) {
        const r = await upsertRow("knowledge_documents", k, "title");
        (summary as any)[r]++;
      }
      if (job_id) {
        await admin
          .from("import_jobs")
          .update({
            status: "committed",
            committed_count: summary.inserted + summary.updated,
          })
          .eq("id", job_id);
      }
      return json({ summary });
    }

    if (action === "snapshot") {
      const id = await snapshot(
        body.label || `เวอร์ชัน ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`,
        body.note,
      );
      return json({ version_id: id });
    }

    if (action === "restore") {
      if (!body.version_id) return json({ error: "ต้องระบุเวอร์ชัน" }, 400);
      const counts = await restore(body.version_id);
      return json({ restored: counts });
    }

    return json({ error: "ไม่รู้จักคำสั่งนี้" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("import-drug-data error:", msg);
    return json({ error: msg }, 500);
  }
});
