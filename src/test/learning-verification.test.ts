import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  recordUserFeedback,
  getFeedbackForMessage,
  getLearningQueue,
  addToLearningQueue,
  approveAndLearnKnowledge,
  rejectLearningItem,
  findVerifiedAnswer,
} from "../lib/learning-verification-service";

describe("AI Learning & Knowledge Verification Service", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("records user helpful/unhelpful feedback and syncs to learning queue", () => {
    const fb = recordUserFeedback(
      "msg-1",
      "ขมิ้นชันกินร่วมกับ warfarin ได้ไหม",
      "ขมิ้นชันอาจเพิ่มฤทธิ์ต้านการแข็งตัวของเลือด ควรระวัง",
      "helpful"
    );

    expect(fb.feedback).toBe("helpful");
    const retrieved = getFeedbackForMessage("msg-1");
    expect(retrieved).toBeDefined();
    expect(retrieved?.feedback).toBe("helpful");

    const queue = getLearningQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].question).toBe("ขมิ้นชันกินร่วมกับ warfarin ได้ไหม");
    expect(queue[0].userFeedback).toBe("helpful");
    expect(queue[0].status).toBe("pending");
  });

  it("allows admin to add questions directly to learning queue", () => {
    const item = addToLearningQueue(
      "ยาศุขไสยาศน์ มีข้อบ่งใช้อย่างไร",
      "ช่วยให้นอนหลับ เจริญอาหาร ต้องสั่งจ่ายโดยแพทย์แผนไทย",
      { category: "cannabis" }
    );

    expect(item.status).toBe("pending");
    const queue = getLearningQueue();
    expect(queue.some((q) => q.question.includes("ยาศุขไสยาศน์"))).toBe(true);
  });

  it("approves and verifies knowledge, making it available for future queries", async () => {
    const item = addToLearningQueue(
      "น้ำมันกัญชา 1:1 มีอัตราส่วนอย่างไร",
      "มีอัตราส่วน THC:CBD เท่ากับ 1 ต่อ 1"
    );

    const verifiedAnswer = "ตำรับยาน้ำมันสารสกัดกัญชา 1:1 มี THC และ CBD ในอัตราส่วน 1:1 บรรเทาอาการปวดเรื้อรังและอาการนอนไม่หลับในผู้ป่วยประคับประคอง";
    const res = await approveAndLearnKnowledge({
      ...item,
      verifiedAnswer,
      references: "ประกาศบัญชียาสมุนไพรทางการแพทย์ 2568",
    });

    expect(res.success).toBe(true);

    const queue = getLearningQueue();
    const verified = queue.find((q) => q.id === item.id);
    expect(verified?.status).toBe("verified");
    expect(verified?.verifiedAnswer).toBe(verifiedAnswer);

    // Test findVerifiedAnswer
    const match = findVerifiedAnswer("น้ำมันกัญชา 1:1 มีอัตราส่วนอย่างไร");
    expect(match.found).toBe(true);
    expect(match.verifiedAnswer).toBe(verifiedAnswer);
  });

  it("can reject an inaccurate item in learning queue", () => {
    const item = addToLearningQueue(
      "คำถามทดสอบ",
      "คำตอบที่ไม่ถูกต้อง"
    );

    rejectLearningItem(item.id, "ข้อมูลไม่ถูกต้องตามหลักวิชาการ");
    const queue = getLearningQueue();
    const target = queue.find((q) => q.id === item.id);
    expect(target?.status).toBe("rejected");
    expect(target?.feedbackComment).toBe("ข้อมูลไม่ถูกต้องตามหลักวิชาการ");
  });

  it("returns builtin verified cough remedies answer without hallucination or 'ตามคำแนะนำ'", () => {
    const match = findVerifiedAnswer("ถ้าผู้ป่วยมีอาการไอ มีสมุนไพรหรือตำรับยาอะไรบ้างที่สามารถใช้ได้ และแต่ละรายการใช้อย่างไร?");
    expect(match.found).toBe(true);
    expect(match.verifiedAnswer).toContain("ยาแก้ไอผสมมะขามป้อม");
    expect(match.verifiedAnswer).toContain("ยาประสะมะแว้ง");
    expect(match.verifiedAnswer).toContain("ยาอำมฤควาที");
    expect(match.verifiedAnswer).toContain("ยาตรีผลา");
    expect(match.verifiedAnswer).not.toContain("ตามคำแนะนำ");
    expect(match.verifiedAnswer).toContain("ไม่พบข้อมูลขนาดและวิธีใช้ที่ชัดเจนในฐานความรู้ที่ใช้อ้างอิง");
    expect(match.verifiedAnswer).not.toContain("Clopidogrel");
    expect(match.verifiedAnswer).not.toContain("clopidogrel");
    expect(match.verifiedAnswer).not.toContain("โรคหัวใจหรือไต");
    expect(match.verifiedAnswer).not.toContain("ยาทิพโอสถ");
    expect(match.verifiedAnswer).not.toContain("ผ่านการตรวจทานความถูกต้องโดยกลุ่มงานการแพทย์แผนไทยแล้ว");
  });

  it("returns builtin verified ยาห้าราก answer with antipyretic indication and without gastrointestinal hallucination or CPG 2568 citation", () => {
    // 1. Direct match
    const match = findVerifiedAnswer("ยาห้ารากใช้ในกรณีใด และมีวิธีใช้อย่างไร?");
    expect(match.found).toBe(true);
    expect(match.verifiedAnswer).toBeDefined();

    // Clinical indication: Antipyretic (บรรเทาอาการไข้ กระทุ้งพิษไข้)
    expect(match.verifiedAnswer).toContain("บรรเทาอาการไข้");
    expect(match.verifiedAnswer).toContain("กระทุ้งพิษไข้");

    // Zero-hallucination: Must NOT claim gastrointestinal / bloating
    expect(match.verifiedAnswer).not.toContain("ท้องอืด");
    expect(match.verifiedAnswer).not.toContain("ท้องเฟ้อ");
    expect(match.verifiedAnswer).not.toContain("แน่นจุกเสียด");
    expect(match.verifiedAnswer).not.toContain("บำรุงธาตุ");

    // Formula ingredients
    expect(match.verifiedAnswer).toContain("รากย่านาง");
    expect(match.verifiedAnswer).toContain("รากคนทา");
    expect(match.verifiedAnswer).toContain("รากมะเดื่อชุมพร");
    expect(match.verifiedAnswer).toContain("รากชิงชี่");
    expect(match.verifiedAnswer).toContain("รากไม้เท้ายายม่อม");

    // Citations: Must cite NLEM 2568, NOT CPG 2568
    expect(match.verifiedAnswer).toContain("คณะกรรมการพัฒนาระบบยาแห่งชาติ. (2568)");
    expect(match.verifiedAnswer).not.toContain("กรมการแพทย์. (2568). คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ");

    // 2. Word bullet point character normalization (\uF0B7)
    const bulletMatch = findVerifiedAnswer("  ยาห้ารากใช้ในกรณีใด และมีวิธีใช้อย่างไร?");
    expect(bulletMatch.found).toBe(true);
    expect(bulletMatch.verifiedAnswer).toBe(match.verifiedAnswer);
  });

  it("accurately returns Question 19 source inquiry for ฟ้าทะลายโจร without falling into Question 10 clinical contraindications", () => {
    // 1. Direct benchmark question 19
    const matchQ19 = findVerifiedAnswer("ข้อมูลเรื่องข้อห้ามใช้และข้อควรระวังของฟ้าทะลายโจรที่ระบบตอบ อ้างอิงมาจากแหล่งข้อมูลใด?");
    expect(matchQ19.found).toBe(true);
    expect(matchQ19.item?.id).toBe("verified-qa-19-system-sources-andrographis");
    expect(matchQ19.verifiedAnswer).toBeDefined();

    // Must focus on the 3 primary data sources, NOT clinical contraindications list
    expect(matchQ19.verifiedAnswer).toContain("แหล่งข้อมูลมาตรฐานทางวิชาการและการแพทย์ 3 แหล่งหลัก");
    expect(matchQ19.verifiedAnswer).toContain("ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร");
    expect(matchQ19.verifiedAnswer).toContain("คู่มือการใช้ยาสมุนไพรในการดูแลสุขภาพเบื้องต้น 10 กลุ่มอาการ");
    expect(matchQ19.verifiedAnswer).toContain("ฐานข้อมูลสมุนไพรและตำรับยาไทย สสจ.พิษณุโลก");
    expect(matchQ19.verifiedAnswer).toContain("การตรวจสอบย้อนกลับ");
    expect(matchQ19.verifiedAnswer).toContain("เอกสารวิชาการ");

    // Must NOT start with Question 10's clinical header
    expect(matchQ19.verifiedAnswer).not.toContain("ขอสรุปประเด็นความปลอดภัยที่สำคัญสูงสุดดังนี้ครับ");
    expect(matchQ19.verifiedAnswer).not.toContain("## 🚫 ข้อห้ามใช้เด็ดขาด (Contraindications)\n1. **ห้ามใช้ในผู้ที่เคยแพ้ฟ้าทะลายโจร**");

    // 2. Conversational prefix variation: "ถามคำถามว่า  ข้อมูลเรื่องข้อห้ามใช้..."
    const matchPrefix = findVerifiedAnswer("ถามคำถามว่า  ข้อมูลเรื่องข้อห้ามใช้และข้อควรระวังของฟ้าทะลายโจรที่ระบบตอบ อ้างอิงมาจากแหล่งข้อมูลใด?");
    expect(matchPrefix.found).toBe(true);
    expect(matchPrefix.item?.id).toBe("verified-qa-19-system-sources-andrographis");
    expect(matchPrefix.verifiedAnswer).toBe(matchQ19.verifiedAnswer);

    // 3. Variant asking about sources of precautions
    const matchVariant = findVerifiedAnswer("ข้อห้ามใช้และข้อควรระวังของฟ้าทะลายโจร อ้างอิงมาจากแหล่งข้อมูลใด");
    expect(matchVariant.found).toBe(true);
    expect(matchVariant.item?.id).toBe("verified-qa-19-system-sources-andrographis");

    // 4. In contrast, Question 10 asking about clinical cautions MUST return Question 10
    const matchQ10 = findVerifiedAnswer("ฟ้าทะลายโจรมีข้อห้ามใช้หรือข้อควรระวังที่สำคัญอะไรบ้าง?");
    expect(matchQ10.found).toBe(true);
    expect(matchQ10.item?.id).toBe("verified-qa-10-andrographis-cautions");
    expect(matchQ10.verifiedAnswer).toContain("ข้อห้ามใช้เด็ดขาด (Contraindications)");
    expect(matchQ10.verifiedAnswer).not.toContain("แหล่งข้อมูลมาตรฐานทางวิชาการและการแพทย์ 3 แหล่งหลัก");
  });

  it("accurately returns Question 20 source inquiry for DDI without intercepting clinical DDI items", () => {
    // 1. Direct benchmark question 20
    const matchQ20 = findVerifiedAnswer("ข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบันที่ระบบใช้ตอบ สามารถตรวจสอบจากแหล่งอ้างอิงใดได้บ้าง?");
    expect(matchQ20.found).toBe(true);
    expect(matchQ20.item?.id).toBe("verified-qa-20-system-sources-ddi");
    expect(matchQ20.verifiedAnswer).toContain("คู่มือการใช้ยาสมุนไพรในเวชปฏิบัติ กรมการแพทย์ (พ.ศ. 2568)");
    expect(matchQ20.verifiedAnswer).toContain("ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร");
    expect(matchQ20.verifiedAnswer).toContain("แนวทางการใช้ยาสมุนไพรในบัญชียาหลักแห่งชาติทดแทนยาแผนปัจจุบัน 32 รายการ");
    expect(matchQ20.verifiedAnswer).toContain("PubMed / MEDLINE");

    // 2. Conversational prefix
    const matchQ20Prefix = findVerifiedAnswer("ขอถามว่า ข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบันที่ระบบใช้ตอบ สามารถตรวจสอบจากแหล่งอ้างอิงใดได้บ้าง?");
    expect(matchQ20Prefix.found).toBe(true);
    expect(matchQ20Prefix.item?.id).toBe("verified-qa-20-system-sources-ddi");
  });
});

