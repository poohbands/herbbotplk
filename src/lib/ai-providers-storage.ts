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

const ENV_GEMINI_KEY = isValidAsciiKey(rawGeminiEnv) ? rawGeminiEnv : "";
const ENV_DEEPSEEK_KEY = isValidAsciiKey(rawDeepseekEnv) ? rawDeepseekEnv : "";

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
];

const STORAGE_KEY = "herbbot_ai_providers";

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
  } catch (e) {
    console.error("Failed to save local ai providers:", e);
  }
}

export function getActiveLocalProvider(): ProviderItem | null {
  const providers = getLocalProviders();
  const active = providers
    .filter((p) => p.is_active && !!p.api_key && p.api_key.trim() !== "" && p.api_key !== "__CLEAR__")
    .sort((a, b) => a.priority - b.priority);
  return active[0] || null;
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

  const modelsToTry = [model || (isGoogle ? "gemini-flash-latest" : "deepseek-chat")];
  if (isGoogle) {
    ["gemini-flash-latest", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"].forEach((cand) => {
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
        signal: AbortSignal.timeout(20000),
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
