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
});

