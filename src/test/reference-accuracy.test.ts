import { describe, it, expect } from "vitest";
import { findRelevantThaiJo, normalizeThaiName } from "../lib/local-chat-service";

describe("Reference and Citation Accuracy (Strict Relevance)", () => {
  describe("ThaiJO Catalog matching (findRelevantThaiJo)", () => {
    it("returns ONLY ยาจันทน์ลีลา research and NO ฟ้าทะลายโจร when querying ยาจันทน์ลีลา for fever", () => {
      const question = "ยาจันทน์ลีลาใช้ลดไข้ได้ไหม ขนาดเท่าไร?";
      const matchedFormulas = [
        { id: "f1", name_thai: "ยาจันทน์ลีลา", indication: "แก้ไข้ ตัวร้อน ไข้เปลี่ยนฤดู" },
      ];
      const matchedHerbs: any[] = [];

      const thaijo = findRelevantThaiJo(question, matchedHerbs, matchedFormulas);

      // Must find ยาจันทน์ลีลา
      expect(thaijo.length).toBeGreaterThan(0);
      expect(thaijo.some((t) => t.title.includes("ยาจันทน์ลีลา") || t.title.includes("จันทน์ลีลา"))).toBe(true);

      // Must NOT contain ฟ้าทะลายโจร (article 257226) or แอนโดรกราโฟไลด์ (article 267030)
      expect(thaijo.some((t) => t.url.includes("257226"))).toBe(false);
      expect(thaijo.some((t) => t.title.includes("ฟ้าทะลายโจร"))).toBe(false);
      expect(thaijo.some((t) => t.url.includes("267030"))).toBe(false);
    });

    it("returns ONLY ขมิ้นชัน research when querying ขมิ้นชัน", () => {
      const question = "ขมิ้นชันกินร่วมกับ warfarin ได้ไหม?";
      const matchedHerbs = [
        { id: "h1", name_thai: "ขมิ้นชัน", properties: ["ขับลม", "รักษาแผลในกระเพาะ"] },
      ];
      const matchedFormulas: any[] = [];

      const thaijo = findRelevantThaiJo(question, matchedHerbs, matchedFormulas);

      expect(thaijo.length).toBeGreaterThan(0);
      expect(thaijo.some((t) => t.title.includes("ขมิ้นชัน"))).toBe(true);
      expect(thaijo.some((t) => t.title.includes("ฟ้าทะลายโจร"))).toBe(false);
      expect(thaijo.some((t) => t.title.includes("จันทน์ลีลา"))).toBe(false);
    });

    it("does not pull unrelated single herbs when query mentions only a specific formula", () => {
      // Simulate herb & formula matching logic
      const question = "ยาจันทน์ลีลาใช้ลดไข้ได้ไหม ขนาดเท่าไร?";
      const q = question.toLowerCase();
      const nq = normalizeThaiName(question);

      const allHerbs = [
        { id: "lemongrass", name_thai: "ตะไคร้", properties: ["ลดไข้", "ขับลม"] },
        { id: "ginger", name_thai: "ขิง", properties: ["บรรเทาอาการคลื่นไส้"] },
      ];

      const allFormulas = [
        { id: "chanleela", name_thai: "ยาจันทน์ลีลา", indication: "แก้ไข้ ตัวร้อน ไข้เปลี่ยนฤดู" },
      ];

      // Step 2.1: Exact formula matches
      const exactMatchedFormulas = allFormulas.filter((f) => {
        if (!f.name_thai) return false;
        if (q.includes(f.name_thai.toLowerCase())) return true;
        const nn = normalizeThaiName(f.name_thai);
        return nn.length >= 3 && nq.includes(nn);
      });

      // Step 2.2: Exact herb matches
      const exactMatchedHerbs = allHerbs.filter((h) => {
        if (!h.name_thai) return false;
        if (h.name_thai && q.includes(h.name_thai.toLowerCase())) return true;
        const nn = normalizeThaiName(h.name_thai || "");
        return nn.length >= 3 && nq.includes(nn);
      });

      expect(exactMatchedFormulas.map((f) => f.name_thai)).toEqual(["ยาจันทน์ลีลา"]);
      expect(exactMatchedHerbs).toEqual([]);

      // Routing logic:
      let matchedHerbs: any[] = [];
      let matchedFormulas: any[] = [];
      if (exactMatchedFormulas.length > 0) {
        matchedFormulas = exactMatchedFormulas.slice(0, 4);
        matchedHerbs = exactMatchedHerbs.slice(0, 4);
      }

      // Assert that ตะไคร้ is NOT in matchedHerbs
      expect(matchedHerbs.some((h) => h.name_thai === "ตะไคร้")).toBe(false);
      expect(matchedHerbs.length).toBe(0);

      // Assert that internalSources excludes single herbs
      let internalSources = [
        ...matchedHerbs.map((h) => ({ type: "herb", id: h.id, name: h.name_thai })),
        ...matchedFormulas.map((f) => ({ type: "formula", id: f.id, name: f.name_thai })),
      ];
      if (exactMatchedFormulas.length > 0 && exactMatchedHerbs.length === 0) {
        internalSources = internalSources.filter((s) => s.type === "formula");
      }

      expect(internalSources).toEqual([
        { type: "formula", id: "chanleela", name: "ยาจันทน์ลีลา" },
      ]);
      expect(internalSources.some((s) => s.name === "ตะไคร้")).toBe(false);
    });
  });

  describe("normalizeThaiName utility", () => {
    it("normalizes formula prefixes and special characters correctly", () => {
      expect(normalizeThaiName("ยาจันทน์ลีลา")).toBe("จันทนลีลา");
      expect(normalizeThaiName("ตำรับยาจันทน์ลีลา")).toBe("จันทนลีลา");
      expect(normalizeThaiName("จันทน์ลีลา")).toBe("จันทนลีลา");
      expect(normalizeThaiName("ฟ้าทะลายโจร")).toBe("ฟ้าทะลายโจร");
    });
  });
});
