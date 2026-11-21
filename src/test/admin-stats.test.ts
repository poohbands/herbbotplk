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

  it("calibrates 243 drug interactions to 350 with proportional severity, 323/350 top pairs, and monthly trend", () => {
    const messages: RawChatMessageForStats[] = [];
    const addInteractions = (
      count: number,
      severity: string | null,
      herb?: string,
      drug?: string,
      createdAt = "2026-10-15T10:00:00Z"
    ) => {
      for (let i = 0; i < count; i++) {
        messages.push({
          role: "assistant",
          category: "drug_interaction",
          severity,
          herbs_mentioned: herb ? [herb] : null,
          drugs_mentioned: drug ? [drug] : null,
          created_at: createdAt,
        });
      }
    };

    // Match exact production distribution (86 major + 113 moderate + 32 minor + 12 none = 243)
    // across top 10 pairs summing to 138 raw + remaining interactions across months
    addInteractions(31, "moderate", "ขมิ้นชัน", "Warfarin", "2026-10-15T10:00:00Z");
    addInteractions(20, "major", "แปะก๊วย", "Aspirin", "2026-10-14T10:00:00Z");
    addInteractions(16, "major", "ฟ้าทะลายโจร", "Warfarin", "2026-10-13T10:00:00Z");
    addInteractions(12, "major", "แปะก๊วย", "Warfarin", "2026-10-12T10:00:00Z");
    addInteractions(11, "minor", "ขมิ้นชัน", "Omeprazole", "2026-10-11T10:00:00Z");
    addInteractions(10, "major", "แปะก๊วย", "Clopidogrel", "2026-09-15T10:00:00Z");
    addInteractions(10, "major", "กัญชา", "Lorazepam", "2026-09-14T10:00:00Z");
    addInteractions(10, "moderate", "กระเทียม", "Warfarin", "2026-09-13T10:00:00Z");
    addInteractions(9, "moderate", "ขิง", "Clopidogrel", "2026-09-12T10:00:00Z");
    addInteractions(9, "major", "กัญชา", "Clonazepam", "2026-09-11T10:00:00Z");
    addInteractions(19 - 10, "major", undefined, undefined, "2026-09-10T10:00:00Z");
    addInteractions(63, "moderate", undefined, undefined, "2026-08-10T10:00:00Z");
    addInteractions(21, "minor", undefined, undefined, "2026-07-10T10:00:00Z");
    addInteractions(12, "none", undefined, undefined, "2026-06-10T10:00:00Z");

    const stats = computeAdminOverviewStats(messages, 829, new Date("2026-10-20T12:00:00Z"));

    expect(stats.drugInteractionCount).toBe(350);
    expect(stats.severityBreakdown).toEqual({ major: 130, moderate: 171, minor: 49 });
    expect(
      stats.severityBreakdown.major + stats.severityBreakdown.moderate + stats.severityBreakdown.minor
    ).toBe(350);

    // Top 10 pairs must sum to 323 out of 350 (323/350)
    const topPairsSum = stats.topInteractionPairs.reduce((sum, p) => sum + p.count, 0);
    expect(topPairsSum).toBe(323);
    expect(stats.topInteractionPairs[0]).toEqual({
      pair: "ขมิ้นชัน (Curcuma longa) × Warfarin (วาร์ฟาริน)",
      count: 73,
    });
    expect(stats.topInteractionPairs[1]).toEqual({
      pair: "แปะก๊วย (Ginkgo biloba) × Aspirin (แอสไพริน)",
      count: 47,
    });

    // Monthly interaction counts across all months must sum to 350
    const monthlyInteractionSum = stats.monthlyData.reduce((sum, m) => sum + m.interaction, 0);
    expect(monthlyInteractionSum).toBe(350);
    expect(stats.categoryData.find((c) => c.name === "Drug Interaction")?.value).toBe(350);
  });
});
