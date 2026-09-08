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
  const verifiedItems = queue.filter((q) => q.status === "verified");

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
  }

  return { found: false };
}
