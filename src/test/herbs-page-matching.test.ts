import { describe, it, expect } from "vitest";
import { HERBS_97_DATA } from "../lib/herbs97-service";

const safeDecode = (val: string | null | undefined): string => {
  if (!val) return "";
  try {
    let decoded = decodeURIComponent(val.trim());
    if (decoded.includes("%")) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch {}
    }
    return decoded.trim();
  } catch {
    return (val || "").trim();
  }
};

const cleanThai = (s: string): string =>
  s
    .toLowerCase()
    .replace(/^(ยา)?(น้ำมัน|สเปรย์|ทา|ขี้ผึ้ง)?(สารสกัด(จาก)?)?/, "")
    .replace(/[\s\-_,()\/\\:.\[\]]+/g, "")
    .trim();

const extractTokens = (s: string): string[] => {
  const lower = s.toLowerCase();
  const tokens: string[] = [];

  const ratios = lower.match(/\d+:\d+/g);
  if (ratios) tokens.push(...ratios);

  const words = lower
    .replace(/\d+:\d+/g, " ")
    .split(/[\s\-_,()\/\\:.\[\]]+/)
    .map((w) => cleanThai(w) || w)
    .filter((w) => w.length >= 2);

  tokens.push(...words);
  return Array.from(new Set(tokens.filter(Boolean)));
};

describe("HerbsPage URL Parameter & Modal Matching Logic", () => {
  describe("safeDecode", () => {
    it("decodes unencoded, single-encoded, and double-encoded strings", () => {
      expect(safeDecode("ยาหอมเทพจิตร")).toBe("ยาหอมเทพจิตร");
      expect(safeDecode(encodeURIComponent("ยาหอมเทพจิตร"))).toBe("ยาหอมเทพจิตร");
      expect(safeDecode(encodeURIComponent(encodeURIComponent("ยาหอมเทพจิตร")))).toBe("ยาหอมเทพจิตร");
    });
  });

  describe("cleanThai", () => {
    it("removes pharmaceutical prefixes cleanly", () => {
      expect(cleanThai("ยาหอมเทพจิตร")).toBe("หอมเทพจิตร");
      expect(cleanThai("ยาทาขมิ้นชันและกัญชา")).toBe("ขมิ้นชันและกัญชา");
      expect(cleanThai("ยาน้ำมันสารสกัดกัญชา 1:1")).toBe("กัญชา11");
      expect(cleanThai("ยาประสะกัญชา")).toBe("ประสะกัญชา");
    });
  });

  describe("extractTokens", () => {
    it("preserves ratios like 1:1 and 20:1 alongside cleaned keywords", () => {
      const tokens = extractTokens("ยาน้ำมันสารสกัดกัญชา (1:1)");
      expect(tokens).toContain("1:1");
      expect(tokens).toContain("กัญชา");
    });
  });

  describe("HERBS_97_DATA direct resolution", () => {
    it("resolves herb97-1 directly to ยาหอมเทพจิตร", () => {
      const targetId = "herb97-1";
      const item = HERBS_97_DATA.find((h) => h.id.toLowerCase() === targetId);
      expect(item).toBeDefined();
      expect(item?.name).toBe("ยาหอมเทพจิตร");
    });

    it("resolves cannabis medicine names and IDs", () => {
      const cannabisItem = HERBS_97_DATA.find((h) => h.name.includes("ขมิ้นชันและกัญชา"));
      expect(cannabisItem).toBeDefined();
      expect(cannabisItem?.has_cannabis).toBe(true);

      const item1to1 = HERBS_97_DATA.find((h) => h.name.includes("1:1"));
      expect(item1to1).toBeDefined();
      expect(item1to1?.has_cannabis).toBe(true);
    });
  });

  describe("Matching formulas by various query parameters", () => {
    const mockFormulas = HERBS_97_DATA.map((h) => ({
      id: h.id,
      herb97_id: h.id,
      name_thai: h.name,
      category: h.category,
    }));

    it("matches formula by herb97_id even if URL only has formula=herb97-1", () => {
      const formulaParam = "herb97-1";
      const direct97 = HERBS_97_DATA.find((h) => h.id.toLowerCase() === formulaParam.toLowerCase());
      expect(direct97).toBeDefined();

      const found = mockFormulas.find(
        (f) =>
          f.id.toLowerCase() === formulaParam.toLowerCase() ||
          f.herb97_id?.toLowerCase() === formulaParam.toLowerCase() ||
          (direct97 && f.name_thai === direct97.name)
      );
      expect(found).toBeDefined();
      expect(found?.name_thai).toBe("ยาหอมเทพจิตร");
    });

    it("matches cannabis oil by token keywords (THC, CBD, 1:1)", () => {
      const rawTarget = "ยาน้ำมันสารสกัดกัญชา (1:1)";
      const tokens = extractTokens(rawTarget);
      
      const found = mockFormulas.find((f) => {
        const normF = cleanThai(f.name_thai);
        const fName = f.name_thai.toLowerCase();
        return tokens.length >= 2 && tokens.every((t) => normF.includes(cleanThai(t)) || fName.includes(t.toLowerCase()));
      });
      expect(found).toBeDefined();
      expect(found?.name_thai).toContain("1:1");
    });

    it("matches 20:1 cannabis formulation correctly", () => {
      const rawTarget = "สารสกัดกัญชา CBD:THC 20:1";
      const tokens = extractTokens(rawTarget);

      const found = mockFormulas.find((f) => {
        const normF = cleanThai(f.name_thai);
        const fName = f.name_thai.toLowerCase();
        return tokens.length >= 2 && tokens.every((t) => normF.includes(cleanThai(t)) || fName.includes(t.toLowerCase()));
      });
      expect(found).toBeDefined();
      expect(found?.name_thai).toContain("20:1");
    });
  });
});
