// ตัวเรียก AI แบบมีระบบสลับผู้ให้บริการอัตโนมัติ (Auto-Failover)
// อ่านรายชื่อผู้ให้บริการจากตาราง ai_providers (service role เท่านั้น)

export type ProviderRow = {
  id: string;
  name: string;
  provider_key: string;
  api_key: string | null;
  base_url: string | null;
  model_name: string;
  is_active: boolean;
  priority: number;
};

export type AiRequest = {
  messages: { role: string; content: string }[];
  response_format?: Record<string, unknown>;
  max_tokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** ใช้โมเดลเบา/เร็ว (เช่น จำแนกเจตนา) — ถ้าผู้ให้บริการไม่มีจะใช้โมเดลปกติ */
  light?: boolean;
};

export type AiResult = {
  text: string;
  provider: string;
  model: string;
};

export class AllProvidersFailedError extends Error {
  attempts: { provider: string; error: string }[];
  constructor(attempts: { provider: string; error: string }[]) {
    super("all AI providers failed");
    this.name = "AllProvidersFailedError";
    this.attempts = attempts;
  }
}

const LOVABLE_ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";

let cache: { rows: ProviderRow[]; at: number } | null = null;
const CACHE_MS = 30_000;

export async function loadActiveProviders(supabase: any): Promise<ProviderRow[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const { data, error } = await supabase
    .from("ai_providers")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: true });
  if (error) {
    console.error("[ai-router] load providers failed:", error.message);
    return [];
  }
  const rows = (data || []).filter((r: ProviderRow) => !!r.api_key && !!r.base_url);
  cache = { rows, at: Date.now() };
  return rows;
}

export function clearProviderCache() {
  cache = null;
}

export function completionsUrl(baseUrl: string): string {
  const b = baseUrl.trim().replace(/\/+$/, "");
  return b.endsWith("/chat/completions") ? b : `${b}/chat/completions`;
}

function lightModel(model: string): string {
  if (/^gemini-2\.5-flash$/i.test(model)) return "gemini-2.5-flash-lite";
  return model;
}

/** เรียกผู้ให้บริการเดี่ยว (OpenAI-compatible) — ใช้ทั้งตอนตอบจริงและตอนทดสอบการเชื่อมต่อ */
export async function callProvider(
  p: Pick<ProviderRow, "name" | "api_key" | "base_url" | "model_name">,
  req: AiRequest,
): Promise<string> {
  const url = completionsUrl(p.base_url || "");
  const body: Record<string, unknown> = {
    model: req.light ? lightModel(p.model_name) : p.model_name,
    messages: req.messages,
    stream: false,
  };
  if (req.response_format) body.response_format = req.response_format;
  if (req.max_tokens) body.max_tokens = req.max_tokens;
  if (typeof req.temperature === "number") body.temperature = req.temperature;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${p.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(req.timeoutMs ?? 30_000),
  });

  if (!resp.ok) {
    const t = (await resp.text().catch(() => "")).slice(0, 300);
    throw new Error(`HTTP ${resp.status} ${t}`);
  }
  const data = await resp.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("empty response");
  return text;
}

/**
 * เรียก AI โดยไล่ตามลำดับ priority ถ้าเจ้าไหนล้มเหลว (429/401/403/5xx/timeout)
 * จะข้ามไปเจ้าถัดไปทันที และถ้าไม่เหลือเจ้าใดเลยจะใช้ AI ภายในระบบ (Lovable AI) เป็นด่านสุดท้าย
 */
export async function aiComplete(
  providers: ProviderRow[],
  req: AiRequest,
  lovableModel = "google/gemini-2.5-flash",
): Promise<AiResult> {
  const attempts: { provider: string; error: string }[] = [];

  for (const p of providers) {
    try {
      const text = await callProvider(p, req);
      console.log(`[ai-router] served by ${p.name} (${p.model_name})`);
      return { text, provider: p.name, model: p.model_name };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ai-router] provider failed: ${p.name} — ${msg}`);
      attempts.push({ provider: p.name, error: msg });
    }
  }

  // ด่านสุดท้าย: AI ภายในระบบ
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (key) {
    try {
      const model = req.light ? `${lovableModel}-lite` : lovableModel;
      const body: Record<string, unknown> = {
        model,
        messages: req.messages,
        stream: false,
      };
      if (req.response_format) body.response_format = req.response_format;
      if (req.max_tokens) body.max_tokens = req.max_tokens;
      const resp = await fetch(LOVABLE_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(req.timeoutMs ?? 30_000),
      });
      if (!resp.ok) {
        const t = (await resp.text().catch(() => "")).slice(0, 300);
        throw new Error(`HTTP ${resp.status} ${t}`);
      }
      const data = await resp.json();
      const text: string = data?.choices?.[0]?.message?.content ?? "";
      if (!text.trim()) throw new Error("empty response");
      console.log("[ai-router] served by Lovable AI (built-in fallback)");
      return { text, provider: "Lovable AI", model };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ai-router] built-in fallback failed — ${msg}`);
      attempts.push({ provider: "Lovable AI", error: msg });
    }
  }

  throw new AllProvidersFailedError(attempts);
}
