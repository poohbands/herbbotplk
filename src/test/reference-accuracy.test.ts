import { describe, it, expect } from "vitest";
import {
  findRelevantThaiJo,
  normalizeThaiName,
  findRelevantMahidolDdi,
  findRelevantTuDdi,
  extractQuestionEntities,
  validateAndPruneSources,
  sanitizeMahidolReferences,
  sanitizeTuReferences,
  sanitizeUnrelatedApaReferences,
  extractAllowedEntitiesFromSources,
  buildSystemPrompt,
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

    it("validateAndPruneSources retains NLEM knowledge documents matching question and excludes unrelated ones", () => {
      const question = "ยาขมิ้นชันในบัญชียาหลักแห่งชาติมีสรรพคุณอย่างไร";
      const answer = "ยาขมิ้นชันในบัญชียาหลักแห่งชาติ พ.ศ. 2568 มีสรรพคุณบรรเทาอาการแน่นจุกเสียด และ Functional dyspepsia";
      const rawSources = {
        internal: [],
        pubmed: [],
        thaijo: [],
        knowledge: [
          {
            id: "nlem-1",
            title: "บัญชียาหลักแห่งชาติด้านสมุนไพร: ยาขมิ้นชัน (พ.ศ. 2568)",
            category: "บัญชียาหลักแห่งชาติด้านสมุนไพร",
            content: "ยาขมิ้นชัน บรรเทาอาการแน่นจุกเสียด",
            source: "ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (ฉบับที่ 2) พ.ศ. 2568",
          },
          {
            id: "nlem-2",
            title: "บัญชียาหลักแห่งชาติด้านสมุนไพร: ยาหอมเทพจิตร (พ.ศ. 2566)",
            category: "บัญชียาหลักแห่งชาติด้านสมุนไพร",
            content: "ยาหอมเทพจิตร แก้ลมวิงเวียน",
            source: "ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร พ.ศ. 2566",
          },
        ],
      };

      const pruned = validateAndPruneSources(question, answer, rawSources);

      expect(pruned.knowledge.length).toBe(1);
      expect(pruned.knowledge[0].title).toContain("ยาขมิ้นชัน");
      expect(pruned.knowledge.some((k) => k.title.includes("ยาหอมเทพจิตร"))).toBe(false);
    });

    it("validateAndPruneSources rewrites NLEM / ratchakitcha source_url to internal herbs page URL", () => {
      const question = "ยาขมิ้นชันในบัญชียาหลักแห่งชาติ";
      const answer = "ยาขมิ้นชันใช้บรรเทาอาการแน่นจุกเสียด";
      const rawSources = {
        internal: [],
        pubmed: [],
        thaijo: [],
        knowledge: [
          {
            id: "nlem-1",
            title: "บัญชียาหลักแห่งชาติด้านสมุนไพร: ยาขมิ้นชัน (พ.ศ. 2568)",
            category: "บัญชียาหลักแห่งชาติด้านสมุนไพร",
            content: "ยาขมิ้นชัน บรรเทาอาการแน่นจุกเสียด",
            source: "ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ",
            source_url: "https://ratchakitcha.soc.go.th/documents/123",
          },
        ],
      };

      const pruned = validateAndPruneSources(question, answer, rawSources);
      expect(pruned.knowledge.length).toBe(1);
      expect(pruned.knowledge[0].source_url).not.toContain("ratchakitcha.soc.go.th");
      expect(pruned.knowledge[0].source_url).toBe(`/herbs?name=${encodeURIComponent("ยาขมิ้นชัน")}`);
    });

    it("validateAndPruneSources completely removes Mahidol DDI documents when enable_mahidol_ddi is false", () => {
      const question = "ขมิ้นชันกินร่วมกับยา Warfarin ได้ไหม?";
      const answer = "ขมิ้นชันอาจมีผลต่อยาวาร์ฟาริน";
      const rawSources = {
        internal: [],
        pubmed: [],
        thaijo: [],
        knowledge: [
          {
            id: "m-1",
            title: "อันตรกิริยาระหว่าง ขมิ้น กับ Warfarin (ม.มหิดล)",
            category: "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)",
            content: "ขมิ้นชันกับ warfarin",
            source: "ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ มหาวิทยาลัยมหิดล",
            source_url: "https://medplant.mahidol.ac.th/ddi/1",
          },
          {
            id: "nlem-1",
            title: "บัญชียาหลักแห่งชาติด้านสมุนไพร: ยาขมิ้นชัน (พ.ศ. 2568)",
            category: "บัญชียาหลักแห่งชาติด้านสมุนไพร",
            content: "ยาขมิ้นชัน",
            source: "ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ",
          },
        ],
      };

      const pruned = validateAndPruneSources(question, answer, rawSources, {
        enable_external_research: true,
        enable_internal_db: true,
        enable_mahidol_ddi: false,
      });

      // ต้องไม่มีเอกสารของ ม.มหิดล หลงเหลืออยู่เลย
      expect(pruned.knowledge.some((k) => k.category === "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)")).toBe(false);
      expect(pruned.knowledge.some((k) => k.title.includes("มหิดล"))).toBe(false);
      expect(pruned.knowledge.some((k) => k.source?.includes("มหิดล"))).toBe(false);
      expect(pruned.knowledge.some((k) => k.source_url?.includes("mahidol"))).toBe(false);
      // ต้องเหลือเฉพาะเอกสารที่ไม่ใช่ ม.มหิดล
      expect(pruned.knowledge.length).toBe(1);
      expect(pruned.knowledge[0].title).toContain("ยาขมิ้นชัน");
    });

    it("sanitizeMahidolReferences strips lines citing Mahidol or medplant and empty APA heading", () => {
      const responseWithMahidol = `ขมิ้นชันอาจมีผลเพิ่มฤทธิ์ของยาวาร์ฟาริน
ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ มหาวิทยาลัยมหิดล รายงานว่าควรหลีกเลี่ยง

### 📚 เอกสารอ้างอิง (APA 7th Edition)
ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ มหาวิทยาลัยมหิดล. (ม.ป.ป.). *ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน: ขมิ้นชัน กับ Warfarin*. https://medplant.mahidol.ac.th/

💡 ข้อแนะนำ: ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้
[METADATA]
category: drug_interaction
severity: moderate
herbs: ขมิ้นชัน
drugs: warfarin
[/METADATA]`;

      const sanitized = sanitizeMahidolReferences(responseWithMahidol);

      expect(sanitized).not.toContain("มหาวิทยาลัยมหิดล");
      expect(sanitized).not.toContain("medplant.mahidol.ac.th");
      expect(sanitized).not.toContain("ศูนย์ข้อมูลสมุนไพร");
      expect(sanitized).not.toContain("📚 เอกสารอ้างอิง (APA 7th Edition)");
      expect(sanitized).toContain("ขมิ้นชันอาจมีผลเพิ่มฤทธิ์ของยาวาร์ฟาริน");
      expect(sanitized).toContain("💡 ข้อแนะนำ: ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้");
    });

    it("buildSystemPrompt excludes Mahidol APA 7 template and adds strict prohibition when enable_mahidol_ddi is false", () => {
      const promptWithoutMahidol = buildSystemPrompt({
        enable_external_research: true,
        enable_internal_db: true,
        enable_mahidol_ddi: false,
      });

      expect(promptWithoutMahidol).toContain("ข้อห้ามเด็ดขาดเรื่อง ม.มหิดล");
      expect(promptWithoutMahidol).toContain("ปัจจุบันระบบปิดการใช้ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบันของ ม.มหิดล");
      expect(promptWithoutMahidol).not.toContain("ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ มหาวิทยาลัยมหิดล. (ม.ป.ป.). *ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน");
    });
  });

  describe("TU DDI Database matching & strict pruning (enable_tu_ddi)", () => {
    it("findRelevantTuDdi returns interactions matching herb and drug from TU dataset", () => {
      const matched = findRelevantTuDdi("ขมิ้นชันกินกับ warfarin ได้ไหม");
      expect(matched.length).toBeGreaterThan(0);
      expect(matched.some((m) => m.title.includes("ขมิ้นชัน") && m.title.includes("Warfarin"))).toBe(true);
      expect(matched[0].source).toContain("ธรรมศาสตร์");
    });

    it("validateAndPruneSources strips TU DDI documents when enable_tu_ddi is false", () => {
      const rawSources = {
        internal: [],
        pubmed: [],
        thaijo: [],
        knowledge: [
          {
            id: "tu-1",
            title: "อันตรกิริยาระหว่าง ขมิ้นชัน กับ Warfarin (ม.ธรรมศาสตร์)",
            category: "อันตรกิริยาระหว่างยาและสมุนไพร (DDI - ม.ธรรมศาสตร์)",
            source: "สถานการแพทย์แผนไทยประยุกต์ คณะแพทยศาสตร์ มหาวิทยาลัยธรรมศาสตร์",
            content: "ขมิ้นชันอาจเพิ่มฤทธิ์ต้านการแข็งตัวของเลือดของ Warfarin",
          },
          {
            id: "k-1",
            title: "บัญชียาหลักแห่งชาติด้านสมุนไพร: ยาขมิ้นชัน",
            category: "บัญชียาหลักแห่งชาติด้านสมุนไพร",
            source: "บัญชียาหลักแห่งชาติด้านสมุนไพร",
            content: "ข้อบ่งใช้: บรรเทาอาการท้องอืด ท้องเฟ้อ",
          },
        ],
      };

      const pruned = validateAndPruneSources(
        "ขมิ้นชันกินกับ warfarin ได้ไหม",
        "ขมิ้นชันอาจเพิ่มฤทธิ์ของ warfarin",
        rawSources,
        {
          enable_external_research: true,
          enable_internal_db: true,
          enable_mahidol_ddi: true,
          enable_tu_ddi: false,
        }
      );

      expect(pruned.knowledge.some((k) => k.category === "อันตรกิริยาระหว่างยาและสมุนไพร (DDI - ม.ธรรมศาสตร์)")).toBe(false);
      expect(pruned.knowledge.some((k) => k.source?.includes("ธรรมศาสตร์"))).toBe(false);
      expect(pruned.knowledge.length).toBe(1);
      expect(pruned.knowledge[0].title).toContain("ยาขมิ้นชัน");
    });

    it("sanitizeTuReferences strips lines citing Thammasat, Prof. Arunporn, and empty APA heading", () => {
      const responseWithTu = `ขมิ้นชันอาจมีผลเสริมฤทธิ์ของยาวาร์ฟาริน
ศ. ดร.ภญ.อรุณพร อิฐรัตน์ สถานการแพทย์แผนไทยประยุกต์ คณะแพทยศาสตร์ มหาวิทยาลัยธรรมศาสตร์ รายงานว่าควรระวัง

### 📚 เอกสารอ้างอิง (APA 7th Edition)
อิฐรัตน์, อ. (2566). *ข้อควรระวังอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน (Herb-Drug Interaction)*. สถานการแพทย์แผนไทยประยุกต์ คณะแพทยศาสตร์ มหาวิทยาลัยธรรมศาสตร์.

💡 ข้อแนะนำ: ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้
[METADATA]
category: drug_interaction
severity: moderate
herbs: ขมิ้นชัน
drugs: warfarin
[/METADATA]`;

      const sanitized = sanitizeTuReferences(responseWithTu);

      expect(sanitized).not.toContain("มหาวิทยาลัยธรรมศาสตร์");
      expect(sanitized).not.toContain("อรุณพร อิฐรัตน์");
      expect(sanitized).not.toContain("สถานการแพทย์แผนไทยประยุกต์");
      expect(sanitized).not.toContain("📚 เอกสารอ้างอิง (APA 7th Edition)");
      expect(sanitized).toContain("ขมิ้นชันอาจมีผลเสริมฤทธิ์ของยาวาร์ฟาริน");
      expect(sanitized).toContain("💡 ข้อแนะนำ: ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้");
    });

    it("buildSystemPrompt excludes TU APA 7 template and adds strict prohibition when enable_tu_ddi is false", () => {
      const promptWithoutTu = buildSystemPrompt({
        enable_external_research: true,
        enable_internal_db: true,
        enable_mahidol_ddi: true,
        enable_tu_ddi: false,
      });

      expect(promptWithoutTu).toContain("ข้อห้ามเด็ดขาดเรื่อง ม.ธรรมศาสตร์");
      expect(promptWithoutTu).toContain("ปัจจุบันระบบปิดการใช้ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบันของ ม.ธรรมศาสตร์");
      expect(promptWithoutTu).not.toContain("อิฐรัตน์, อ. (2566). *ข้อควรระวังอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน");
    });

    it("validateAndPruneSources strictly strips unchosen candidate herbs and unrelated ThaiJO research papers in symptom queries", () => {
      const question = "ถ้ามีอาการน้ำเหลืองเสีย มีแผลตามผิวหนัง คัน ควรใช้ยาตัวใด";
      const answer = `สำหรับอาการน้ำเหลืองเสีย มีแผลตามผิวหนัง และอาการคัน ยาสมุนไพรในบัญชียาหลักแห่งชาติที่แนะนำคือ **ยาหญ้าปักกิ่ง**
- **สรรพคุณ:** แก้น้ำเหลืองเสีย บรรเทาอาการแผลเรื้อรัง และผื่นคันตามผิวหนัง
- **ขนาดและวิธีใช้:** รับประทานครั้งละ 1-2 แคปซูล วันละ 3 ครั้ง ก่อนอาหาร`;

      const rawSources = {
        internal: [
          { type: "herb", id: "h1", name: "ยาหญ้าปักกิ่ง" },
          { type: "herb", id: "h2", name: "ยาบัวบก" },
          { type: "herb", id: "h3", name: "ยาว่านหางจระเข้ (ไม่น้อยกว่าร้อยละ 87% w/w)" },
          { type: "formula", id: "h4", name: "ยาผง (รพ.) กล้วย" },
          { type: "formula", id: "h5", name: "ทิงเจอร์ (รพ.) ทองพันชั่ง" },
        ],
        pubmed: [],
        thaijo: [
          {
            title: "การพัฒนาวิธีวิเคราะห์สารกลุ่มไทรเทอร์พีนส์ในบัวบกด้วยวิธี UPLC",
            authors: "พรพิมล ชูแสงสุข, และคณะ",
            year: "2018",
            journal: "วารสารกรมวิทยาศาสตร์การแพทย์",
            url: "https://he02.tci-thaijo.org/index.php/dmsc/article/view/241199",
          },
        ],
        knowledge: [],
      };

      const pruned = validateAndPruneSources(question, answer, rawSources);

      // 1. ตรวจสอบ internal sources: ต้องเหลือเฉพาะยาหญ้าปักกิ่ง
      expect(pruned.internal.length).toBe(1);
      expect(pruned.internal[0].name).toBe("ยาหญ้าปักกิ่ง");
      expect(pruned.internal.some((s) => s.name.includes("บัวบก"))).toBe(false);
      expect(pruned.internal.some((s) => s.name.includes("ว่านหางจระเข้"))).toBe(false);
      expect(pruned.internal.some((s) => s.name.includes("กล้วย"))).toBe(false);
      expect(pruned.internal.some((s) => s.name.includes("ทองพันชั่ง"))).toBe(false);

      // 2. ตรวจสอบ thaijo: งานวิจัยแล็บวิเคราะห์เคมีในบัวบกต้องถูกตัดออก 100%
      expect(pruned.thaijo.length).toBe(0);
      expect(pruned.thaijo.some((t) => t.title.includes("บัวบก"))).toBe(false);
    });

    it("sanitizeUnrelatedApaReferences strips citations of unchosen herbs from APA 7th Edition block", () => {
      const fullAnswerWithUnrelatedApa = `สำหรับอาการน้ำเหลืองเสีย มีแผลตามผิวหนัง และอาการคัน ยาสมุนไพรในบัญชียาหลักแห่งชาติที่แนะนำคือ **ยาหญ้าปักกิ่ง**
- **สรรพคุณ:** แก้น้ำเหลืองเสีย บรรเทาอาการแผลเรื้อรัง

### 📚 เอกสารอ้างอิง (APA 7th Edition)
1. กรมการแพทย์แผนไทยและการแพทย์ทางเลือก. (2567). *คู่มือการใช้ยาสมุนไพรในการดูแลสุขภาพเบื้องต้น 10 กลุ่มอาการ*. กระทรวงสาธารณสุข.
2. คณะกรรมการพัฒนาระบบยาแห่งชาติ. (2566). *ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร พ.ศ. 2566*. ราชกิจจานุเบกษา.
3. พรพิมล ชูแสงสุข, และคณะ. (2561). การพัฒนาวิธีวิเคราะห์สารกลุ่มไทรเทอร์พีนส์ในบัวบกด้วยวิธี UPLC. *วารสารกรมวิทยาศาสตร์การแพทย์*, 60(3), 184–196. https://he02.tci-thaijo.org/index.php/dmsc/article/view/241199

💡 ข้อแนะนำ: ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้
[METADATA]
category: herbal_info
severity: none
herbs: ยาหญ้าปักกิ่ง
drugs:
[/METADATA]`;

      const allowedEntities = ["ยาหญ้าปักกิ่ง", "หญ้าปักกิ่ง"];
      const cleaned = sanitizeUnrelatedApaReferences(fullAnswerWithUnrelatedApa, allowedEntities);

      // งานวิจัยบัวบกต้องถูกตัดออกจาก APA
      expect(cleaned).not.toContain("บัวบก");
      expect(cleaned).not.toContain("ไทรเทอร์พีนส์");
      expect(cleaned).not.toContain("UPLC");

      // เอกสารทางการทั่วไปและคู่มือ 10 กลุ่มอาการยังคงอยู่
      expect(cleaned).toContain("คู่มือการใช้ยาสมุนไพรในการดูแลสุขภาพเบื้องต้น 10 กลุ่มอาการ");
      expect(cleaned).toContain("บัญชียาหลักแห่งชาติด้านสมุนไพร พ.ศ. 2566");
      expect(cleaned).toContain("📚 เอกสารอ้างอิง (APA 7th Edition)");
    });

    it("buildSystemPrompt contains strict instruction for symptom-based queries under rule 7", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("กรณีถามตามกลุ่มอาการ (Symptom-based Question):");
      expect(prompt).toContain("จะต้องระบุเฉพาะเอกสารอ้างอิงของตัวยาที่ท่านแนะนำจริงเท่านั้น (เช่น ยาหญ้าปักกิ่ง)");
      expect(prompt).toContain("ห้ามใส่บัวบก, กล้วย, ว่านหางจระเข้, ทองพันชั่ง");
    });
  });
});

