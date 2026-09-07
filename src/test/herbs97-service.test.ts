import { describe, it, expect } from "vitest";
import {
  HERBS_97_DATA,
  searchHerbs97ByName,
  formatHerb97ForAiContext,
  normalizeDrugName,
} from "../lib/herbs97-service";

describe("97 Herbs Dataset & Search (Column A focus)", () => {
  it("should contain exactly 97 items", () => {
    expect(HERBS_97_DATA.length).toBe(97);
  });

  it("should find exact match by Column A name", () => {
    const results = searchHerbs97ByName("ยาหอมเทพจิตร");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("ยาหอมเทพจิตร");
    expect(results[0].indication).toContain("แก้ลมกองละเอียด");
  });

  it("should find match when user mentions drug without 'ยา' prefix", () => {
    const results = searchHerbs97ByName("กิน ศุขไสยาศน์ ช่วยให้นอนหลับได้ไหม");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("ยาศุขไสยาศน์");
    expect(results[0].drug_interaction).toBeDefined();
  });

  it("should find close match for complex drug names", () => {
    const results = searchHerbs97ByName("ยาผสมเพชรสังฆาต");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.name.includes("เพชรสังฆาต"))).toBe(true);
  });

  it("should format rich context including indication, dosage, and DDI", () => {
    const results = searchHerbs97ByName("ยาขมิ้นชัน");
    expect(results.length).toBeGreaterThan(0);
    const context = formatHerb97ForAiContext(results);
    expect(context).toContain("ยาขมิ้นชัน");
    expect(context).toContain("สรรพคุณ/ข้อบ่งใช้");
    expect(context).toContain("ปฏิกิริยาระหว่างยา (Drug Interaction)");
  });
});
