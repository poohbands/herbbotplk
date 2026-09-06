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

export const DEFAULT_PROVIDERS: ProviderItem[] = [
  {
    id: "gemini-default",
    name: "Google Gemini",
    provider_key: "gemini",
    base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
    model_name: "gemini-1.5-flash",
    is_active: true,
    priority: 1,
    has_key: false,
  },
  {
    id: "deepseek-default",
    name: "DeepSeek",
    provider_key: "deepseek",
    base_url: "https://api.deepseek.com",
    model_name: "deepseek-chat",
    is_active: false,
    priority: 2,
    has_key: false,
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
}): Promise<{ success: boolean; message: string }> {
  const key = provider.api_key?.trim();
  const url = provider.base_url?.trim().replace(/\/+$/, "");
  const model = provider.model_name?.trim();

  if (!key) {
    return { success: false, message: "ยังไม่ได้กรอก API Key" };
  }
  if (!url) {
    return { success: false, message: "ยังไม่ได้ระบุ Base URL" };
  }

  const endpoint = url.endsWith("/chat/completions") ? url : `${url}/chat/completions`;

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model || "gemini-1.5-flash",
        messages: [{ role: "user", content: "ตอบกลับสั้นๆ ว่า OK" }],
        max_tokens: 20,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return {
        success: false,
        message: `HTTP ${resp.status}: ${errText.slice(0, 150) || "การเชื่อมต่อถูกปฏิเสธ"}`,
      };
    }

    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content || "OK";
    return {
      success: true,
      message: `เชื่อมต่อสำเร็จ! AI ตอบกลับ: "${reply.slice(0, 50).trim()}"`,
    };
  } catch (e: any) {
    return {
      success: false,
      message: `เชื่อมต่อไม่สำเร็จ: ${e.message || "Network Error"}`,
    };
  }
}
