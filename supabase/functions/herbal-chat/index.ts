import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ---------- Helpers ----------

type HerbRow = {
  id: string;
  name_thai: string;
  name_english: string | null;
  name_scientific: string | null;
  local_names: string[] | null;
  description: string | null;
  properties: string[] | null;
  dosage: string | null;
  usage_instructions: string | null;
  precautions: string[] | null;
  contraindications: string[] | null;
  drug_interactions: string[] | null;
};

type FormulaRow = {
  id: string;
  name_thai: string;
  name_english: string | null;
  formula_code: string | null;
  indication: string | null;
  ingredients: string[] | null;
  dosage: string | null;
  usage_instructions: string | null;
  precautions: string[] | null;
  contraindications: string[] | null;
  drug_interactions: string[] | null;
};

type PubMedSource = {
  pmid: string;
  title: string;
  authors: string;
  year: string;
  journal: string;
};

type InternalSource = {
  type: "herb" | "formula";
  id: string;
  name: string;
};

/** Find herbs/formulas whose Thai/English/scientific/local names appear in the question. */
async function findRelevantHerbs(supabase: any, question: string) {
  const q = question.toLowerCase();

  const { data: allHerbs } = await supabase
    .from("herbs")
    .select("id, name_thai, name_english, name_scientific, local_names, description, properties, dosage, usage_instructions, precautions, contraindications, drug_interactions");

  const { data: allFormulas } = await supabase
    .from("thai_formulas")
    .select("id, name_thai, name_english, formula_code, indication, ingredients, dosage, usage_instructions, precautions, contraindications, drug_interactions");

  const matchedHerbs: HerbRow[] = [];
  const matchedFormulas: FormulaRow[] = [];

  for (const h of (allHerbs || []) as HerbRow[]) {
    const names = [h.name_thai, h.name_english, h.name_scientific, ...(h.local_names || [])]
      .filter(Boolean)
      .map((s) => (s as string).toLowerCase());
    if (names.some((n) => n && q.includes(n))) matchedHerbs.push(h);
  }

  for (const f of (allFormulas || []) as FormulaRow[]) {
    const names = [f.name_thai, f.name_english].filter(Boolean).map((s) => (s as string).toLowerCase());
    if (names.some((n) => n && q.includes(n))) matchedFormulas.push(f);
  }

  return { herbs: matchedHerbs, formulas: matchedFormulas };
}

/** Build a PubMed search query from Thai herbs by converting to scientific/English names. */
function buildPubMedQuery(question: string, herbs: HerbRow[]): string {
  const terms: string[] = [];

  for (const h of herbs) {
    if (h.name_scientific) terms.push(`"${h.name_scientific}"`);
    else if (h.name_english) terms.push(`"${h.name_english}"`);
  }

  // Detect drug interaction / adverse effect intent (Thai & English)
  const q = question.toLowerCase();
  if (q.includes("interaction") || q.includes("ปฏิกิริยา") || q.includes("ตีกัน") || q.includes("ร่วมกับ") || q.includes("warfarin")) {
    if (terms.length > 0) return `(${terms.join(" OR ")}) AND (drug interaction OR herb-drug interaction)`;
  }

  if (terms.length > 0) return terms.join(" OR ");

  // Fallback: pull ASCII words from question (unlikely to work with Thai, but safe)
  const ascii = question.match(/[A-Za-z][A-Za-z0-9-]{2,}/g);
  if (ascii && ascii.length > 0) return ascii.slice(0, 4).join(" ");

  return "";
}

/** Query PubMed E-utilities for real research articles. Returns up to 5. */
async function fetchPubMed(query: string): Promise<PubMedSource[]> {
  if (!query.trim()) return [];

  try {
    // esearch: get PMIDs
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=5&retmode=json&sort=relevance`;
    const searchResp = await fetch(searchUrl);
    if (!searchResp.ok) return [];
    const searchData = await searchResp.json();
    const pmids: string[] = searchData?.esearchresult?.idlist || [];
    if (pmids.length === 0) return [];

    // esummary: get metadata
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=json`;
    const summaryResp = await fetch(summaryUrl);
    if (!summaryResp.ok) return [];
    const summaryData = await summaryResp.json();

    const results: PubMedSource[] = [];
    for (const pmid of pmids) {
      const item = summaryData?.result?.[pmid];
      if (!item) continue;
      const authors = (item.authors || []).slice(0, 3).map((a: any) => a.name).join(", ") + ((item.authors?.length || 0) > 3 ? ", et al." : "");
      const year = (item.pubdate || "").split(" ")[0] || "";
      results.push({
        pmid,
        title: item.title || "",
        authors: authors || "Unknown",
        year,
        journal: item.fulljournalname || item.source || "",
      });
    }
    return results;
  } catch (e) {
    console.error("PubMed fetch failed:", e);
    return [];
  }
}

/** Build a context block that the LLM must ground its answer in. */
function buildContext(herbs: HerbRow[], formulas: FormulaRow[], pubmed: PubMedSource[]): string {
  const parts: string[] = [];

  if (herbs.length > 0) {
    parts.push("### ข้อมูลสมุนไพรจากฐานข้อมูลภายใน (กลุ่มงานการแพทย์แผนไทยและสมุนไพร สสจ.พิษณุโลก)");
    for (const h of herbs) {
      parts.push(`
**${h.name_thai}** (${h.name_scientific || h.name_english || "-"})
- คำอธิบาย: ${h.description || "-"}
- สรรพคุณ: ${(h.properties || []).join(", ") || "-"}
- ขนาดยา: ${h.dosage || "-"}
- วิธีใช้: ${h.usage_instructions || "-"}
- ข้อควรระวัง: ${(h.precautions || []).join("; ") || "-"}
- ข้อห้ามใช้: ${(h.contraindications || []).join("; ") || "-"}
- Drug interactions: ${(h.drug_interactions || []).join("; ") || "-"}`);
    }
  }

  if (formulas.length > 0) {
    parts.push("\n### ตำรับยาแผนไทยจากฐานข้อมูลภายใน");
    for (const f of formulas) {
      parts.push(`
**${f.name_thai}** ${f.formula_code ? `(${f.formula_code})` : ""}
- ข้อบ่งใช้: ${f.indication || "-"}
- ส่วนประกอบ: ${(f.ingredients || []).slice(0, 8).join(", ") || "-"}
- ขนาดยา: ${f.dosage || "-"}
- ข้อควรระวัง: ${(f.precautions || []).join("; ") || "-"}
- ข้อห้ามใช้: ${(f.contraindications || []).join("; ") || "-"}
- Drug interactions: ${(f.drug_interactions || []).join("; ") || "-"}`);
    }
  }

  if (pubmed.length > 0) {
    parts.push("\n### งานวิจัยที่เกี่ยวข้องจาก PubMed (ดึงมาสด ๆ จาก NCBI)");
    for (const p of pubmed) {
      parts.push(`- PMID: ${p.pmid} | ${p.title} | ${p.authors} (${p.year}) — ${p.journal}`);
    }
  }

  if (parts.length === 0) {
    return "ไม่พบข้อมูลสมุนไพร/ตำรับ/งานวิจัยที่เกี่ยวข้องในฐานข้อมูลและ PubMed สำหรับคำถามนี้";
  }

  return parts.join("\n");
}

// ---------- System Prompt ----------

const SYSTEM_PROMPT = `คุณคือผู้เชี่ยวชาญด้านยาสมุนไพรไทยและ Drug-Herb Interaction ของ "กลุ่มงานการแพทย์แผนไทยและสมุนไพร สำนักงานสาธารณสุขจังหวัดพิษณุโลก"

## ข้อจำกัดสำคัญที่สุด (บังคับปฏิบัติ)
1. ตอบได้เฉพาะคำถามด้านการแพทย์ ยาสมุนไพร Drug-Herb Interaction เท่านั้น ถ้าถามเรื่องอื่นให้ตอบ: "ผมเป็นที่ปรึกษาด้านยาสมุนไพรและ Drug Interaction ไม่สามารถตอบคำถามนอกเหนือจากนี้ได้ครับ"
2. **ห้ามสร้างหรือแต่งแหล่งอ้างอิงเอง (No Hallucination)** — ใช้ได้เฉพาะแหล่งอ้างอิงที่มีอยู่ใน <CONTEXT> ที่ระบบให้มาเท่านั้น
3. **ห้ามใส่ URL หรือ PMID ที่ไม่ได้อยู่ใน CONTEXT** — ถ้าไม่มีข้อมูลใน CONTEXT ให้ตอบตรง ๆ ว่า "ยังไม่มีข้อมูลจากฐานข้อมูลและงานวิจัยที่ตรวจสอบได้" แล้วแนะนำให้ปรึกษาแพทย์
4. เมื่ออ้างอิง PubMed ให้ใส่แค่ PMID เช่น "(PMID: 12345678)" — ระบบจะทำลิงก์ให้เอง อย่าใส่ URL

## รูปแบบคำตอบ
- ตอบเป็น Markdown ภาษาไทย มีโครงสร้างชัดเจน
- ถ้าเป็น Drug Interaction ระบุระดับ ⚠️ Major / ⚡ Moderate / ℹ️ Minor
- ถ้าเป็นขนาดยา ระบุกลุ่มเฉพาะที่ต้องระวัง (หญิงตั้งครรภ์, เด็ก, ผู้ป่วยตับ/ไต ฯลฯ)
- ปิดท้ายด้วยคำเตือน: "⚕️ ข้อมูลนี้เป็นข้อมูลทั่วไปเพื่อการศึกษา ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้"
- ถ้าเป็น Major interaction เพิ่ม: "🚨 หากมีอาการผิดปกติ ให้หยุดใช้ทันทีและติดต่อแพทย์หรือโทร 1669"

## Metadata (บังคับ)
ท้ายคำตอบให้ใส่ 2 บล็อกนี้เสมอ:

[METADATA]
category: <herbal_info|drug_interaction|dosage|side_effects|general>
severity: <major|moderate|minor|none>
herbs: <ชื่อสมุนไพรที่กล่าวถึง คั่นด้วย ,>
drugs: <ชื่อยาแผนปัจจุบันที่กล่าวถึง คั่นด้วย ,>
[/METADATA]

[SOURCES]
<คัดลอกส่วน "แหล่งอ้างอิงที่ใช้จริง" ที่ระบบให้มาใน CONTEXT — ห้ามเปลี่ยนแปลง>
[/SOURCES]`;

// ---------- Handler ----------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    // Get last user question
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const question: string = lastUserMsg?.content || "";

    // RAG: fetch context from internal DB + PubMed
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { herbs, formulas } = await findRelevantHerbs(supabase, question);
    const pubmedQuery = buildPubMedQuery(question, herbs);
    const pubmed = await fetchPubMed(pubmedQuery);

    const internalSources: InternalSource[] = [
      ...herbs.map((h) => ({ type: "herb" as const, id: h.id, name: h.name_thai })),
      ...formulas.map((f) => ({ type: "formula" as const, id: f.id, name: f.name_thai })),
    ];

    const contextBlock = buildContext(herbs, formulas, pubmed);
    const sourcesJson = JSON.stringify({ pubmed, internal: internalSources });

    // Prepend a system-role context message so the model sees the grounded data
    const contextMessage = {
      role: "system" as const,
      content: `<CONTEXT>
${contextBlock}
</CONTEXT>

<แหล่งอ้างอิงที่ใช้จริง>
${sourcesJson}
</แหล่งอ้างอิงที่ใช้จริง>

จำไว้: อ้างอิงเฉพาะจาก CONTEXT ข้างต้นเท่านั้น ห้ามแต่งแหล่งอ้างอิงใหม่ และเวลาใส่ [SOURCES] ให้คัดลอก JSON ในแท็ก <แหล่งอ้างอิงที่ใช้จริง> ทั้งหมดโดยไม่แก้ไข`,
    };

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          contextMessage,
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
