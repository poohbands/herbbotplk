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

const nameListSchema = {
  type: "object",
  properties: {
    herb_names: { type: "array", items: { type: "string" }, description: "ชื่อสมุนไพรเดี่ยวทุกตัวที่ปรากฏในเอกสาร" },
    formula_names: { type: "array", items: { type: "string" }, description: "ชื่อตำรับยาแผนไทยทุกตำรับที่ปรากฏในเอกสาร" },
  },
  required: ["herb_names", "formula_names"],
} as const;

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยจัดระเบียบข้อมูลยาสมุนไพรไทยของกลุ่มงานการแพทย์แผนไทยและสมุนไพร สำนักงานสาธารณสุขจังหวัดพิษณุโลก
หน้าที่: อ่านเอกสารที่ได้รับ แล้วแยกข้อมูลออกเป็นโครงสร้าง JSON ตาม tool ที่กำหนด
กติกา:
- ห้ามแต่งข้อมูลที่ไม่มีในเอกสาร ถ้าไม่มีข้อมูลในช่องใดให้เว้นว่างหรือไม่ต้องใส่
- ห้ามสรุปย่อ ห้ามข้ามรายการ ต้องดึงยา/สมุนไพร "ทุกรายการ" ที่ปรากฏในเอกสาร แม้จะมีจำนวนมาก
- สมุนไพรตัวเดียว (เช่น ฟ้าทะลายโจร ขมิ้นชัน) ให้ลงใน herbs
- ตำรับยาที่มีหลายตัวยา (เช่น ยาจันทน์ลีลา ยาหอมเทพจิตร) ให้ลงใน formulas
- เนื้อหาที่เป็นบทความ แนวทาง หรือความรู้ทั่วไป ให้ลงใน knowledge (คงเนื้อหาสำคัญให้ครบ)
- ใช้ภาษาไทยตามต้นฉบับ`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ToolKind = "extract" | "list";

async function callAI(content: unknown[], kind: ToolKind = "extract"): Promise<any> {
  const tool =
    kind === "list"
      ? {
          name: "list_drug_names",
          description: "ทำรายชื่อยา/สมุนไพรทั้งหมดที่พบในเอกสาร (เฉพาะชื่อ ไม่ต้องมีรายละเอียด)",
          parameters: nameListSchema,
        }
      : {
          name: "save_extracted_data",
          description: "บันทึกข้อมูลยา/สมุนไพร/ความรู้ที่แยกได้จากเอกสาร",
          parameters: extractionSchema,
        };

  let lastErr = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 32000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
        tools: [{ type: "function", function: tool }],
        tool_choice: { type: "function", function: { name: tool.name } },
      }),
    });

    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get("retry-after") || 0);
      lastErr = res.status === 429 ? "ระบบ AI มีคำขอมากเกินไป" : `AI_${res.status}`;
      await res.text().catch(() => "");
      if (attempt === 3) break;
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 1500 * 2 ** attempt + Math.random() * 500);
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
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
  throw new Error(`${lastErr} — กรุณาลองใหม่อีกครั้ง`);
}

function b64(bytes: Uint8Array) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

const MAX_CHUNKS = 40;

/** แบ่งข้อความตามขอบเขตบรรทัด พร้อมซ้อนทับท้ายชิ้นก่อนหน้า */
function chunkText(text: string, size = 12000, overlap = 800): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length && out.length < MAX_CHUNKS) {
    let end = Math.min(i + size, clean.length);
    if (end < clean.length) {
      const nl = clean.lastIndexOf("\n", end);
      if (nl > i + size * 0.5) end = nl;
    }
    out.push(clean.slice(i, end));
    if (end >= clean.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return out;
}

const norm = (s: unknown) =>
  String(s ?? "")
    .replace(/\s+/g, "")
    .replace(/^ยา/, "")
    .trim()
    .toLowerCase();

function mergeRow(a: any, b: any) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    const cur = out[k];
    if (Array.isArray(v)) {
      const merged = [...(Array.isArray(cur) ? cur : []), ...v];
      out[k] = Array.from(new Set(merged.filter((x) => String(x || "").trim())));
    } else if (v !== undefined && v !== null && String(v).trim() !== "") {
      if (cur === undefined || cur === null || String(cur).trim() === "" || String(v).length > String(cur).length) {
        out[k] = v;
      }
    }
  }
  return out;
}

function dedupe(rows: any[], key: string) {
  const map = new Map<string, any>();
  for (const r of rows) {
    const k = norm(r?.[key]);
    if (!k) continue;
    map.set(k, map.has(k) ? mergeRow(map.get(k), r) : r);
  }
  return [...map.values()];
}

function mergeResults(list: any[]) {
  const all = { herbs: [] as any[], formulas: [] as any[], knowledge: [] as any[] };
  for (const r of list) {
    all.herbs.push(...(r?.herbs || []));
    all.formulas.push(...(r?.formulas || []));
    all.knowledge.push(...(r?.knowledge || []));
  }
  return {
    herbs: dedupe(all.herbs, "name_thai"),
    formulas: dedupe(all.formulas, "name_thai"),
    knowledge: dedupe(all.knowledge, "title"),
  };
}

/** รันงานแบบขนานจำกัดจำนวน */
async function runPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>) {
  const results: R[] = [];
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const my = idx++;
      results[my] = await fn(items[my], my);
    }
  });
  await Promise.all(workers);
  return results;
}

const GROUP_SIZE = 8;

type Stats = {
  chunks: number;
  names_found: number;
  names_extracted: number;
  missing: string[];
  truncated?: boolean;
};

/**
 * อ่านเอกสารหนึ่งชุด (ข้อความหนึ่งชิ้น หรือ PDF/รูปภาพ):
 * 1) ให้ AI ทำรายชื่อยาทั้งหมดก่อน 2) ดึงรายละเอียดทีละกลุ่ม 3) ตรวจรายการที่ขาดแล้วขอซ้ำ
 */
async function extractDoc(parts: unknown[], label: string, presetNames?: string[]) {
  let names: string[] = presetNames?.filter(Boolean) || [];
  try {
    if (names.length) throw { skip: true };
    const listed = await callAI(
      [...parts, { type: "text", text: "ขั้นตอนที่ 1: ทำรายชื่อ 'ทุก' ชื่อยา/สมุนไพร/ตำรับที่ปรากฏในเอกสารนี้ ห้ามตกหล่น ห้ามใส่ชื่อที่ไม่มีในเอกสาร" }],
      "list",
    );
    names = [...(listed?.herb_names || []), ...(listed?.formula_names || [])]
      .map((n: string) => String(n || "").trim())
      .filter(Boolean);
    names = Array.from(new Map(names.map((n) => [norm(n), n])).values());
  } catch (_e) {
    if (!(_e as any)?.skip) names = presetNames || [];
  }

  const results: any[] = [];

  if (names.length === 0) {
    results.push(await callAI([...parts, { type: "text", text: `แยกข้อมูลยา/สมุนไพร/ความรู้ทั้งหมดจาก${label}` }]));
  } else {
    const groups: string[][] = [];
    for (let i = 0; i < names.length; i += GROUP_SIZE) groups.push(names.slice(i, i + GROUP_SIZE));
    const partials = await runPool(groups, 3, async (g, gi) =>
      callAI([
        ...parts,
        {
          type: "text",
          text:
            `ขั้นตอนที่ 2: ดึงรายละเอียดเฉพาะรายการต่อไปนี้จากเอกสารให้ครบทุกช่องที่มีข้อมูล:\n- ${g.join("\n- ")}\n` +
            (gi === 0 ? "และถ้ามีเนื้อหาบทความ/แนวทาง/ความรู้ทั่วไป ให้ใส่ใน knowledge ด้วย" : "ไม่ต้องใส่ knowledge ในรอบนี้"),
        },
      ]),
    );
    results.push(...partials);
  }

  let merged = mergeResults(results);
  const got = () =>
    new Set([...merged.herbs.map((h) => norm(h.name_thai)), ...merged.formulas.map((f) => norm(f.name_thai))]);

  let missing = names.filter((n) => !got().has(norm(n)));
  if (missing.length) {
    const retryGroups: string[][] = [];
    for (let i = 0; i < missing.length; i += GROUP_SIZE) retryGroups.push(missing.slice(i, i + GROUP_SIZE));
    const retried = await runPool(retryGroups.slice(0, 5), 2, async (g) =>
      callAI([
        ...parts,
        { type: "text", text: `รายการเหล่านี้ยังไม่ถูกดึงออกมา กรุณาดึงรายละเอียดให้ครบ:\n- ${g.join("\n- ")}` },
      ]).catch(() => ({})),
    );
    merged = mergeResults([merged, ...retried]);
    missing = names.filter((n) => !got().has(norm(n)));
  }

  const stats: Stats = {
    chunks: 1,
    names_found: names.length,
    names_extracted: merged.herbs.length + merged.formulas.length,
    missing,
  };
  return { ...merged, stats };
}

async function extractFromText(text: string, presetNames?: string[]) {
  const parts = chunkText(text);
  if (!parts.length) throw new Error("ไม่พบข้อความในเอกสาร");
  const perChunk = await runPool(parts, 3, (p, i) =>
    extractDoc([{ type: "text", text: `เอกสาร (ส่วนที่ ${i + 1}/${parts.length}):\n\n${p}` }], "ข้อความนี้", presetNames),
  );
  const merged = mergeResults(perChunk);
  const namesFound = perChunk.reduce((s, r: any) => s + (r.stats?.names_found || 0), 0);
  const missing = Array.from(
    new Set(perChunk.flatMap((r: any) => r.stats?.missing || [])),
  ).filter((n) => !merged.herbs.some((h) => norm(h.name_thai) === norm(n)) && !merged.formulas.some((f) => norm(f.name_thai) === norm(n)));
  return {
    ...merged,
    stats: {
      chunks: parts.length,
      names_found: namesFound,
      names_extracted: merged.herbs.length + merged.formulas.length,
      missing,
      truncated: parts.length >= MAX_CHUNKS,
    } as Stats,
  };
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

async function extractFromFile(filePath: string, fileName: string, presetNames?: string[]) {
  const { data, error } = await admin.storage.from("imports").download(filePath);
  if (error || !data) throw new Error(`ดาวน์โหลดไฟล์ไม่สำเร็จ: ${error?.message || "ไม่พบไฟล์"}`);
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.length === 0) throw new Error("ไฟล์ว่างเปล่า");
  const lower = fileName.toLowerCase();
  const mime = data.type || "application/octet-stream";

  if (lower.endsWith(".pdf")) {
    return await extractDoc(
      [
        {
          type: "file",
          file: { filename: fileName, file_data: `data:application/pdf;base64,${b64(bytes)}` },
        },
      ],
      "เอกสาร PDF นี้",
      presetNames,
    );
  }
  if (/\.(png|jpg|jpeg|webp)$/.test(lower)) {
    const imgMime = mime.startsWith("image/") ? mime : "image/png";
    return await extractDoc(
      [{ type: "image_url", image_url: { url: `data:${imgMime};base64,${b64(bytes)}` } }],
      "ภาพเอกสารนี้",
      presetNames,
    );
  }
  if (lower.endsWith(".docx")) return await extractFromText(await readDocx(bytes), presetNames);
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return await extractFromText(await readSheet(bytes), presetNames);
  }
  // txt / md / csv / อื่น ๆ
  return await extractFromText(new TextDecoder().decode(bytes), presetNames);
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
      const { file_path, file_name, text, job_id, only_names } = body;
      const presetNames: string[] | undefined =
        Array.isArray(only_names) && only_names.length ? only_names.map(String) : undefined;
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
          ? await extractFromFile(file_path, file_name || file_path, presetNames)
          : await extractFromText(String(text || ""), presetNames);
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
