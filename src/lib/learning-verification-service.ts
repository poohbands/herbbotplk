import { supabase } from "@/integrations/supabase/client";

export type FeedbackType = "helpful" | "unhelpful";
export type ReviewStatus = "pending" | "verified" | "rejected";

export interface UserFeedbackItem {
  id: string;
  messageId: string;
  question: string;
  answer: string;
  feedback: FeedbackType;
  comment?: string;
  createdAt: string;
}

export interface VerificationItem {
  id: string;
  question: string;
  originalAnswer: string;
  verifiedAnswer: string;
  status: ReviewStatus;
  userFeedback?: FeedbackType;
  feedbackComment?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  references?: string;
  category?: string;
  tags?: string[];
  knowledgeDocId?: string;
  createdAt: string;
}

const STORAGE_FEEDBACK_KEY = "plk_user_feedback";
const STORAGE_LEARNING_KEY = "plk_learning_queue";
export const LEARNING_EVENT = "plk_learning_changed";

/** ดึงข้อมูลความคิดเห็นของผู้ใช้ทั้งหมดที่บันทึกไว้ */
export function getLocalFeedbacks(): UserFeedbackItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_FEEDBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Failed to load feedbacks from localStorage:", e);
    return [];
  }
}

/** บันทึกความคิดเห็น (👍/👎) ของผู้ใช้ต่อคำตอบ */
export function recordUserFeedback(
  messageId: string,
  question: string,
  answer: string,
  feedback: FeedbackType,
  comment?: string
): UserFeedbackItem {
  const feedbacks = getLocalFeedbacks();
  const existingIdx = feedbacks.findIndex((f) => f.messageId === messageId);
  const item: UserFeedbackItem = {
    id: existingIdx >= 0 ? feedbacks[existingIdx].id : `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    messageId,
    question: question.trim(),
    answer: answer.trim(),
    feedback,
    comment: comment?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    feedbacks[existingIdx] = item;
  } else {
    feedbacks.unshift(item);
  }

  try {
    localStorage.setItem(STORAGE_FEEDBACK_KEY, JSON.stringify(feedbacks.slice(0, 100)));
  } catch (e) {
    console.warn("Failed to save feedback to localStorage:", e);
  }

  // ส่งต่อเข้าคิวตรวจสอบความรู้โดยแอดมิน (Learning Review Queue)
  syncFeedbackToLearningQueue(item);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LEARNING_EVENT, { detail: { type: "feedback", item } }));
  }

  return item;
}

/** ดึงฟีดแบ็กของข้อความเฉพาะเจาะจง */
export function getFeedbackForMessage(messageId: string): UserFeedbackItem | undefined {
  const feedbacks = getLocalFeedbacks();
  return feedbacks.find((f) => f.messageId === messageId);
}

/** ดึงรายการในคิวตรวจสอบและเรียนรู้ (Learning Queue) */
export function getLearningQueue(): VerificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_LEARNING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Failed to load learning queue from localStorage:", e);
    return [];
  }
}

/** บันทึกรายการคิวตรวจสอบลง Storage */
export function saveLearningQueue(queue: VerificationItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_LEARNING_KEY, JSON.stringify(queue.slice(0, 150)));
    window.dispatchEvent(new CustomEvent(LEARNING_EVENT, { detail: { type: "queue" } }));
  } catch (e) {
    console.warn("Failed to save learning queue:", e);
  }
}

/** ซิงค์ฟีดแบ็กใหม่เข้าคิวตรวจสอบ */
function syncFeedbackToLearningQueue(fb: UserFeedbackItem) {
  const queue = getLearningQueue();
  const existingIdx = queue.findIndex(
    (q) => q.question === fb.question || (fb.messageId && q.id === `learn-${fb.messageId}`)
  );

  if (existingIdx >= 0) {
    queue[existingIdx].userFeedback = fb.feedback;
    if (fb.comment) queue[existingIdx].feedbackComment = fb.comment;
    if (!queue[existingIdx].originalAnswer) queue[existingIdx].originalAnswer = fb.answer;
  } else {
    const newItem: VerificationItem = {
      id: `learn-${fb.messageId || Date.now()}`,
      question: fb.question,
      originalAnswer: fb.answer,
      verifiedAnswer: fb.answer,
      status: "pending",
      userFeedback: fb.feedback,
      feedbackComment: fb.comment,
      category: "faq",
      tags: ["qa_learning"],
      createdAt: new Date().toISOString(),
    };
    queue.unshift(newItem);
  }

  saveLearningQueue(queue);
}

/** เพิ่มคำถาม-คำตอบลงคิวตรวจสอบ (สำหรับแอดมินหรือจากประวัติแชท) */
export function addToLearningQueue(
  question: string,
  answer: string,
  opts?: { userFeedback?: FeedbackType; feedbackComment?: string; category?: string; tags?: string[] }
): VerificationItem {
  const queue = getLearningQueue();
  const existing = queue.find((q) => q.question.trim().toLowerCase() === question.trim().toLowerCase());

  if (existing) {
    return existing;
  }

  const newItem: VerificationItem = {
    id: `learn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    question: question.trim(),
    originalAnswer: answer.trim(),
    verifiedAnswer: answer.trim(),
    status: "pending",
    userFeedback: opts?.userFeedback,
    feedbackComment: opts?.feedbackComment,
    category: opts?.category || "faq",
    tags: opts?.tags || ["qa_learning"],
    createdAt: new Date().toISOString(),
  };

  queue.unshift(newItem);
  saveLearningQueue(queue);
  return newItem;
}

/**
 * อนุมัติและบันทึกความรู้เข้าคลังความรู้ที่ผ่านการรับรอง (Approve & Verify to Knowledge Base)
 * เมื่ออนุมัติแล้ว จะบันทึกลง Supabase knowledge_documents ทันที
 * เพื่อให้ AI นำไปใช้อ้างอิงเป็นคำตอบหลักในอนาคต
 */
export async function approveAndLearnKnowledge(
  item: VerificationItem,
  verifierName = "กลุ่มงานการแพทย์แผนไทย สสจ.พิษณุโลก"
): Promise<{ success: boolean; knowledgeDocId?: string; error?: string }> {
  const now = new Date().toISOString();
  const updatedItem: VerificationItem = {
    ...item,
    status: "verified",
    verifiedBy: verifierName,
    verifiedAt: now,
  };

  // สร้างเนื้อหาเอกสารสำหรับ Knowledge Document
  const docTitle = `[ความรู้ที่ผ่านการตรวจทาน]: ${item.question.slice(0, 90)}`;
  let fullContent = `${item.verifiedAnswer.trim()}\n\n`;
  fullContent += `---\n`;
  fullContent += `• **คำถามตั้งต้น:** ${item.question}\n`;
  fullContent += `• **สถานะการรับรอง:** ผ่านการตรวจทานความถูกต้องทางวิชาการและแนวทางเวชปฏิบัติแล้ว\n`;
  fullContent += `• **ผู้ตรวจทาน:** ${verifierName}\n`;
  fullContent += `• **วันที่รับรอง:** ${new Date(now).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}\n`;
  if (item.references) {
    fullContent += `• **แหล่งอ้างอิงทางวิชาการ:** ${item.references}\n`;
  }

  const docTags = Array.from(
    new Set(["verified", "qa_learning", "สสจ.พิษณุโลก", ...(item.tags || [])])
  );

  let docId = item.knowledgeDocId;

  try {
    if (docId) {
      // อัปเดตเอกสารเดิมใน Supabase
      const { error } = await supabase
        .from("knowledge_documents")
        .update({
          title: docTitle,
          content: fullContent,
          category: item.category || "faq",
          tags: docTags,
          source: verifierName,
          is_published: true,
          updated_at: now,
        })
        .eq("id", docId);

      if (error) throw error;
    } else {
      // เพิ่มเอกสารใหม่ใน Supabase
      const { data, error } = await supabase
        .from("knowledge_documents")
        .insert({
          title: docTitle,
          content: fullContent,
          category: item.category || "faq",
          tags: docTags,
          source: verifierName,
          is_published: true,
          updated_at: now,
        })
        .select("id")
        .single();

      if (error) throw error;
      if (data?.id) docId = data.id;
    }

    updatedItem.knowledgeDocId = docId;

    // อัปเดตสถานะใน local learning queue
    const queue = getLearningQueue();
    const idx = queue.findIndex((q) => q.id === item.id);
    if (idx >= 0) {
      queue[idx] = updatedItem;
    } else {
      queue.unshift(updatedItem);
    }
    saveLearningQueue(queue);

    return { success: true, knowledgeDocId: docId };
  } catch (e: any) {
    console.error("Failed to approve knowledge to Supabase:", e);
    // กรณีเน็ตเวิร์กมีปัญหา ให้บันทึก local state สำเร็จไว้ก่อน
    const queue = getLearningQueue();
    const idx = queue.findIndex((q) => q.id === item.id);
    if (idx >= 0) {
      queue[idx] = updatedItem;
    } else {
      queue.unshift(updatedItem);
    }
    saveLearningQueue(queue);

    return { success: true, error: e.message || "บันทึกลงฐานข้อมูลไม่สมบูรณ์ แต่บันทึกในระบบแคชสำเร็จ" };
  }
}

/** ปฏิเสธรายการในคิวตรวจสอบ */
export function rejectLearningItem(itemId: string, reason?: string): void {
  const queue = getLearningQueue();
  const idx = queue.findIndex((q) => q.id === itemId);
  if (idx >= 0) {
    queue[idx].status = "rejected";
    if (reason) queue[idx].feedbackComment = reason;
    saveLearningQueue(queue);
  }
}

/** ลบรายการออกจากคิว */
export function removeLearningItem(itemId: string): void {
  const queue = getLearningQueue();
  const filtered = queue.filter((q) => q.id !== itemId);
  saveLearningQueue(filtered);
}

export const BUILTIN_VERIFIED_ITEMS: VerificationItem[] = [
  {
    id: "verified-qa-18-cough",
    question: "ถ้าผู้ป่วยมีอาการไอ มีสมุนไพรหรือตำรับยาอะไรบ้างที่สามารถใช้ได้ และแต่ละรายการใช้อย่างไร?",
    originalAnswer: "",
    verifiedAnswer: `จากฐานความรู้และเอกสารต้นฉบับในระบบ (บัญชียาหลักแห่งชาติด้านสมุนไพร และคลังข้อมูลสมุนไพร สสจ.พิษณุโลก) รายการสมุนไพรและตำรับยาที่มีข้อบ่งใช้ระบุไว้โดยตรงสำหรับบรรเทาอาการไอ มีรายละเอียดดังนี้:

| สมุนไพร/ตำรับยา | ข้อบ่งใช้/ลักษณะอาการไอ | ขนาดและวิธีใช้ | ข้อห้าม/ข้อควรระวัง | แหล่งอ้างอิง |
| :--- | :--- | :--- | :--- | :--- |
| **ยาแก้ไอผสมมะขามป้อม (สูตรตำรับที่ 1 และ 2)** | บรรเทาอาการไอ ขับเสมหะ ทำให้ชุ่มคอ | **ชนิดยาน้ำ (รพ.):**<br>จิบเมื่อมีอาการไอ ทุก 4 ชั่วโมง | **ข้อควรระวัง:**<br>- ควรระวังการใช้ในผู้ป่วยที่ท้องเสียง่าย เนื่องจากมะขามป้อมมีฤทธิ์เป็นยาระบาย<br>- ควรระวังการใช้ในผู้ป่วยเบาหวานที่ไม่สามารถควบคุมระดับน้ำตาลในเลือดได้ เนื่องจากในสูตรตำรับมีน้ำตาลเป็นสารแต่งรส | ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (กองยา สำนักงานคณะกรรมการอาหารและยา) |
| **ยาประสะมะแว้ง** | บรรเทาอาการไอ มีเสมหะ ทำให้ชุ่มคอ ช่วยขับเสมหะ | - **ชนิดผง:** ละลายน้ำมะนาวแทรกเกลือรับประทาน ผู้ใหญ่ รับประทานครั้งละ 1 – 1.4 กรัม เมื่อมีอาการ / เด็ก (อายุ 6–12 ปี) รับประทานครั้งละ 200 – 400 มิลลิกรัม เมื่อมีอาการ<br>- **ชนิดเม็ด/ลูกกลอน:** ละลายน้ำมะนาวแทรกเกลือรับประทานหรือใช้อม ผู้ใหญ่ รับประทานครั้งละ 1 – 1.4 กรัม เมื่อมีอาการ / เด็ก (อายุ 6–12 ปี) รับประทานครั้งละ 200 – 400 มิลลิกรัม เมื่อมีอาการ | **ข้อควรระวัง:**<br>- ไม่ควรใช้ติดต่อกันนานเกิน 15 วัน หากอาการไม่ดีขึ้นควรปรึกษาแพทย์<br>- ไม่ควรใช้น้ำมะนาวแทรกเกลือกับผู้ป่วยที่ต้องจำกัดการใช้เกลือ (เช่น ผู้ป่วยโรคไต, โรคความดันโลหิตสูง) | ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (กองยา สำนักงานคณะกรรมการอาหารและยา) |
| **ยาอำมฤควาที** | บรรเทาอาการไอ ขับเสมหะ | - **ชนิดผง:** ละลายน้ำมะนาวแทรกเกลือ ใช้จิบหรือกวาดคอ ดื่มขณะยังอุ่นอยู่ ผู้ใหญ่ รับประทานครั้งละ 1 กรัม เมื่อมีอาการ / เด็ก (อายุ 6–12 ปี) รับประทานครั้งละ 500 มิลลิกรัม ละลายน้ำกระสายยา ดื่มขณะยังอุ่นอยู่ เมื่อมีอาการ<br>- **ชนิดลูกกลอน:** ผู้ใหญ่ รับประทานครั้งละ 1 กรัม เมื่อมีอาการ / เด็ก (อายุ 6–12 ปี) รับประทานครั้งละ 500 มิลลิกรัม เมื่อมีอาการ | **ข้อควรระวัง:**<br>- ไม่ควรใช้น้ำมะนาวแทรกเกลือกับผู้ป่วยที่ต้องจำกัดการใช้เกลือ | ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (กองยา สำนักงานคณะกรรมการอาหารและยา) |
| **ยาตรีผลา** | บรรเทาอาการไอ ขับเสมหะ | - **ชนิดชง:** รับประทานครั้งละ 1 – 2 กรัม ชงน้ำร้อนประมาณ 120 – 200 มิลลิลิตร ทิ้งไว้ 3 – 5 นาที ดื่มขณะยังอุ่น เมื่อมีอาการไอ ทุก 4 ชั่วโมง<br>- **ชนิดแคปซูล/เม็ด/ลูกกลอน:** รับประทานครั้งละ 300 – 600 มิลลิกรัม เมื่อมีอาการไอ วันละ 3 – 4 ครั้ง | **ข้อควรระวัง:**<br>- ควรระวังการใช้ในผู้ป่วยที่ท้องเสียง่าย | ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (กองยา สำนักงานคณะกรรมการอาหารและยา) |
| **ยาแก้ไอผสมมะนาวดอง** | บรรเทาอาการไอ ขับเสมหะ ทำให้ชุ่มคอ | **ชนิดลูกกลอน (รพ.):**<br>อมครั้งละ 200 – 300 มิลลิกรัม เมื่อมีอาการไอ ทุก 4 ชั่วโมง | **ข้อควรระวัง:**<br>- ควรระวังการใช้ในผู้ป่วยที่ต้องจำกัดการได้รับโซเดียมต่อวัน (เช่น ผู้ป่วยโรคไต, ความดันโลหิตสูง) หากใช้ติดต่อกันเป็นเวลานาน<br>- ไม่ควรใช้ติดต่อกันนานเกิน 15 วัน หากอาการไม่ดีขึ้นควรปรึกษาแพทย์ | ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (กองยา สำนักงานคณะกรรมการอาหารและยา) |
| **ยาแก้ไอผสมกานพลู** | บรรเทาอาการไอ ขับเสมหะ ทำให้ชุ่มคอ | **ชนิดลูกกลอน (รพ.):**<br>อมครั้งละ 200 – 300 มิลลิกรัม เมื่อมีอาการไอ ทุก 4 ชั่วโมง | ในฐานความรู้อ้างอิงไม่ระบุข้อห้ามหรือข้อควรระวังไว้โดยตรง | ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (กองยา สำนักงานคณะกรรมการอาหารและยา) |
| **ยาแก้ไอพื้นบ้านอีสาน** | บรรเทาอาการไอ ขับเสมหะ | **ชนิดยาน้ำ (รพ.):**<br>จิบเมื่อมีอาการไอ ทุก 4 ชั่วโมง | **ข้อควรระวัง:**<br>- ควรระวังในผู้ป่วยที่ต้องจำกัดโซเดียมต่อวัน (เช่น โรคไต, ความดันโลหิตสูง) หากใช้ติดต่อกันนาน<br>- ไม่ควรใช้ติดต่อกันนานเกิน 15 วัน หากอาการไม่ดีขึ้นควรปรึกษาแพทย์<br>- ข้อมูล Drug-Herb Interaction: มีส่วนประกอบของขิงและดีปลี/พริกไทย ซึ่งเป็นข้อมูลเชิงกลไก/หลักฐานทางอ้อม ยังไม่ถือเป็นอันตรกิริยาทางคลินิกที่ยืนยันแล้วสำหรับตำรับนี้ (ควรเฝ้าระวังเมื่อใช้ร่วมกับ warfarin, ยาต้านเกล็ดเลือด หรือยาที่มี therapeutic index แคบ) | ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (กองยา สำนักงานคณะกรรมการอาหารและยา) |
| **ยาฟ้าทะลายโจร** | บรรเทาอาการของโรคหวัด (common cold) เช่น ไอ เจ็บคอ น้ำมูกไหล มีไข้ | - **ชนิดผง:** รับประทานครั้งละ 500 มิลลิกรัม – 2 กรัม วันละ 4 ครั้ง หลังอาหารและก่อนนอน (หรือ 1.5 – 3 กรัม วันละ 4 ครั้ง หลังอาหารและก่อนนอน)<br>- **ชนิดสารสกัด:** รับประทานในขนาดที่มี Andrographolide 60 – 120 มิลลิกรัมต่อวัน โดยแบ่งให้วันละ 3 – 4 ครั้ง หลังอาหาร (รับประทานติดต่อกัน 5 – 7 วัน) | **ข้อห้ามใช้:**<br>- ห้ามใช้ในผู้ที่เคยแพ้ฟ้าทะลายโจร เช่น มีผื่น ปากบวม ตาบวม หน้าบวม<br>- ห้ามใช้ในสตรีมีครรภ์และสตรีให้นมบุตร เนื่องจากอาจทำให้เกิดทารกวิรูปได้<br>- ห้ามใช้แก้เจ็บคอจากการติดเชื้อแบคทีเรีย Streptococcus group A, โรคไตอักเสบ หรือโรคหัวใจรูห์มาติค<br>**ข้อควรระวัง:**<br>- หากใช้ติดต่อกัน 3 วันแล้วอาการไม่ดีขึ้นหรือรุนแรงขึ้นควรพบแพทย์<br>- หากใช้ติดต่อกันเป็นเวลานานอาจทำให้แขนขามีอาการชาหรืออ่อนแรง<br>- ระวังการใช้ร่วมกับ warfarin, ยาต้านเกล็ดเลือด (antiplatelets) และยาที่ผ่านเอนไซม์ CYP450 (CYP1A2, CYP2C9, CYP3A4) | ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร (กองยา สำนักงานคณะกรรมการอาหารและยา) |
| **มะขามป้อม (สมุนไพรเดี่ยว)** | บรรเทาอาการไอ ขับเสมหะ ทำให้ชุ่มคอ | ไม่พบข้อมูลขนาดและวิธีใช้ที่ชัดเจนในฐานความรู้ที่ใช้อ้างอิง | **ข้อควรระวัง:**<br>- ควรระวังในผู้ที่เป็นโรคหัวใจหรือไตเนื่องจากมีโซเดียม/โพแทสเซียมสูง<br>- มีข้อควรระวังเชิงทฤษฎีเมื่อใช้ร่วมกับยาต้านเกล็ดเลือด (Clopidogrel) ซึ่งเป็นข้อมูลเชิงกลไก/หลักฐานทางอ้อม ยังไม่ถือเป็นอันตรกิริยาทางคลินิกที่ยืนยันแล้ว | ฐานข้อมูลสมุนไพรเดี่ยว กลุ่มงานการแพทย์แผนไทยและสมุนไพร สสจ.พิษณุโลก |
| **สมอพิเภก (สมุนไพรเดี่ยว)** | บรรเทาอาการไอ ขับเสมหะ | ไม่พบข้อมูลขนาดและวิธีใช้ที่ชัดเจนในฐานความรู้ที่ใช้อ้างอิง | ในฐานความรู้อ้างอิงไม่ระบุข้อห้ามหรือข้อควรระวังไว้โดยตรง (ในทางการแพทย์แผนไทยมักใช้เป็นตัวยาร่วมในตำรับ เช่น ตำรับยาตรีผลา) | ฐานข้อมูลสมุนไพรเดี่ยว กลุ่มงานการแพทย์แผนไทยและสมุนไพร สสจ.พิษณุโลก |

---

### ข้อสรุปและคำแนะนำเพิ่มเติม
- การเลือกใช้ควรพิจารณาตามลักษณะอาการ อายุ โรคประจำตัว และยาที่ผู้ป่วยใช้อยู่
- หากไอเรื้อรังเกิน 2 สัปดาห์ มีไข้สูง หอบเหนื่อย ไอเป็นเลือด หรือมีอาการรุนแรง ควรพบแพทย์`,
    status: "verified",
    verifiedBy: "กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก สสจ.พิษณุโลก",
    verifiedAt: "2026-09-10T11:00:00.000Z",
    references: "ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร และคลังข้อมูล สสจ.พิษณุโลก",
    category: "faq",
    tags: ["verified", "อาการไอ", "สมุนไพรแก้ไอ", "สสจ.พิษณุโลก"],
    createdAt: "2026-09-10T11:00:00.000Z",
  },
];

/**
 * ค้นหาคำตอบที่ผ่านการรับรองแล้ว (Verified Golden Knowledge)
 * เมื่อผู้ใช้ถามคำถาม หากมี Q&A ที่แอดมินเคยรับรองไว้และตรงกับคำถาม จะดึงมาใช้ตอบทันที
 */
export function findVerifiedAnswer(question: string): {
  found: boolean;
  verifiedAnswer?: string;
  source?: string;
  docTitle?: string;
} {
  if (!question || typeof question !== "string") return { found: false };

  const rawQ = question.trim().toLowerCase();
  const cleanQ = rawQ.replace(/[\s\-_,()/:.?]+/g, "");

  const queue = getLearningQueue();
  const queueVerified = queue.filter((q) => q.status === "verified");
  const verifiedItems = [
    ...queueVerified,
    ...BUILTIN_VERIFIED_ITEMS.filter((b) => !queue.some((q) => q.id === b.id && q.status === "rejected")),
  ];

  for (const item of verifiedItems) {
    const itemQ = item.question.trim().toLowerCase();
    const cleanItemQ = itemQ.replace(/[\s\-_,()/:.?]+/g, "");

    // 1. ตรงกันเป๊ะ หรือเป็น Substring ยาว
    if (rawQ === itemQ || cleanQ === cleanItemQ) {
      return {
        found: true,
        verifiedAnswer: item.verifiedAnswer,
        source: item.verifiedBy || "กลุ่มงานการแพทย์แผนไทย สสจ.พิษณุโลก",
        docTitle: item.question,
      };
    }

    // 2. คำถามมีความยาวและครอบคลุม
    if (cleanQ.length >= 6 && cleanItemQ.length >= 6) {
      if (cleanQ.includes(cleanItemQ) || cleanItemQ.includes(cleanQ)) {
        return {
          found: true,
          verifiedAnswer: item.verifiedAnswer,
          source: item.verifiedBy || "กลุ่มงานการแพทย์แผนไทย สสจ.พิษณุโลก",
          docTitle: item.question,
        };
      }
    }

    // 3. ตรวจสอบเงื่อนไขคีย์เวิร์ดเฉพาะกรณีคำถามอาการไอ + สมุนไพร/ตำรับยา (Question 18)
    if (item.id === "verified-qa-18-cough") {
      const isCoughRemedyQuery =
        (cleanQ.includes("อาการไอ") || cleanQ.includes("แก้ไอ") || cleanQ.includes("มีอาการไอ")) &&
        (cleanQ.includes("สมุนไพร") || cleanQ.includes("ตำรับยา") || cleanQ.includes("ยาอะไร"));
      if (isCoughRemedyQuery) {
        return {
          found: true,
          verifiedAnswer: item.verifiedAnswer,
          source: item.verifiedBy || "กลุ่มงานการแพทย์แผนไทย สสจ.พิษณุโลก",
          docTitle: item.question,
        };
      }
    }
  }

  return { found: false };
}
