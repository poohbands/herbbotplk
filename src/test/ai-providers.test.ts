import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_PROVIDERS,
  getLocalProviders,
  saveLocalProviders,
  isValidAsciiKey,
  sanitizeKey,
} from "../lib/ai-providers-storage";

describe("AI Providers Storage & KOB AI Integration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("includes KOB AI as provider #5 in DEFAULT_PROVIDERS", () => {
    expect(DEFAULT_PROVIDERS.length).toBeGreaterThanOrEqual(5);

    const kobai = DEFAULT_PROVIDERS.find((p) => p.provider_key === "kobai");
    expect(kobai).toBeDefined();
    expect(kobai?.name).toBe("KOB AI");
    expect(kobai?.base_url).toBe("https://www.kob-ai.dev/v1");
    expect(kobai?.priority).toBe(5);
  });

  it("returns all 5 providers when localStorage is empty", () => {
    const list = getLocalProviders();
    expect(list.some((p) => p.provider_key === "kobai")).toBe(true);
    const kob = list.find((p) => p.provider_key === "kobai");
    expect(kob?.base_url).toBe("https://www.kob-ai.dev/v1");
  });

  it("auto-merges KOB AI for users who previously had only 4 providers in localStorage", () => {
    // Simulate an older localStorage containing only the first 4 providers
    const legacyProviders = DEFAULT_PROVIDERS.filter((p) => p.provider_key !== "kobai");
    saveLocalProviders(legacyProviders);

    const reloaded = getLocalProviders();
    expect(reloaded.length).toBe(5);
    const kob = reloaded.find((p) => p.provider_key === "kobai");
    expect(kob).toBeDefined();
    expect(kob?.name).toBe("KOB AI");
    expect(kob?.base_url).toBe("https://www.kob-ai.dev/v1");
  });

  it("validates and sanitizes API keys correctly", () => {
    expect(isValidAsciiKey("sk-kobai-1234567890abcdef")).toBe(true);
    expect(isValidAsciiKey("")).toBe(false);
    expect(isValidAsciiKey("AIzaSyไทย123")).toBe(false);

    expect(sanitizeKey(" sk-kobai-123\n")).toBe("sk-kobai-123");
  });

  it("normalizes chat messages to strictly alternate roles for DeepSeek/OpenAI", async () => {
    const { buildNormalizedChatMessages } = await import("../lib/local-chat-service");

    // Case 1: Initial conversation starting with welcome message (assistant)
    const historyWithWelcome = [
      { role: "assistant", content: "สวัสดีครับ ผมคือผู้ช่วยเภสัชกรอัจฉริยะ" },
      { role: "user", content: "ฟ้าทะลายโจรมีสรรพคุณอย่างไร" },
    ];
    const msgs1 = buildNormalizedChatMessages("SYSTEM_PROMPT", historyWithWelcome, "ฟ้าทะลายโจรมีสรรพคุณอย่างไร");

    expect(msgs1.length).toBe(2);
    expect(msgs1[0]).toEqual({ role: "system", content: "SYSTEM_PROMPT" });
    expect(msgs1[1]).toEqual({ role: "user", content: "ฟ้าทะลายโจรมีสรรพคุณอย่างไร" });

    // Case 2: Multi-turn conversation with consecutive same-role messages
    const multiTurnHistory = [
      { role: "assistant", content: "welcome" },
      { role: "user", content: "ยาตัวแรก" },
      { role: "assistant", content: "คำตอบตัวแรก" },
      { role: "assistant", content: "คำตอบเพิ่มเติม" },
      { role: "user", content: "ถามต่อ 1" },
      { role: "user", content: "ถามต่อ 2" },
    ];
    const msgs2 = buildNormalizedChatMessages("SYSTEM_PROMPT", multiTurnHistory, "ถามต่อ 3");

    // Every turn after system must alternate: user -> assistant -> user
    expect(msgs2[0].role).toBe("system");
    for (let i = 1; i < msgs2.length; i++) {
      const expectedRole = i % 2 === 1 ? "user" : "assistant";
      expect(msgs2[i].role).toBe(expectedRole);
    }
    // Last message must always be user
    expect(msgs2[msgs2.length - 1].role).toBe("user");
    expect(msgs2[msgs2.length - 1].content).toContain("ถามต่อ 3");
  });

  it("traces processLocalChat for curcuma", async () => {
    const { processLocalChat } = await import("../lib/local-chat-service");
    localStorage.setItem(
      "herbbot_ai_providers",
      JSON.stringify([
        {
          id: "deepseek-default",
          name: "DeepSeek",
          provider_key: "deepseek",
          base_url: "https://api.deepseek.com",
          model_name: "deepseek-chat",
          is_active: true,
          priority: 1,
          api_key: "sk-test-fake-key",
        },
      ])
    );

    let sentPayload: any = null;
    // mock global fetch
    const originalFetch = global.fetch;
    global.fetch = async (url: any, opts: any) => {
      if (String(url).includes("deepseek.com")) {
        sentPayload = JSON.parse(opts.body);
        return new Response('data: {"choices":[{"delta":{"content":"ขมิ้นชันช่วยย่อยอาหาร [METADATA]category: herbal_info\\nseverity: none[/METADATA][SOURCES]{\\"internal\\":[],\\"pubmed\\":[],\\"thaijo\\":[],\\"knowledge\\":[]}[/SOURCES]"}}]}\n\ndata: [DONE]\n\n', {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }
      return originalFetch(url, opts);
    };

    try {
      const res = await processLocalChat("ขมิ้นชันใช้รักษาอะไรได้บ้าง?", []);
      expect(res).toContain("ขมิ้นชัน");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("handles PubMed results gracefully in processLocalChat without p.authors.join crash", async () => {
    const { processLocalChat } = await import("../lib/local-chat-service");
    localStorage.setItem(
      "herbbot_ai_providers",
      JSON.stringify([
        {
          id: "deepseek-default",
          name: "DeepSeek",
          provider_key: "deepseek",
          base_url: "https://api.deepseek.com",
          model_name: "deepseek-chat",
          is_active: true,
          priority: 1,
          api_key: "sk-test-fake-key",
        },
      ])
    );

    let receivedSystemPrompt = "";
    const originalFetch = global.fetch;
    global.fetch = async (url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes("esearch.fcgi")) {
        return new Response(JSON.stringify({ esearchresult: { idlist: ["123456"] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (urlStr.includes("esummary.fcgi")) {
        return new Response(
          JSON.stringify({
            result: {
              "123456": {
                title: "Curcumin clinical trials in digestive disorders",
                authors: [{ name: "Aggarwal BB" }, { name: "Gupta SC" }],
                pubdate: "2024 Jan 15",
                source: "Phytomedicine",
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("deepseek.com")) {
        const body = JSON.parse(opts.body);
        receivedSystemPrompt = body.messages[0]?.content || "";
        return new Response(
          'data: {"choices":[{"delta":{"content":"ขมิ้นชันมีฤทธิ์ขับลม แก้อาการท้องอืด ท้องเฟ้อ [METADATA]category: herbal_info\\nseverity: none[/METADATA][SOURCES]{\\"internal\\":[],\\"pubmed\\":[],\\"thaijo\\":[],\\"knowledge\\":[]}[/SOURCES]"}}]}\n\ndata: [DONE]\n\n',
          { status: 200, headers: { "Content-Type": "text/event-stream" } }
        );
      }
      return originalFetch(url, opts);
    };

    try {
      const res = await processLocalChat("กระชายดำใช้รักษาอะไรได้บ้าง?", []);
      expect(res).toContain("ขมิ้นชันมีฤทธิ์ขับลม");
      expect(receivedSystemPrompt).toContain("Curcumin clinical trials in digestive disorders");
      expect(receivedSystemPrompt).toContain("Aggarwal BB, Gupta SC");
      expect(receivedSystemPrompt).toContain("Phytomedicine");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("dispatches AI_PROVIDERS_CHANGED_EVENT when saveLocalProviders is called", async () => {
    const { AI_PROVIDERS_CHANGED_EVENT } = await import("../lib/ai-providers-storage");
    let eventReceived = false;
    const handler = (e: any) => {
      eventReceived = true;
      expect(e.detail).toBeDefined();
    };

    window.addEventListener(AI_PROVIDERS_CHANGED_EVENT, handler);
    try {
      saveLocalProviders(DEFAULT_PROVIDERS);
      expect(eventReceived).toBe(true);
    } finally {
      window.removeEventListener(AI_PROVIDERS_CHANGED_EVENT, handler);
    }
  });

  it("hydrates localStorage when fetchRemoteAiProviders retrieves remote settings", async () => {
    const { fetchRemoteAiProviders, SUPABASE_AI_CONFIG_TITLE } = await import("../lib/ai-providers-storage");
    const { supabase } = await import("@/integrations/supabase/client");

    const mockRemoteData = [
      {
        id: "deepseek-default",
        name: "DeepSeek",
        provider_key: "deepseek",
        base_url: "https://api.deepseek.com",
        model_name: "deepseek-chat",
        is_active: true,
        priority: 1,
        has_key: true,
        api_key: "sk-remotedeepseekkey12345",
      },
    ];

    const originalFrom = supabase.from;
    (supabase as any).from = (table: string) => {
      if (table === "knowledge_documents") {
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              maybeSingle: async () => ({
                data: {
                  title: SUPABASE_AI_CONFIG_TITLE,
                  content: JSON.stringify(mockRemoteData),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return originalFrom(table);
    };

    try {
      // Clear local storage to simulate a fresh device / machine
      localStorage.clear();

      const result = await fetchRemoteAiProviders();
      expect(result).toBeDefined();

      const deepseek = result?.find((p) => p.provider_key === "deepseek");
      expect(deepseek).toBeDefined();
      expect(deepseek?.api_key).toBe("sk-remotedeepseekkey12345");
      expect(deepseek?.is_active).toBe(true);

      // Verify that localStorage on this new machine was hydrated!
      const stored = getLocalProviders();
      const storedDeepseek = stored.find((p) => p.provider_key === "deepseek");
      expect(storedDeepseek?.api_key).toBe("sk-remotedeepseekkey12345");
    } finally {
      (supabase as any).from = originalFrom;
    }
  });
});



