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

import { BUILTIN_VERIFIED_DATASET } from "@/data/verified-qa-dataset";

export const BUILTIN_VERIFIED_ITEMS: VerificationItem[] = [
  ...BUILTIN_VERIFIED_DATASET,
];

function cleanQuestionText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/^[\s\uF0B7•\-\*\d.)]+/, "")
    .replace(/[\s\-_,()/:.?؟!\uF0B7•\*\u2022\uFEFF]+/g, "");
}

const CONVERSATIONAL_PREFIX_REGEX = /^(?:ถามคำถามว่า|อยากทราบว่า|ขอถามว่า|ช่วยบอกหน่อยว่า|รบกวนถามว่า|ขอสอบถามหน่อยว่า|ขอสอบถามว่า|สอบถามหน่อยว่า|สอบถามว่า|ถามว่า|ช่วยตอบหน่อยว่า|อยากรู้ว่า|รบกวนสอบถามว่า)/;

/**
 * ค้นหาคำตอบที่ผ่านการตรวจทานและรับรองความถูกต้องแล้ว (Verified Golden Knowledge)
 * เมื่อผู้ใช้ถามคำถาม หากมี Q&A ที่แอดมินหรือผู้เชี่ยวชาญเคยรับรองไว้และตรงกับคำถาม จะดึงมาใช้ตอบทันที
 */
export function findVerifiedAnswer(question: string): {
  found: boolean;
  verifiedAnswer?: string;
  source?: string;
  docTitle?: string;
  item?: VerificationItem;
} {
  if (!question || typeof question !== "string") return { found: false };

  const rawQ = question.trim().toLowerCase();
  // ตัด bullet points (เช่น Word bullet \uF0B7 หรือ • หรือ - หรือตัวเลขข้อ) และเครื่องหมายวรรคตอน
  const cleanQ = cleanQuestionText(rawQ);
  const strippedCleanQ = cleanQ.replace(CONVERSATIONAL_PREFIX_REGEX, "");

  const queue = getLearningQueue();
  const queueVerified = queue.filter((q) => q.status === "verified");
  const verifiedItems = [
    ...queueVerified,
    ...BUILTIN_VERIFIED_ITEMS.filter((b) => !queue.some((q) => q.id === b.id && q.status === "rejected")),
  ];

  const buildResult = (item: VerificationItem) => ({
    found: true,
    verifiedAnswer: item.verifiedAnswer,
    source: item.verifiedBy || "คลังข้อมูลสมุนไพรและประกาศบัญชียาหลักแห่งชาติ",
    docTitle: item.question.replace(/^[\s\uF0B7•\-\*\d.)]+/, "").trim(),
    item,
  });

  // --- PASS 1: Global Exact Matching (raw, cleaned, or prefix-stripped) ---
  for (const item of verifiedItems) {
    const itemQ = item.question.trim().toLowerCase();
    const cleanItemQ = cleanQuestionText(itemQ);
    const strippedItemQ = cleanItemQ.replace(CONVERSATIONAL_PREFIX_REGEX, "");

    if (
      rawQ === itemQ ||
      cleanQ === cleanItemQ ||
      strippedCleanQ === cleanItemQ ||
      cleanQ === strippedItemQ ||
      strippedCleanQ === strippedItemQ
    ) {
      return buildResult(item);
    }
  }

  // Detect if question is a Source / Reference Meta-Inquiry
  const isSourceInquiry =
    cleanQ.includes("อ้างอิงมาจาก") ||
    cleanQ.includes("แหล่งข้อมูล") ||
    cleanQ.includes("แหล่งอ้างอิง") ||
    cleanQ.includes("ตรวจสอบจากแหล่ง") ||
    cleanQ.includes("ที่มาของข้อมูล") ||
    cleanQ.includes("มาจากแหล่ง") ||
    cleanQ.includes("สืบค้นจาก") ||
    cleanQ.includes("เอกสารอ้างอิงใด") ||
    cleanQ.includes("นำมาจากที่ใด") ||
    cleanQ.includes("นำมาจากไหน") ||
    cleanQ.includes("อ้างอิงจากที่ใด") ||
    cleanQ.includes("อ้างอิงจากไหน") ||
    ((cleanQ.includes("อ้างอิง") || cleanQ.includes("ที่มา")) &&
      (cleanQ.includes("แหล่ง") || cleanQ.includes("ใด") || cleanQ.includes("ไหน") || cleanQ.includes("ตรวจสอบ")));

  const isSourceItem = (item: VerificationItem) => {
    return (
      item.id === "verified-qa-19-system-sources-andrographis" ||
      item.id === "verified-qa-20-system-sources-ddi" ||
      (item.tags && (item.tags.includes("อ้างอิงมาจาก") || item.tags.includes("แหล่งอ้างอิง") || item.tags.includes("ที่มา")))
    );
  };

  // --- PASS 2: Intent-Specific Handlers ---
  if (isSourceInquiry) {
    // 2.1 ถามแหล่งข้อมูลเรื่องข้อห้ามใช้/ข้อควรระวัง/ฟ้าทะลายโจร (Question 19)
    if (
      cleanQ.includes("ฟ้าทะลายโจร") ||
      (cleanQ.includes("ข้อห้ามใช้") && cleanQ.includes("ข้อควรระวัง"))
    ) {
      const q19 = verifiedItems.find((it) => it.id === "verified-qa-19-system-sources-andrographis");
      if (q19) return buildResult(q19);
    }

    // 2.2 ถามแหล่งข้อมูลอันตรกิริยา/ยาแผนปัจจุบัน/DDI (Question 20)
    if (
      cleanQ.includes("อันตรกิริยา") ||
      cleanQ.includes("ยาแผนปัจจุบัน") ||
      cleanQ.includes("ddi") ||
      cleanQ.includes("ตีกัน")
    ) {
      const q20 = verifiedItems.find((it) => it.id === "verified-qa-20-system-sources-ddi");
      if (q20) return buildResult(q20);
    }
  }

  // 2.3 ตรวจสอบกรณีคำถามอาการไอ + สมุนไพร/ตำรับยา (Question 18)
  if (!isSourceInquiry) {
    const isCoughRemedyQuery =
      (cleanQ.includes("อาการไอ") || cleanQ.includes("แก้ไอ") || cleanQ.includes("มีอาการไอ")) &&
      (cleanQ.includes("สมุนไพร") || cleanQ.includes("ตำรับยา") || cleanQ.includes("ยาอะไร"));
    if (isCoughRemedyQuery) {
      const q18 = verifiedItems.find((it) => it.id === "verified-qa-18-cough");
      if (q18) return buildResult(q18);
    }
  }

  // --- PASS 3: High-Confidence Substring Matching (Intent-Isolated & Ratio Protected) ---
  for (const item of verifiedItems) {
    // Intent isolation: Source query must NOT match clinical items, and vice versa
    if (isSourceInquiry !== !!isSourceItem(item)) continue;

    const cleanItemQ = cleanQuestionText(item.question);
    if (cleanQ.length >= 6 && cleanItemQ.length >= 6) {
      if (cleanQ.includes(cleanItemQ) || cleanItemQ.includes(cleanQ) || strippedCleanQ.includes(cleanItemQ)) {
        const lenRatio = Math.min(cleanQ.length, cleanItemQ.length) / Math.max(cleanQ.length, cleanItemQ.length);
        if (lenRatio >= 0.60) {
          return buildResult(item);
        }
      }
    }
  }

  // --- PASS 4: Global Scored Best-Match Keywords ---
  let bestItem: VerificationItem | null = null;
  let bestScore = 0;

  for (const item of verifiedItems) {
    // Intent isolation: Source query must NOT match clinical items, and vice versa
    if (isSourceInquiry !== !!isSourceItem(item)) continue;

    const keywords = (item as any).keywords as string[] | undefined;
    if (keywords && keywords.length > 0) {
      const cleanKw = keywords.map((k) => cleanQuestionText(k));
      const matchCount = cleanKw.filter((kw) => cleanQ.includes(kw) || strippedCleanQ.includes(kw)).length;
      const ratio = matchCount / cleanKw.length;

      // Score based on ratio and absolute match count
      if (matchCount >= 2 && ratio >= 0.60) {
        const score = ratio * 10 + matchCount;
        if (score > bestScore) {
          bestScore = score;
          bestItem = item;
        }
      }
    }
  }

  if (bestItem) {
    return buildResult(bestItem);
  }

  return { found: false };
}
