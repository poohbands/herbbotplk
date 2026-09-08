import { describe, it, expect } from "vitest";
import {
  findRelevantThaiJo,
  normalizeThaiName,
  findRelevantMahidolDdi,
  extractQuestionEntities,
  validateAndPruneSources,
} from "../lib/local-chat-service";

describe("Reference and Citation Accuracy (Strict Relevance)", () => {
  describe("ThaiJO Catalog matching (findRelevantThaiJo)", () => {
    it("returns NO results for ยาจันทน์ลีลา (no ThaiJO entry - fake search URL removed) and NO ฟ้าทะลายโจร", () => {
      const question = "ยาจันทน์ลีลาใช้ลดไข้ได้ไหม ขนาดเท่าไร?";
      const matchedFormulas = [
        { id: "f1", name_thai: "ยาจันทน์ลีลา", indication: "แก้ไข้ ตัวร้อน ไข้เปลี่ยนฤดู" },
      ];
      const matchedHerbs: any[] = [];

      const thaijo = findRelevantThaiJo(question, matchedHerbs, matchedFormulas);

      // จันทน์ลีลา entry ถูกลบออกจาก catalog เพราะ URL เดิมเป็น Search URL ปลอม
      // พฤติกรรมที่ถูกต้อง: ไม่ควรพบ result ใดๆ สำหรับจันทน์ลีลา (ดีกว่าอ้างอิง URL ปลอม)
      expect(thaijo.length).toBe(0);

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

    it("does not pull unrelated herbs (พริก, ฟ้าทะลายโจร, รากย่านาง) when querying ขมิ้นชัน + warfarin + ข้อควรระวัง", () => {
      const question = "ผู้ป่วยที่รับประทาน warfarin อยู่ หากต้องการใช้ขมิ้นชันร่วมด้วย มีข้อมูลอันตรกิริยาระหว่างยาหรือข้อควรระวังอย่างไร";
      const q = question.toLowerCase();
      const nq = normalizeThaiName(question);

      const allHerbs = [
        { id: "curcuma", name_thai: "ขมิ้นชัน", properties: ["ขับลม", "รักษาแผลในกระเพาะ"] },
        { id: "chili", name_thai: "พริก", properties: ["บรรเทาอาการปวดกล้ามเนื้อและข้อ"] },
        { id: "andro", name_thai: "ฟ้าทะลายโจร", properties: ["แก้ไข้", "บรรเทาอาการหวัด"] },
        { id: "yanang", name_thai: "รากย่านาง", properties: ["แก้ไข้ กระทุ้งพิษ"] },
      ];

      const allFormulas = [
        { id: "f_curcuma", name_thai: "ยาขมิ้นชัน", ingredients: ["ผงเหง้าขมิ้นชัน"], indication: "ท้องอืด จุกเสียด" },
        { id: "f_andro", name_thai: "ยาฟ้าทะลายโจร (ชนิดผง)", ingredients: [], indication: "บรรเทาอาการหวัด ไข้ ปวดเมื่อย" },
        { id: "f_plai", name_thai: "ยาไพล สูตรตำรับที่ 1", ingredients: [], indication: "บรรเทาอาการปวดเมื่อยตามร่างกาย" },
      ];

      // Exact matching
      const exactMatchedHerbs = allHerbs.filter((h) => {
        if (!h.name_thai) return false;
        if (q.includes(h.name_thai.toLowerCase())) return true;
        const nn = normalizeThaiName(h.name_thai);
        return nn.length >= 3 && nq.includes(nn);
      });

      const exactMatchedFormulas = allFormulas.filter((f) => {
        if (!f.name_thai) return false;
        if (q.includes(f.name_thai.toLowerCase())) return true;
        const nn = normalizeThaiName(f.name_thai);
        return nn.length >= 3 && nq.includes(nn);
      });

      expect(exactMatchedHerbs.map((h) => h.name_thai)).toEqual(["ขมิ้นชัน"]);
      expect(exactMatchedFormulas.map((f) => f.name_thai)).toEqual(["ยาขมิ้นชัน"]);

      // Specific herb routing:
      let matchedHerbs: any[] = [];
      let matchedFormulas: any[] = [];
      if (exactMatchedHerbs.length > 0) {
        matchedHerbs = exactMatchedHerbs.slice(0, 4);
        matchedFormulas = allFormulas.filter((f) => {
          const fn = f.name_thai.toLowerCase();
          const nfn = normalizeThaiName(f.name_thai);
          const ingText = (f.ingredients || []).join(" ").toLowerCase();
          return exactMatchedHerbs.some((h) => {
            const hn = h.name_thai.toLowerCase();
            const nhn = normalizeThaiName(h.name_thai);
            return fn.includes(hn) || nfn.includes(nhn) || ingText.includes(hn);
          });
        }).slice(0, 3);
      }

      // Assert only ขมิ้นชัน and ยาขมิ้นชัน are matched
      expect(matchedHerbs.map((h) => h.name_thai)).toEqual(["ขมิ้นชัน"]);
      expect(matchedFormulas.map((f) => f.name_thai)).toEqual(["ยาขมิ้นชัน"]);

      // Assert unrelated herbs and formulas are completely absent
      expect(matchedHerbs.some((h) => h.name_thai === "พริก")).toBe(false);
      expect(matchedHerbs.some((h) => h.name_thai === "ฟ้าทะลายโจร")).toBe(false);
      expect(matchedHerbs.some((h) => h.name_thai === "รากย่านาง")).toBe(false);
      expect(matchedFormulas.some((f) => f.name_thai.includes("ไพล"))).toBe(false);
      expect(matchedFormulas.some((f) => f.name_thai.includes("ฟ้าทะลายโจร"))).toBe(false);
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

  describe("Mahidol Herb-Drug Interaction (DDI) Exact Matching & Citation Verification", () => {
    const mockMahidolDocs = [
      {
        id: "m1",
        title: "อันตรกิริยาระหว่าง กระชายดำ กับ Warfarin (ม.มหิดล)",
        category: "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)",
        content: "• สมุนไพร: กระชายดำ\n• ยาแผนปัจจุบัน: Warfarin\n• ความรุนแรง: มาก",
        source_url: "https://medplant.mahidol.ac.th/1",
      },
      {
        id: "m2",
        title: "อันตรกิริยาระหว่าง กระเทียม กับ Warfarin (ม.มหิดล)",
        category: "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)",
        content: "• สมุนไพร: กระเทียม\n• ยาแผนปัจจุบัน: Warfarin\n• ความรุนแรง: มาก",
        source_url: "https://medplant.mahidol.ac.th/2",
      },
      {
        id: "m3",
        title: "อันตรกิริยาระหว่าง กล้วย กับ Warfarin (ม.มหิดล)",
        category: "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)",
        content: "• สมุนไพร: กล้วย\n• ยาแผนปัจจุบัน: Warfarin\n• ความรุนแรง: น้อย",
        source_url: "https://medplant.mahidol.ac.th/3",
      },
      {
        id: "m4",
        title: "อันตรกิริยาระหว่าง โกจิเบอร์รี กับ Warfarin (ม.มหิดล)",
        category: "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)",
        content: "• สมุนไพร: โกจิเบอร์รี\n• ยาแผนปัจจุบัน: Warfarin\n• ความรุนแรง: มาก",
        source_url: "https://medplant.mahidol.ac.th/4",
      },
      {
        id: "m5",
        title: "อันตรกิริยาระหว่าง ขมิ้น กับ Warfarin (ม.มหิดล)",
        category: "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)",
        content: "• สมุนไพร: ขมิ้น\n• ยาแผนปัจจุบัน: Warfarin\n• ความรุนแรง: มาก\n• ผลของการเกิดอันตรกิริยา: เพิ่มระดับของยาในเลือด แต่ไม่ส่งผลต่ออัตราการแข็งตัวของเลือด",
        source_url: "https://medplant.mahidol.ac.th/5",
      },
      {
        id: "m6",
        title: "อันตรกิริยาระหว่าง ขิง กับ Warfarin (ม.มหิดล)",
        category: "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)",
        content: "• สมุนไพร: ขิง\n• ยาแผนปัจจุบัน: Warfarin\n• ความรุนแรง: มาก",
        source_url: "https://medplant.mahidol.ac.th/6",
      },
      {
        id: "m7",
        title: "อันตรกิริยาระหว่าง มะม่วง กับ Warfarin (ม.มหิดล)",
        category: "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)",
        content: "• สมุนไพร: มะม่วง\n• ยาแผนปัจจุบัน: Warfarin\n• ความรุนแรง: ปานกลาง",
        source_url: "https://medplant.mahidol.ac.th/7",
      },
      {
        id: "m8",
        title: "อันตรกิริยาระหว่าง ขมิ้น กับ Clopidogrel (ม.มหิดล)",
        category: "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)",
        content: "• สมุนไพร: ขมิ้น\n• ยาแผนปัจจุบัน: Clopidogrel\n• ความรุนแรง: มาก",
        source_url: "https://medplant.mahidol.ac.th/8",
      },
    ];

    it("extractQuestionEntities extracts ขมิ้น from ขมิ้นชัน and warfarin from Warfarin", () => {
      const q = "ขมิ้นชันกินร่วมกับยา Warfarin ได้ไหม?";
      const entities = extractQuestionEntities(q);
      expect(entities.herbs).toContain("ขมิ้น");
      expect(entities.drugs).toContain("warfarin");
      expect(entities.isDdiIntent).toBe(true);
    });

    it("extractQuestionEntities extracts entities from Thai drug name วาร์ฟาริน", () => {
      const q = "ทานยาวาร์ฟารินอยู่ ดื่มน้ำขิงได้ไหม";
      const entities = extractQuestionEntities(q);
      expect(entities.herbs).toContain("ขิง");
      expect(entities.drugs).toContain("warfarin");
    });

    it("findRelevantMahidolDdi returns ONLY ขมิ้น กับ Warfarin when user asks about ขมิ้นชัน + Warfarin", () => {
      const q = "ขมิ้นชันกินร่วมกับยา Warfarin ได้ไหม?";
      const results = findRelevantMahidolDdi(q, mockMahidolDocs);

      expect(results.length).toBe(1);
      expect(results[0].title).toBe("อันตรกิริยาระหว่าง ขมิ้น กับ Warfarin (ม.มหิดล)");

      // Must NOT contain any unrelated herbs
      expect(results.some((r) => r.title.includes("กระชายดำ"))).toBe(false);
      expect(results.some((r) => r.title.includes("กระเทียม"))).toBe(false);
      expect(results.some((r) => r.title.includes("กล้วย"))).toBe(false);
      expect(results.some((r) => r.title.includes("โกจิเบอร์รี"))).toBe(false);
      expect(results.some((r) => r.title.includes("ขิง"))).toBe(false);
      expect(results.some((r) => r.title.includes("มะม่วง"))).toBe(false);
      expect(results.some((r) => r.title.includes("Clopidogrel"))).toBe(false);
    });

    it("findRelevantMahidolDdi returns ONLY ขมิ้น กับ Warfarin for long detailed clinical question", () => {
      const q = "ผู้ป่วยที่รับประทาน warfarin อยู่ หากต้องการใช้ขมิ้นชันร่วมด้วย มีข้อมูลอันตรกิริยาระหว่างยาหรือข้อควรระวังอย่างไร";
      const results = findRelevantMahidolDdi(q, mockMahidolDocs);

      expect(results.length).toBe(1);
      expect(results[0].title).toBe("อันตรกิริยาระหว่าง ขมิ้น กับ Warfarin (ม.มหิดล)");
      expect(results.some((r) => r.title.includes("กล้วย"))).toBe(false);
      expect(results.some((r) => r.title.includes("มะม่วง"))).toBe(false);
    });

    it("findRelevantMahidolDdi returns all warfarin interactions when user asks generally about warfarin herbs", () => {
      const q = "คนกินยา Warfarin ห้ามกินสมุนไพรอะไรบ้าง";
      const results = findRelevantMahidolDdi(q, mockMahidolDocs);

      expect(results.length).toBeGreaterThan(1);
      // All returned documents must be for Warfarin
      results.forEach((r) => {
        expect(r.title).toContain("Warfarin");
      });
    });

    it("findRelevantMahidolDdi returns 0 results when question is not about DDI (e.g. fever reduction with chanleela)", () => {
      const q = "ยาจันทน์ลีลาใช้ลดไข้ได้ไหม";
      const results = findRelevantMahidolDdi(q, mockMahidolDocs);
      expect(results.length).toBe(0);
    });

    it("validateAndPruneSources strips unrelated herbs from sourcesPayload", () => {
      const question = "ขมิ้นชันกินร่วมกับยา Warfarin ได้ไหม?";
      const answer = "ขมิ้นชันอาจมีผลเพิ่มระดับยาวาร์ฟารินในเลือด ควรระมัดระวังในการใช้";
      const rawSources = {
        internal: [],
        pubmed: [],
        thaijo: [],
        knowledge: mockMahidolDocs, // contains all 8 docs
      };

      const pruned = validateAndPruneSources(question, answer, rawSources);

      // Must strictly contain ONLY the turmeric document
      expect(pruned.knowledge.length).toBe(1);
      expect(pruned.knowledge[0].title).toBe("อันตรกิริยาระหว่าง ขมิ้น กับ Warfarin (ม.มหิดล)");
      expect(pruned.knowledge.some((k) => k.title.includes("กระชายดำ"))).toBe(false);
      expect(pruned.knowledge.some((k) => k.title.includes("มะม่วง"))).toBe(false);
      expect(pruned.knowledge.some((k) => k.title.includes("กล้วย"))).toBe(false);
    });
  });
});
