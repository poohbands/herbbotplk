import { describe, it, expect } from "vitest";
import {
  HERBS_97_DATA,
  searchHerbs97ByName,
  searchHerbs97BySymptom,
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

  it("should retrieve cannabis medicines when query mentions 'กัญชา'", () => {
    const results = searchHerbs97ByName("ยากัญชามีอะไรบ้าง");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.has_cannabis)).toBe(true);

    const names = results.map((r) => r.name);
    expect(
      names.some(
        (n) =>
          n.includes("กัญชา") ||
          n === "ยาศุขไสยาศน์" ||
          n === "ยาทำลายพระสุเมรุ" ||
          n === "ยาแก้ลมแก้เส้น" ||
          n === "ยาอัมฤตย์โอสถ" ||
          n === "ยาประสะกัญชา"
      )
    ).toBe(true);
  });

  it("should correctly tag specific cannabis formulas requested by user", () => {
    const targetCannabisDrugs = [
      "ยาทาขมิ้นชันและกัญชา",
      "ยาแก้ลมแก้เส้น",
      "ยาทำลายพระสุเมรุ",
      "ยาอัมฤตย์โอสถ",
      "ยาประสะกัญชา",
      "ยาศุขไสยาศน์",
    ];

    for (const drugName of targetCannabisDrugs) {
      const match = HERBS_97_DATA.find((h) => h.name === drugName);
      expect(match).toBeDefined();
      expect(match?.has_cannabis).toBe(true);
    }
  });

  it("searchHerbs97ByName does NOT falsely match 'ยาเหลืองปิดสมุทร' on sentence queries containing 'น้ำเหลือง'", () => {
    const query = "คนไข้มีอาการน้ำเหลืองเสีย ผื่นคัน ตามผิวหนัง เรามียาอะไรบ้าง";
    const res = searchHerbs97ByName(query);
    const names = res.map((r) => r.name);
    // ต้องไม่มี ยาเหลืองปิดสมุทร หรือ ยาเขียวหอม
    expect(names).not.toContain("ยาเหลืองปิดสมุทร");
    expect(names).not.toContain("ยาเขียวหอม");
  });

  it("searchHerbs97BySymptom accurately finds lymphatic and dermatological medicines in 97 dataset", () => {
    const query = "คนไข้มีอาการน้ำเหลืองเสีย ผื่นคัน ตามผิวหนัง เรามียาอะไรบ้าง";
    const res = searchHerbs97BySymptom(query);
    const names = res.map((r) => r.name);

    // ยาหญ้าปักกิ่ง ต้องขึ้นเป็นอันดับแรก เพราะมีข้อบ่งใช้ตรงเป๊ะเรื่อง "แก้น้ำเหลืองเสีย"
    expect(names.length).toBeGreaterThan(0);
    expect(names[0]).toBe("ยาหญ้าปักกิ่ง");
    expect(res[0].indication).toContain("แก้น้ำเหลืองเสีย");

    // ต้องพบยารักษาโรคผิวหนัง/ผื่นคัน เช่น ยาพญายอ หรือ ยาทิงเจอร์ทองพันชั่ง
    expect(names.some((n) => n === "ยาพญายอ" || n === "ยาทิงเจอร์ทองพันชั่ง" || n === "ยาทิงเจอร์พลู")).toBe(true);

    // ต้องไม่มี ยาเหลืองปิดสมุทร (ยาแก้ท้องเสีย) หรือ ยาเขียวหอม (ยาแก้ไข้/หัด)
    expect(names).not.toContain("ยาเหลืองปิดสมุทร");
    expect(names).not.toContain("ยาเขียวหอม");
  });

  it("searchHerbs97BySymptom accurately finds digestive medicines for bloating queries and excludes skin/lymph drugs", () => {
    const query = "คนไข้มีอาการท้องอืด แน่นท้อง จุกเสียด มีแก๊สในกระเพาะ มียาอะไรบ้าง";
    const res = searchHerbs97BySymptom(query);
    const names = res.map((r) => r.name);

    expect(names.length).toBeGreaterThan(0);
    // ต้องมียาขับลม/แก้ท้องอืด เช่น ยาขมิ้นชัน, ยาประสะกานพลู, ยาธาตุอบเชย
    expect(names.some((n) => n.includes("ขมิ้นชัน") || n.includes("ประสะกานพลู") || n.includes("ธาตุอบเชย"))).toBe(true);

    // ต้องไม่มียาหญ้าปักกิ่ง หรือ ยาทิงเจอร์ทองพันชั่ง
    expect(names).not.toContain("ยาหญ้าปักกิ่ง");
    expect(names).not.toContain("ยาทิงเจอร์ทองพันชั่ง");
  });
});

