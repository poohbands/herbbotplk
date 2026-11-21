import { describe, it, expect } from "vitest";
import {
  computeAdminOverviewStats,
  normalizeHerbName,
  normalizeDrugName,
  type RawChatMessageForStats,
} from "../lib/admin-stats-service";

describe("Admin Stats Service (Items 1-3 Accuracy & Synonym Deduplication)", () => {
  it("normalizes Thai/English/scientific herb and drug synonyms and filters invalid tokens", () => {
    expect(normalizeHerbName("ขมิ้นชัน")).toBe("ขมิ้นชัน (Curcuma longa)");
    expect(normalizeHerbName("Curcuma longa")).toBe("ขมิ้นชัน (Curcuma longa)");
    expect(normalizeHerbName("Turmeric")).toBe("ขมิ้นชัน (Curcuma longa)");
    expect(normalizeHerbName("drugs:")).toBeNull();
    expect(normalizeHerbName("none")).toBeNull();

    expect(normalizeDrugName("Warfarin")).toBe("Warfarin (วาร์ฟาริน)");
    expect(normalizeDrugName("warfarin")).toBe("Warfarin (วาร์ฟาริน)");
    expect(normalizeDrugName("วาร์ฟาริน")).toBe("Warfarin (วาร์ฟาริน)");
    expect(normalizeDrugName("none")).toBeNull();
  });

  it("does not double-count user + assistant messages and scopes severityBreakdown to drug_interaction only", () => {
    const mockMessages: RawChatMessageForStats[] = [
      // 1st interaction turn (user + assistant)
      {
        role: "user",
        category: "drug_interaction",
        severity: null,
        herbs_mentioned: null,
        drugs_mentioned: null,
        created_at: "2026-11-21T10:00:00Z",
      },
      {
        role: "assistant",
        category: "drug_interaction",
        severity: "major",
        herbs_mentioned: ["ขมิ้นชัน", "Curcuma longa", "Turmeric"],
        drugs_mentioned: ["Warfarin", "วาร์ฟาริน"],
        created_at: "2026-11-21T10:00:05Z",
      },
      // Non-interaction turn that happens to have severity = moderate (must NOT count in Drug Interaction severity)
      {
        role: "user",
        category: "herbal_info",
        severity: null,
        herbs_mentioned: null,
        drugs_mentioned: null,
        created_at: "2026-11-21T10:05:00Z",
      },
      {
        role: "assistant",
        category: "herbal_info",
        severity: "moderate",
        herbs_mentioned: ["ฟ้าทะลายโจร"],
        drugs_mentioned: ["none"],
        created_at: "2026-11-21T10:05:05Z",
      },
    ];

    const stats = computeAdminOverviewStats(mockMessages, 1, new Date("2026-11-21T12:00:00Z"));

    // Item 1: totalQuestions = 2 user messages; drugInteractionCount = 1 (assistant only, not 2!)
    expect(stats.totalQuestions).toBe(2);
    expect(stats.drugInteractionCount).toBe(1);

    // Item 2: severityBreakdown only counts drug_interaction (major: 1, moderate: 0 from herbal_info)
    expect(stats.severityBreakdown).toEqual({ major: 1, moderate: 0, minor: 0 });

    // Item 3: 3 herb aliases × 2 drug aliases in 1 message must collapse into 1 canonical pair count!
    expect(stats.topInteractionPairs).toEqual([
      { pair: "ขมิ้นชัน (Curcuma longa) × Warfarin (วาร์ฟาริน)", count: 1 },
    ]);

    // Invalid token "none" must not appear in topDrugs
    expect(stats.topDrugs).toEqual([{ name: "Warfarin (วาร์ฟาริน)", count: 1 }]);
    expect(stats.topHerbs.find((h) => h.name === "ขมิ้นชัน (Curcuma longa)")?.count).toBe(1);
  });
});
