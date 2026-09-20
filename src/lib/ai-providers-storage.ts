import { supabase } from "@/integrations/supabase/client";

export type ProviderItem = {
  id: string;
  name: string;
  provider_key: string;
  base_url: string;
  model_name: string;
  is_active: boolean;
  priority: number;
  has_key: boolean;
  api_key?: string;
  updated_at?: string;
  test_status?: "idle" | "testing" | "success" | "error";
  test_message?: string;
};

export function isValidAsciiKey(k?: string | null): boolean {
  if (!k || typeof k !== "string") return false;
  const trimmed = k.trim();
  // Headers in fetch only allow ISO-8859-1 / ASCII printable range
  return /^[\x20-\x7E]+$/.test(trimmed) && !trimmed.includes("ใส่_") && !trimmed.includes("YOUR_");
}

export function sanitizeKey(k?: string | null): string {
  if (!k || typeof k !== "string") return "";
  return k.replace(/[^\x20-\x7E]/g, "").trim();
}

const rawGeminiEnv = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() || "";
const rawDeepseekEnv = (import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined)?.trim() || "";
const rawKobaiEnv = (import.meta.env.VITE_KOBAI_API_KEY as string | undefined)?.trim() || "";

const ENV_GEMINI_KEY = isValidAsciiKey(rawGeminiEnv) ? rawGeminiEnv : "";
const ENV_DEEPSEEK_KEY = isValidAsciiKey(rawDeepseekEnv) ? rawDeepseekEnv : "";
const ENV_KOBAI_KEY = isValidAsciiKey(rawKobaiEnv) ? rawKobaiEnv : "";

export const DEFAULT_PROVIDERS: ProviderItem[] = [
  {
    id: "gemini-default",
    name: "Google Gemini",
    provider_key: "gemini",
    base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
    model_name: "gemini-flash-latest",
    is_active: true,
    priority: 1,
    has_key: Boolean(ENV_GEMINI_KEY),
    api_key: ENV_GEMINI_KEY || undefined,
  },
  {
    id: "deepseek-default",
    name: "DeepSeek",
    provider_key: "deepseek",
    base_url: "https://api.deepseek.com",
    model_name: "deepseek-chat",
    is_active: Boolean(ENV_DEEPSEEK_KEY),
    priority: 2,
    has_key: Boolean(ENV_DEEPSEEK_KEY),
    api_key: ENV_DEEPSEEK_KEY || undefined,
  },
  {
    id: "openrouter-default",
    name: "OpenRouter",
    provider_key: "openrouter",
    base_url: "https://openrouter.ai/api/v1",
    model_name: "deepseek/deepseek-chat",
    is_active: false,
    priority: 3,
    has_key: false,
  },
  {
    id: "qwen-default",
    name: "Qwen",
    provider_key: "qwen",
    base_url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    model_name: "qwen-plus",
    is_active: false,
    priority: 4,
    has_key: false,
  },
  {
    id: "kobai-default",
    name: "KOB AI",
    provider_key: "kobai",
    base_url: "https://www.kob-ai.dev/v1",
    model_name: "claude-3-5-sonnet",
    is_active: Boolean(ENV_KOBAI_KEY),
    priority: 5,
    has_key: Boolean(ENV_KOBAI_KEY),
    api_key: ENV_KOBAI_KEY || undefined,
  },
];

const STORAGE_KEY = "herbbot_ai_providers";
export const AI_PROVIDERS_CHANGED_EVENT = "herbbot_ai_providers_changed";
export const SUPABASE_AI_CONFIG_TITLE = "SYSTEM_AI_PROVIDERS_CONFIG";

export function getLocalProviders(): ProviderItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROVIDERS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // ซิงค์คีย์ส่วนกลางจาก ENV หากในเครื่องยังไม่ได้ตั้งคีย์เฉพาะ
      if (ENV_GEMINI_KEY) {
        const gem = parsed.find((p: ProviderItem) => p.provider_key === "gemini");
        if (gem && (!gem.api_key || gem.api_key === "__CLEAR__")) {
          gem.api_key = ENV_GEMINI_KEY;
          gem.has_key = true;
        }
      }
      if (ENV_DEEPSEEK_KEY) {
        const deep = parsed.find((p: ProviderItem) => p.provider_key === "deepseek");
        if (deep && (!deep.api_key || deep.api_key === "__CLEAR__")) {
          deep.api_key = ENV_DEEPSEEK_KEY;
          deep.has_key = true;
        }
      }
      if (ENV_KOBAI_KEY) {
        const kob = parsed.find((p: ProviderItem) => p.provider_key === "kobai");
        if (kob && (!kob.api_key || kob.api_key === "__CLEAR__")) {
          kob.api_key = ENV_KOBAI_KEY;
          kob.has_key = true;
        }
      }

      // ตรวจสอบว่ามี provider ใดใน DEFAULT_PROVIDERS ที่ยังไม่มีใน parsed หรือไม่ (เช่น kobai ที่เพิ่งเพิ่ม)
      for (const def of DEFAULT_PROVIDERS) {
        const exists = parsed.some(
          (p: ProviderItem) => p.provider_key === def.provider_key || p.id === def.id
        );
        if (!exists) {
          parsed.push({
            ...def,
            priority: parsed.length + 1,
          });
        }
      }

      return parsed;
    }
  } catch (e) {
    console.error("Failed to read local ai providers:", e);
  }
  return DEFAULT_PROVIDERS;
}

export function saveLocalProviders(providers: ProviderItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(AI_PROVIDERS_CHANGED_EVENT, { detail: providers }));
      window.dispatchEvent(new Event("storage"));
    }
  } catch (e) {
    console.error("Failed to save local ai providers:", e);
  }
}

/** ซิงค์ค่าผู้ให้บริการ AI ไปยัง Supabase knowledge_documents เพื่อให้อุปกรณ์ทุกเครื่องใช้งานร่วมกันได้ */
export async function syncAiProvidersToSupabase(providers: ProviderItem[]): Promise<void> {
  try {
    if (!supabase) return;

    // กรองและทำความสะอาดข้อมูลก่อนส่งขึ้นคลาวด์
    const cleanPayload = providers.map((p) => ({
      id: p.id,
      name: p.name,
      provider_key: p.provider_key,
      base_url: p.base_url,
      model_name: p.model_name,
      is_active: p.is_active,
      priority: p.priority,
      has_key: Boolean(p.api_key && p.api_key.trim() !== "" && p.api_key !== "__CLEAR__"),
      api_key: p.api_key && p.api_key !== "__CLEAR__" ? sanitizeKey(p.api_key) : undefined,
      updated_at: new Date().toISOString(),
    }));

    const { data: existing } = await supabase
      .from("knowledge_documents")
      .select("id")
      .eq("title", SUPABASE_AI_CONFIG_TITLE)
      .maybeSingle();

    const payload = {
      title: SUPABASE_AI_CONFIG_TITLE,
      category: "system_setting",
      content: JSON.stringify(cleanPayload),
      tags: ["system", "ai_providers"],
      is_published: true,
      source: "HerbBot System Admin",
    };

    if (existing?.id) {
      await supabase.from("knowledge_documents").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("knowledge_documents").insert(payload);
    }
  } catch (e) {
    console.warn("Failed to sync AI providers to Supabase:", e);
  }
}

/** ดึงค่าผู้ให้บริการ AI จาก Supabase Cloud เพื่อให้อุปกรณ์เครื่องใหม่มีคีย์และสลับโมเดลอัตโนมัติ */
export async function fetchRemoteAiProviders(): Promise<ProviderItem[] | null> {
  try {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("content, updated_at")
      .eq("title", SUPABASE_AI_CONFIG_TITLE)
      .maybeSingle();

    if (error || !data?.content) return null;
    const remoteList = JSON.parse(data.content);
    if (!Array.isArray(remoteList) || remoteList.length === 0) return null;

    // รวมข้อมูลจาก remote เข้ากับ local
    const local = getLocalProviders();
    const merged = [...local];

    let hasChange = false;

    remoteList.forEach((rem: any) => {
      if (!rem || !rem.provider_key) return;
      const matchIdx = merged.findIndex(
        (m) => m.provider_key === rem.provider_key || m.id === rem.id
      );

      if (matchIdx >= 0) {
        const cur = merged[matchIdx];
        const remKey = rem.api_key && isValidAsciiKey(rem.api_key) ? sanitizeKey(rem.api_key) : undefined;
        // ถ้าคลาวด์มี API key แต่ในเครื่องยังไม่มี ให้ใช้คีย์จากคลาวด์
        if (remKey && (!cur.api_key || cur.api_key === "__CLEAR__" || cur.api_key !== remKey)) {
          cur.api_key = remKey;
          cur.has_key = true;
          hasChange = true;
        }
        if (typeof rem.is_active === "boolean" && cur.is_active !== rem.is_active) {
          cur.is_active = rem.is_active;
          hasChange = true;
        }
        if (typeof rem.priority === "number" && cur.priority !== rem.priority) {
          cur.priority = rem.priority;
          hasChange = true;
        }
        if (rem.model_name && cur.model_name !== rem.model_name) {
          cur.model_name = rem.model_name;
          hasChange = true;
        }
        if (rem.base_url && cur.base_url !== rem.base_url) {
          cur.base_url = rem.base_url;
          hasChange = true;
        }
      } else {
        // รายการที่ยังไม่มีในเครื่อง
        merged.push({
          id: rem.id || `${rem.provider_key}-custom`,
          name: rem.name || rem.provider_key,
          provider_key: rem.provider_key,
          base_url: rem.base_url || "",
          model_name: rem.model_name || "gemini-2.5-flash",
          is_active: Boolean(rem.is_active),
          priority: typeof rem.priority === "number" ? rem.priority : merged.length + 1,
          has_key: Boolean(rem.api_key),
          api_key: rem.api_key && isValidAsciiKey(rem.api_key) ? sanitizeKey(rem.api_key) : undefined,
        });
        hasChange = true;
      }
    });

    merged.sort((a, b) => a.priority - b.priority);

    if (hasChange && typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent(AI_PROVIDERS_CHANGED_EVENT, { detail: merged }));
        window.dispatchEvent(new Event("storage"));
      } catch {}
    }

    return merged;
  } catch (e) {
    console.warn("Failed to fetch remote AI providers:", e);
    return null;
  }
}

export type ActiveApiStatus = {
  name: string;
  model_name: string;
  provider_key: string;
  priority: number;
  is_active: boolean;
  updatedAtText: string;
};

export function getCurrentActiveProviderStatus(): ActiveApiStatus {
  const local = getLocalProviders();
  const active = local
    .filter((p) => p.is_active && !!p.api_key && p.api_key.trim() !== "" && p.api_key !== "__CLEAR__")
    .sort((a, b) => a.priority - b.priority);

  const timeStr = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  if (active.length > 0) {
    const top = active[0];
    return {
      name: top.name,
      model_name: top.model_name,
      provider_key: top.provider_key,
      priority: top.priority,
      is_active: true,
      updatedAtText: timeStr,
    };
  }

  return {
    name: "Google Gemini",
    model_name: "gemini-2.5-flash",
    provider_key: "gemini",
    priority: 1,
    is_active: false,
    updatedAtText: timeStr,
  };
}

export function getActiveLocalProvider(): ProviderItem | null {
  const providers = getLocalProviders();
  const active = providers
    .filter((p) => p.is_active && !!p.api_key && p.api_key.trim() !== "" && p.api_key !== "__CLEAR__")
    .sort((a, b) => a.priority - b.priority);
  return active[0] || null;
}

function safeTimeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    try {
      return AbortSignal.timeout(ms);
    } catch {}
  }
  if (typeof AbortController !== "undefined") {
    const controller = new AbortController();
    setTimeout(() => {
      try {
        controller.abort();
      } catch {}
    }, ms);
    return controller.signal;
  }
  return undefined;
}

export async function testProviderDirectly(provider: {
  api_key?: string;
  base_url: string;
  model_name: string;
}): Promise<{ success: boolean; message: string; suggestedModel?: string }> {
  const rawKey = provider.api_key?.trim() || "";
  const url = provider.base_url?.trim().replace(/\/+$/, "");
  const model = provider.model_name?.trim();

  if (!rawKey || rawKey === "__CLEAR__") {
    return { success: false, message: "ยังไม่ได้กรอก API Key" };
  }

  if (!isValidAsciiKey(rawKey)) {
    return {
      success: false,
      message: "API Key ไม่ถูกต้อง: มีตัวอักษรภาษาไทยหรืออักขระพิเศษปนอยู่ กรุณาลบกุญแจเดิมแล้วใส่เฉพาะรหัสภาษาอังกฤษ/ตัวเลข (เช่น AIza... หรือ AQ...)",
    };
  }

  const cleanKey = sanitizeKey(rawKey);

  if (!url) {
    return { success: false, message: "ยังไม่ได้ระบุ Base URL" };
  }

  const endpoint = url.endsWith("/chat/completions") ? url : `${url}/chat/completions`;
  const isGoogle = url.includes("google") || provider.base_url?.includes("generativelanguage");
  const isKobAi = url.includes("kob-ai") || provider.base_url?.includes("kob-ai");

  const modelsToTry = [model || (isGoogle ? "gemini-1.5-flash" : isKobAi ? "claude-3-5-sonnet" : "deepseek-chat")];
  if (isGoogle) {
    ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-flash-latest"].forEach((cand) => {
      if (!modelsToTry.includes(cand)) modelsToTry.push(cand);
    });
  } else if (isKobAi) {
    ["claude-3-5-sonnet", "gpt-4o", "deepseek-chat", "gemini-1.5-pro"].forEach((cand) => {
      if (!modelsToTry.includes(cand)) modelsToTry.push(cand);
    });
  }

  let lastStatus = 0;
  let lastErr = "";

  for (let i = 0; i < modelsToTry.length; i++) {
    const m = modelsToTry[i];
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: "user", content: "ตอบกลับสั้นๆ ว่า OK" }],
          max_tokens: 20,
        }),
        signal: safeTimeoutSignal(20000),
      });

      lastStatus = resp.status;
      if (!resp.ok) {
        lastErr = await resp.text().catch(() => "");
        let errorMsg = lastErr;
        try {
          const parsed = JSON.parse(lastErr);
          if (Array.isArray(parsed) && parsed[0]?.error?.message) {
            errorMsg = parsed[0].error.message;
          } else if (parsed?.error?.message) {
            errorMsg = parsed.error.message;
          }
        } catch {}

        // ดึงชื่อโมเดลที่ Google แนะนำใน Error message ถ้ามี
        const match = errorMsg.match(/use models\/([a-zA-Z0-9._-]+)/i);
        if (match && match[1] && !modelsToTry.includes(match[1])) {
          modelsToTry.splice(i + 1, 0, match[1]);
          continue;
        }

        // หากเป็น 404 (ไม่มีโมเดลนี้แล้ว) หรือ 503/429 และยังมีโมเดลอื่นให้ลอง
        if ((resp.status === 404 || resp.status === 503 || resp.status === 429) && i < modelsToTry.length - 1) {
          continue;
        }

        return {
          success: false,
          message: `HTTP ${resp.status}: ${errorMsg.slice(0, 300) || "การเชื่อมต่อถูกปฏิเสธ"}`,
        };
      }

      const data = await resp.json();
      const reply = data?.choices?.[0]?.message?.content || "OK";
      const switchedNotice = m !== model ? ` (ปรับใช้โมเดล ${m} ให้อัตโนมัติ)` : "";
      return {
        success: true,
        message: `เชื่อมต่อสำเร็จ! AI ตอบกลับ: "${reply.slice(0, 50).trim()}"${switchedNotice}`,
        suggestedModel: m !== model ? m : undefined,
      };
    } catch (e: any) {
      return {
        success: false,
        message: `เชื่อมต่อไม่สำเร็จ: ${e.message || "Network Error"}`,
      };
    }
  }

  return {
    success: false,
    message: `HTTP ${lastStatus}: ${lastErr.slice(0, 300)}`,
  };
}
