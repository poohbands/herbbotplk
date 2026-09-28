import { describe, it, expect } from "vitest";
import {
  OUT_OF_SCOPE_REFUSAL_MESSAGE,
  isBlatantlyOutOfScope,
  detectPureModernDrugQuery,
  formatPureModernDrugNotice,
  processLocalChat,
} from "../lib/local-chat-service";

describe("Out-of-scope refusal policy (หมอยาพิษณุโลก)", () => {
  describe("isBlatantlyOutOfScope helper", () => {
    it("identifies coding/programming questions as out of scope", () => {
      expect(isBlatantlyOutOfScope("เขียนโปรแกรม python คำนวณภาษีให้หน่อย")).toBe(true);
      expect(isBlatantlyOutOfScope("สอนเขียนโค้ด javascript หน่อยครับ")).toBe(true);
      expect(isBlatantlyOutOfScope("ช่วยแก้บั๊ก docker container ให้ที")).toBe(true);
    });

    it("identifies weather and sports questions as out of scope", () => {
      expect(isBlatantlyOutOfScope("พยากรณ์อากาศวันนี้เป็นอย่างไร ฝนตกไหม")).toBe(true);
      expect(isBlatantlyOutOfScope("ผลบอลพรีเมียร์ลีกเมื่อคืน ลิเวอร์พูล ชนะไหม")).toBe(true);
      expect(isBlatantlyOutOfScope("แมนยูแข่งกี่โมง")).toBe(true);
    });

    it("identifies politics, astrology, and casual chit-chat as out of scope", () => {
      expect(isBlatantlyOutOfScope("การเมืองไทยตอนนี้ใครเป็นนายกรัฐมนตรี")).toBe(true);
      expect(isBlatantlyOutOfScope("ดูดวงความรัก ทำนายดวงราศีเมษ")).toBe(true);
      expect(isBlatantlyOutOfScope("ตรวจหวยงวดนี้หน่อย เลขเด็ดงวดนี้มีอะไรบ้าง")).toBe(true);
      expect(isBlatantlyOutOfScope("ช่วยแต่งกลอนสุภาพให้หน่อย")).toBe(true);
    });

    it("keeps herbal and medical questions strictly in scope", () => {
      expect(isBlatantlyOutOfScope("ฟ้าทะลายโจรมีสรรพคุณอย่างไร")).toBe(false);
      expect(isBlatantlyOutOfScope("ขมิ้นชันกินร่วมกับ warfarin ได้ไหม")).toBe(false);
      expect(isBlatantlyOutOfScope("ยาพาราเซตามอลกินร่วมกับฟ้าทะลายโจรได้ไหม")).toBe(false);
      expect(isBlatantlyOutOfScope("ปวดท้อง จุกเสียด แน่นท้อง กินสมุนไพรอะไรดี")).toBe(false);
      expect(isBlatantlyOutOfScope("นอนไม่หลับ มีสมุนไพรช่วยไหม")).toBe(false);
      expect(isBlatantlyOutOfScope("ขนาดยาจันทน์ลีลา ผู้ใหญ่กินกี่เม็ด")).toBe(false);
      expect(isBlatantlyOutOfScope("ยาเบญจกูล มีข้อห้ามอะไรบ้าง")).toBe(false);
    });

    it("keeps questions about system sources, references, and verification strictly in scope", () => {
      expect(
        isBlatantlyOutOfScope(
          "ข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบันที่ระบบใช้ตอบ สามารถตรวจสอบจากแหล่งอ้างอิงใดได้บ้าง?"
        )
      ).toBe(false);
      expect(isBlatantlyOutOfScope("ระบบใช้แหล่งอ้างอิงอะไรบ้างในการตอบ")).toBe(false);
      expect(isBlatantlyOutOfScope("ข้อมูลในระบบมาจากไหน น่าเชื่อถือแค่ไหน")).toBe(false);
      expect(isBlatantlyOutOfScope("ฐานข้อมูลที่ระบบใช้มีอะไรบ้าง")).toBe(false);
    });

    it("keeps follow-up turns in scope when history mentions herbs or drugs", () => {
      const history = [
        { role: "user", content: "ฟ้าทะลายโจรช่วยลดไข้ได้ไหม" },
        { role: "assistant", content: "ฟ้าทะลายโจรช่วยบรรเทาอาการไข้หวัดได้ครับ" },
      ];
      // Even if question is short
      expect(isBlatantlyOutOfScope("แล้วต้องกินวันละกี่เม็ด", history)).toBe(false);
    });
  });

  describe("Polite refusal message content", () => {
    it("contains identity, clear polite refusal, and acceptable health scope", () => {
      expect(OUT_OF_SCOPE_REFUSAL_MESSAGE).toContain("ขออภัยด้วยครับ");
      expect(OUT_OF_SCOPE_REFUSAL_MESSAGE).toContain("หมอยาพิษณุโลก");
      expect(OUT_OF_SCOPE_REFUSAL_MESSAGE).toContain(
        "ไม่ได้เกี่ยวข้องกับทางด้านการแพทย์แผนไทย การแพทย์แผนปัจจุบัน หรือการดูแลสุขภาพ"
      );
      expect(OUT_OF_SCOPE_REFUSAL_MESSAGE).toContain("อยู่นอกเหนือขอบเขตที่ผมสามารถให้ข้อมูลได้ครับ");
      expect(OUT_OF_SCOPE_REFUSAL_MESSAGE).toContain("สมุนไพรและตำรับยาแผนไทย");
      expect(OUT_OF_SCOPE_REFUSAL_MESSAGE).toContain("ยาแผนปัจจุบันและอันตรกิริยา");
      expect(OUT_OF_SCOPE_REFUSAL_MESSAGE).toContain("การดูแลสุขภาพเบื้องต้น");
    });
  });

  describe("Pure Modern Drug Query Redirection (Option A)", () => {
    describe("detectPureModernDrugQuery helper", () => {
      it("detects pure modern drug inquiries without herbs or substitution", () => {
        expect(detectPureModernDrugQuery("Abilify").isPureModernDrug).toBe(true);
        expect(detectPureModernDrugQuery("abilify คือยาอะไร").isPureModernDrug).toBe(true);
        expect(detectPureModernDrugQuery("ยาอะบิลิฟาย").isPureModernDrug).toBe(true);
        expect(detectPureModernDrugQuery("omeprazole ควรกินตอนไหน").isPureModernDrug).toBe(true);
        expect(detectPureModernDrugQuery("ยา omeprazole มีผลข้างเคียงอะไร").isPureModernDrug).toBe(true);
        expect(detectPureModernDrugQuery("gabapentin มีผลข้างเคียงอะไร").isPureModernDrug).toBe(true);
        expect(detectPureModernDrugQuery("ยากาบาเพนติน").isPureModernDrug).toBe(true);
        expect(detectPureModernDrugQuery("pregabalin กินอย่างไร").isPureModernDrug).toBe(true);
      });

      it("does NOT classify queries containing herbs or herbal substitution as pure modern drug", () => {
        // DDI with herbs
        expect(detectPureModernDrugQuery("ขมิ้นชันกินร่วมกับ omeprazole ได้ไหม").isPureModernDrug).toBe(false);
        expect(detectPureModernDrugQuery("กินยา omeprazole ร่วมกับสมุนไพรได้ไหม").isPureModernDrug).toBe(false);
        expect(detectPureModernDrugQuery("abilify กินคู่กับฟ้าทะลายโจรได้ไหม").isPureModernDrug).toBe(false);
        expect(detectPureModernDrugQuery("gabapentin ตีกับกัญชาไหม").isPureModernDrug).toBe(false);

        // Substitution inquiries
        expect(detectPureModernDrugQuery("มียาสมุนไพรตัวไหนใช้แทน omeprazole ได้บ้าง").isPureModernDrug).toBe(false);
        expect(detectPureModernDrugQuery("สมุนไพรกินแทน omeprazole").isPureModernDrug).toBe(false);
        expect(detectPureModernDrugQuery("ยาอะไรแทน gabapentin").isPureModernDrug).toBe(false);

        // System/reference inquiries
        expect(
          detectPureModernDrugQuery(
            "ข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบันที่ระบบใช้ตอบ สามารถตรวจสอบจากแหล่งอ้างอิงใดได้บ้าง?"
          ).isPureModernDrug
        ).toBe(false);
      });
    });

    describe("formatPureModernDrugNotice content", () => {
      it("formats polite medical redirection without citing herbal CPG 2568", () => {
        const notice = formatPureModernDrugNotice("Abilify");
        expect(notice).toContain("หมอยาพิษณุโลก");
        expect(notice).toContain("Abilify");
        expect(notice).toContain("ปรึกษาแพทย์ผู้ให้การรักษา หรือเภสัชกร");
        expect(notice).toContain("อันตรกิริยาระหว่างยากับสมุนไพร");
        expect(notice).not.toContain("คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ");
      });
    });

    describe("processLocalChat Option A execution", () => {
      it("short-circuits Abilify query, returns Option A notice with 0 herbal citations", async () => {
        const result = await processLocalChat("Abilify");
        expect(result).toContain("หมอยาพิษณุโลก");
        expect(result).toContain("Abilify");
        expect(result).toContain("ปรึกษาแพทย์ผู้ให้การรักษา หรือเภสัชกร");
        expect(result).toContain('[SOURCES]{"internal":[],"pubmed":[],"thaijo":[],"knowledge":[]}[/SOURCES]');
        expect(result).not.toContain("คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ");
        expect(result).not.toContain("กรมการแพทย์. (2568)");
      });

      it("short-circuits omeprazole query, returns Option A notice without CPG 2568 citation", async () => {
        const result = await processLocalChat("omeprazole ควรกินตอนไหน");
        expect(result).toContain("หมอยาพิษณุโลก");
        expect(result).toContain("Omeprazole");
        expect(result).toContain("ปรึกษาแพทย์ผู้ให้การรักษา หรือเภสัชกร");
        expect(result).toContain('[SOURCES]{"internal":[],"pubmed":[],"thaijo":[],"knowledge":[]}[/SOURCES]');
        expect(result).not.toContain("คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ");
        expect(result).not.toContain("กรมการแพทย์. (2568)");
      });

      it("short-circuits gabapentin query, returns Option A notice without CPG 2568 citation", async () => {
        const result = await processLocalChat("gabapentin มีผลข้างเคียงอะไร");
        expect(result).toContain("หมอยาพิษณุโลก");
        expect(result).toContain("Gabapentin");
        expect(result).toContain("ปรึกษาแพทย์ผู้ให้การรักษา หรือเภสัชกร");
        expect(result).toContain('[SOURCES]{"internal":[],"pubmed":[],"thaijo":[],"knowledge":[]}[/SOURCES]');
        expect(result).not.toContain("คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ");
        expect(result).not.toContain("กรมการแพทย์. (2568)");
      });
    });
  });

  describe("processLocalChat short-circuit execution", () => {
    it("returns polite refusal without citations when out-of-scope question is received", async () => {
      let streamed = "";
      const result = await processLocalChat(
        "ช่วยเขียนโปรแกรม python ให้หน่อย",
        [],
        (chunk) => {
          streamed = chunk;
        }
      );

      // Must contain the polite message
      expect(result).toContain("หมอยาพิษณุโลก");
      expect(result).toContain("อยู่นอกเหนือขอบเขตที่ผมสามารถให้ข้อมูลได้ครับ");

      // Must have empty sources
      expect(result).toContain('[SOURCES]{"internal":[],"pubmed":[],"thaijo":[],"knowledge":[]}[/SOURCES]');

      // Must NOT have APA reference section
      expect(result).not.toContain("เอกสารอ้างอิง (APA 7th Edition)");
    });
  });
});
