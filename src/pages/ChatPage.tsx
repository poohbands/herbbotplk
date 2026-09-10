import { useState, useRef, useEffect } from "react";
import { Send, Leaf, AlertTriangle, Phone, ShieldAlert, Home, ExternalLink, BookOpen, FlaskConical, Copy, Check, Cpu, ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import herbalHero from "@/assets/herbal-hero.png";
import { toast } from "sonner";
import { processLocalChat, hasLocalProviderKey, validateAndPruneSources, sanitizeMahidolReferences } from "@/lib/local-chat-service";
import {
  getCurrentActiveProviderStatus,
  type ActiveApiStatus,
} from "@/lib/ai-providers-storage";
import {
  getKnowledgeSettings,
  KNOWLEDGE_SETTINGS_EVENT,
  type KnowledgeSettings,
} from "@/lib/knowledge-settings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useMaintenanceMode } from "@/lib/maintenance-service";
import MaintenanceOverlay from "@/components/MaintenanceOverlay";
import AdminMaintenanceBanner from "@/components/AdminMaintenanceBanner";
import { recordUserFeedback, getFeedbackForMessage, type FeedbackType } from "@/lib/learning-verification-service";

type PubMedSource = { pmid: string; title: string; authors: string; year: string; journal: string };
type ThaiJoSource = { title: string; authors: string; year?: string; journal: string; url: string };
type InternalSource = { type: "herb" | "formula"; id: string; name: string };
type KnowledgeSource = { id: string; title: string; category?: string; source?: string; source_url?: string; content?: string };
type SourcesPayload = {
  pubmed?: PubMedSource[];
  internal?: InternalSource[];
  thaijo?: ThaiJoSource[];
  knowledge?: KnowledgeSource[];
  policy?: string[];
  ai_fallback?: string[];
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  category?: string;
  severity?: string;
  sources?: SourcesPayload;
  timestamp: Date;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/herbal-chat`;

/** เปิดลิงก์ภายนอกในแท็บใหม่เสมอ โดยไม่เปลี่ยนหน้าปัจจุบัน */
function openExternal(url: string) {
  try {
    const finalUrl = url.startsWith("/") ? `${window.location.origin}${url}` : url;
    const win = window.open(finalUrl, "_blank", "noopener,noreferrer");
    if (win) return;
  } catch {
    /* ignore */
  }
  try {
    // fallback: ใช้ anchor target=_blank (ไม่แตะ location ของหน้าปัจจุบัน)
    const finalUrl = url.startsWith("/") ? `${window.location.origin}${url}` : url;
    const a = document.createElement("a");
    a.href = finalUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    const finalUrl = url.startsWith("/") ? `${window.location.origin}${url}` : url;
    void copyLink(finalUrl);
    toast.info("เบราว์เซอร์บล็อกการเปิดแท็บใหม่ — คัดลอกลิงก์ให้แล้ว");
  }
}


async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("คัดลอกลิงก์แล้ว");
  } catch {
    toast.error("คัดลอกลิงก์ไม่สำเร็จ");
  }
}

/** สกัดชื่อยาหรือตัวยาจากหัวข้อเอกสารบัญชียาหลักแห่งชาติด้านสมุนไพร */
function extractDrugNameFromKnowledge(title?: string | null): string {
  if (!title) return "";
  const m = title.match(/บัญชียาหลักแห่งชาติด้านสมุนไพร:\s*(.+?)(?:\s*\(พ\.ศ\.|\s*$)/);
  if (m) return m[1].trim();
  return title
    .replace(/^บัญชียาหลักแห่งชาติด้านสมุนไพร:\s*/, "")
    .replace(/\s*\(พ\.ศ\..*?\)$/, "")
    .trim();
}

/** ตรวจสอบว่าเอกสารเป็นรายการในบัญชียาหลักแห่งชาติด้านสมุนไพรหรือไม่ */
function isNlemKnowledge(k: KnowledgeSource): boolean {
  return (
    k.category === "บัญชียาหลักแห่งชาติด้านสมุนไพร" ||
    Boolean(k.title && k.title.includes("บัญชียาหลักแห่งชาติ")) ||
    Boolean(k.source && k.source.includes("บัญชียาหลักแห่งชาติ")) ||
    Boolean(k.source_url && k.source_url.includes("ratchakitcha"))
  );
}

/** ดึง URL ที่ปลอดภัยสำหรับแสดงผลเอกสารความรู้ (โดยชี้ไปที่ข้อมูลตัวยาภายในระบบ ไม่ชี้ไปที่ ratchakitcha) */
function getKnowledgeLink(k: KnowledgeSource): string {
  if (isNlemKnowledge(k)) {
    const drugName = extractDrugNameFromKnowledge(k.title);
    if (drugName) {
      return `${window.location.origin}/herbs?name=${encodeURIComponent(drugName)}`;
    }
    return `${window.location.origin}/herbs`;
  }
  if (k.source_url && !k.source_url.includes("ratchakitcha.soc.go.th")) {
    return k.source_url.startsWith("/") ? `${window.location.origin}${k.source_url}` : k.source_url;
  }
  return "";
}

const DEFAULT_CATEGORIES = [
  {
    icon: "🌿",
    label: "สรรพคุณสมุนไพร",
    category: "herbal_info",
    questions: [
      "ฟ้าทะลายโจรมีสรรพคุณอย่างไร?",
      "ขมิ้นชันใช้รักษาอะไรได้บ้าง?",
      "กระชายขาวมีประโยชน์อย่างไร?",
    ],
  },
  {
    icon: "💊",
    label: "Drug Interaction",
    category: "drug_interaction",
    questions: [
      "ขมิ้นชันกินร่วมกับยา Warfarin ได้ไหม?",
      "ฟ้าทะลายโจรมีปฏิกิริยากับยาอะไรบ้าง?",
      "ใบแปะก๊วยกินร่วมกับยาละลายลิ่มเลือดได้ไหม?",
    ],
  },
  {
    icon: "⚖️",
    label: "ขนาดยาและวิธีใช้",
    category: "dosage",
    questions: [
      "ฟ้าทะลายโจรใช้ขนาดเท่าไร หญิงตั้งครรภ์กินได้ไหม?",
      "ยาเบญจกูลใช้อย่างไร มีข้อห้ามอะไร?",
      "ยาจันทน์ลีลาใช้ลดไข้ได้ไหม ขนาดเท่าไร?",
    ],
  },
  {
    icon: "🏥",
    label: "กลุ่มเฉพาะ",
    category: "general",
    questions: [
      "สมุนไพรอะไรที่ผู้ป่วยโรคไตควรหลีกเลี่ยง?",
      "หญิงให้นมบุตรกินขมิ้นชันได้ไหม?",
      "สมุนไพรอะไรช่วยลดน้ำตาลในเลือดได้?",
    ],
  },
];

const CATEGORY_META: Record<string, { icon: string; label: string }> = {
  herbal_info: { icon: "🌿", label: "สรรพคุณสมุนไพร" },
  drug_interaction: { icon: "💊", label: "Drug Interaction" },
  dosage: { icon: "⚖️", label: "ขนาดยาและวิธีใช้" },
  side_effects: { icon: "⚠️", label: "ผลข้างเคียง" },
  general: { icon: "🏥", label: "ทั่วไป" },
};

function parseMetadata(content: string) {
  let cleanContent = content;
  let category = "general";
  let severity = "none";
  let herbs: string[] = [];
  let drugs: string[] = [];
  let sources: SourcesPayload | undefined;

  const metaMatch = content.match(/\[METADATA\]([\s\S]*?)\[\/METADATA\]/);
  if (metaMatch) {
    const meta = metaMatch[1];
    const getField = (field: string) => {
      const m = meta.match(new RegExp(`${field}:\\s*(.+)`));
      return m ? m[1].trim() : "";
    };
    category = getField("category") || "general";
    severity = getField("severity") || "none";
    herbs = getField("herbs").split(",").map((s) => s.trim()).filter(Boolean);
    drugs = getField("drugs").split(",").map((s) => s.trim()).filter(Boolean);
    cleanContent = cleanContent.replace(/\[METADATA\][\s\S]*?\[\/METADATA\]/, "").trim();
  }

  const srcMatch = content.match(/\[SOURCES\]([\s\S]*?)\[\/SOURCES\]/);
  if (srcMatch) {
    try {
      sources = JSON.parse(srcMatch[1].trim());
    } catch {
      // ignore malformed
    }
    cleanContent = cleanContent.replace(/\[SOURCES\][\s\S]*?\[\/SOURCES\]/, "").trim();
  }

  return { cleanContent, category, severity, herbs, drugs, sources };
}

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [suggestedCategories, setSuggestedCategories] = useState(DEFAULT_CATEGORIES);
  const [selectedKnowledgeDoc, setSelectedKnowledgeDoc] = useState<KnowledgeSource | null>(null);
  const [fetchingKnowledgeContent, setFetchingKnowledgeContent] = useState(false);
  const [knowledgeSettings, setKnowledgeSettings] = useState<KnowledgeSettings>(() => getKnowledgeSettings());
  const [activeApiStatus, setActiveApiStatus] = useState<ActiveApiStatus>(() => getCurrentActiveProviderStatus());
  const [feedbackStates, setFeedbackStates] = useState<Record<string, FeedbackType>>({});
  const [feedbackModalMsg, setFeedbackModalMsg] = useState<{ id: string; question: string; answer: string } | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleCopyMessage = async (text: string, msgId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(msgId);
      toast.success("คัดลอกข้อความแล้ว");
      setTimeout(() => {
        setCopiedMessageId((prev) => (prev === msgId ? null : prev));
      }, 2000);
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopiedMessageId(msgId);
        toast.success("คัดลอกข้อความแล้ว");
        setTimeout(() => {
          setCopiedMessageId((prev) => (prev === msgId ? null : prev));
        }, 2000);
      } catch {
        toast.error("คัดลอกข้อความไม่สำเร็จ");
      }
    }
  };

  const handleThumbsUp = (msgId: string, question: string, answer: string) => {
    recordUserFeedback(msgId, question, answer, "helpful");
    setFeedbackStates((prev) => ({ ...prev, [msgId]: "helpful" }));
    toast.success("ขอบคุณสำหรับข้อเสนอแนะ! ระบบจะนำไปเรียนรู้เพื่อปรับปรุงคำตอบให้ดียิ่งขึ้น");
  };

  const handleThumbsDown = (msgId: string, question: string, answer: string) => {
    setFeedbackModalMsg({ id: msgId, question, answer });
    setFeedbackComment("");
  };

  const submitNegativeFeedback = () => {
    if (!feedbackModalMsg) return;
    recordUserFeedback(
      feedbackModalMsg.id,
      feedbackModalMsg.question,
      feedbackModalMsg.answer,
      "unhelpful",
      feedbackComment
    );
    setFeedbackStates((prev) => ({ ...prev, [feedbackModalMsg.id]: "unhelpful" }));
    toast.info("บันทึกรายงานแล้ว ทีมงานและผู้เชี่ยวชาญจะนำไปตรวจสอบความถูกต้องครับ");
    setFeedbackModalMsg(null);
  };

  useEffect(() => {
    const refreshApiStatus = () => {
      setActiveApiStatus(getCurrentActiveProviderStatus());
    };

    refreshApiStatus();
    // อัปเดตสถานะผู้ให้บริการ AI อัตโนมัติทุก 5 นาที (300,000 ms)
    const interval = setInterval(refreshApiStatus, 5 * 60 * 1000);

    const handleSettingsChange = () => {
      setKnowledgeSettings(getKnowledgeSettings());
      refreshApiStatus();
    };

    window.addEventListener(KNOWLEDGE_SETTINGS_EVENT, handleSettingsChange);
    window.addEventListener("storage", handleSettingsChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener(KNOWLEDGE_SETTINGS_EVENT, handleSettingsChange);
      window.removeEventListener("storage", handleSettingsChange);
    };
  }, []);

  const handleOpenKnowledge = async (k: KnowledgeSource) => {
    // 1. ถ้าเป็นรายการจากบัญชียาหลักแห่งชาติด้านสมุนไพร ให้เปิดข้อมูลตัวยาที่ค้นหาภายในระบบ ไม่ link ไปที่ ratchakitcha
    if (isNlemKnowledge(k)) {
      const drugName = extractDrugNameFromKnowledge(k.title);
      const targetUrl = drugName
        ? `${window.location.origin}/herbs?name=${encodeURIComponent(drugName)}`
        : `${window.location.origin}/herbs`;
      openExternal(targetUrl);
      return;
    }

    // 2. ถ้าเป็นลิงก์ภายนอกอื่นที่ไม่ใช่ ratchakitcha ให้เปิดตามปกติ
    if (k.source_url && (k.source_url.startsWith("http://") || k.source_url.startsWith("https://"))) {
      if (!k.source_url.includes("ratchakitcha.soc.go.th")) {
        openExternal(k.source_url);
        return;
      }
    }

    // 3. ถ้าเป็นลิงก์ภายใน
    if (k.source_url && k.source_url.startsWith("/herbs")) {
      openExternal(`${window.location.origin}${k.source_url}`);
      return;
    }
    setSelectedKnowledgeDoc(k);
    if (!k.content && k.id) {
      setFetchingKnowledgeContent(true);
      try {
        const { data } = await supabase
          .from("knowledge_documents")
          .select("content, source, category, title")
          .eq("id", k.id)
          .maybeSingle();
        if (data) {
          setSelectedKnowledgeDoc((prev) =>
            prev && prev.id === k.id
              ? {
                  ...prev,
                  content: data.content,
                  source: data.source || prev.source,
                  category: data.category || prev.category,
                }
              : prev
          );
        }
      } catch (e) {
        console.warn("Failed to fetch knowledge document details:", e);
      } finally {
        setFetchingKnowledgeContent(false);
      }
    }
  };

  // Load popular questions from DB
  useEffect(() => {
    const loadPopularQuestions = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("content, category")
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error || !data || data.length < 5) return;

      // Group by category and pick top questions (deduplicate similar ones)
      const byCategory: Record<string, string[]> = {};
      for (const row of data) {
        const cat = row.category || "general";
        if (!byCategory[cat]) byCategory[cat] = [];
        // Skip very short or duplicate-ish questions
        if (row.content.length < 10) continue;
        const isDuplicate = byCategory[cat].some(
          (q) => q.toLowerCase() === row.content.toLowerCase()
        );
        if (!isDuplicate && byCategory[cat].length < 3) {
          byCategory[cat].push(row.content);
        }
      }

      // Build dynamic categories, fall back to defaults if not enough
      const dynamic = DEFAULT_CATEGORIES.map((def) => {
        const dbQuestions = byCategory[def.category];
        if (dbQuestions && dbQuestions.length >= 2) {
          return { ...def, questions: dbQuestions };
        }
        return def;
      });

      setSuggestedCategories(dynamic);
    };

    loadPopularQuestions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createSession = async () => {
    if (sessionId) return sessionId;
    const { data, error } = await supabase.from("chat_sessions").insert({}).select("id").single();
    if (error) {
      console.error("Failed to create session:", error);
      return null;
    }
    setSessionId(data.id);
    return data.id;
  };

  const saveMessage = async (sid: string, role: string, content: string, meta?: any) => {
    await supabase.from("chat_messages").insert({
      session_id: sid,
      role,
      content,
      category: meta?.category || "general",
      severity: meta?.severity || null,
      herbs_mentioned: meta?.herbs || [],
      drugs_mentioned: meta?.drugs || [],
      sources: meta?.sources || [],
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userContent = input.trim();
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userContent,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setLoadingStage(0);
    const stageTimers = [
      window.setTimeout(() => setLoadingStage(1), 2500),
      window.setTimeout(() => setLoadingStage(2), 6000),
      window.setTimeout(() => setLoadingStage(3), 11000),
    ];
    const clearStageTimers = () => stageTimers.forEach((t) => window.clearTimeout(t));



    const sid = await createSession();
    if (sid) {
      saveMessage(sid, "user", userContent);
    }

    let assistantContent = "";
    let cleanContent = "";
    let category = "general";
    let severity = "none";
    let sources: SourcesPayload | undefined;

    try {
      const allMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const currentSettings = getKnowledgeSettings();

      // 1. ถ้ามี Local Provider Key ที่ตั้งค่าไว้ ให้เรียกผ่าน Direct Local Service ทันที
      if (hasLocalProviderKey()) {
        let streamAssistant = "";
        const fullResponse = await processLocalChat(
          userContent,
          allMessages,
          (liveText) => {
            streamAssistant = liveText;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, content: streamAssistant } : m
                );
              }
              return [
                ...prev,
                {
                  id: (Date.now() + 1).toString(),
                  role: "assistant",
                  content: streamAssistant,
                  timestamp: new Date(),
                },
              ];
            });
          },
          currentSettings
        );

        const parsed = parseMetadata(fullResponse);
        cleanContent = parsed.cleanContent;
        if (currentSettings.enable_mahidol_ddi === false) {
          cleanContent = sanitizeMahidolReferences(cleanContent);
        }
        category = parsed.category;
        severity = parsed.severity;
        sources = parsed.sources ? validateAndPruneSources(userContent, cleanContent, parsed.sources, currentSettings) : parsed.sources;

        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1
                ? { ...m, content: cleanContent, category, severity, sources }
                : m
            );
          }
          return [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: cleanContent,
              category,
              severity,
              sources,
              timestamp: new Date(),
            },
          ];
        });
      } else {
        // 2. พยายามเรียก Cloud Edge Function ถ้ามี
        let usedCloud = false;
        try {
          const resp = await fetch(CHAT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              messages: allMessages,
              settings: currentSettings,
            }),
          });

          if (resp.ok && resp.body) {
            usedCloud = true;
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let textBuffer = "";
            let streamDone = false;

            while (!streamDone) {
              const { done, value } = await reader.read();
              if (done) break;
              textBuffer += decoder.decode(value, { stream: true });

              let newlineIndex: number;
              while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
                let line = textBuffer.slice(0, newlineIndex);
                textBuffer = textBuffer.slice(newlineIndex + 1);
                if (line.endsWith("\r")) line = line.slice(0, -1);
                if (line.startsWith(":") || line.trim() === "") continue;
                if (!line.startsWith("data: ")) continue;

                const jsonStr = line.slice(6).trim();
                if (jsonStr === "[DONE]") {
                  streamDone = true;
                  break;
                }

                try {
                  const parsed = JSON.parse(jsonStr);
                  const content = parsed.choices?.[0]?.delta?.content as string | undefined;
                  if (content) {
                    assistantContent += content;
                    setMessages((prev) => {
                      const last = prev[prev.length - 1];
                      if (last?.role === "assistant") {
                        return prev.map((m, i) =>
                          i === prev.length - 1 ? { ...m, content: assistantContent } : m
                        );
                      }
                      return [
                        ...prev,
                        {
                          id: (Date.now() + 1).toString(),
                          role: "assistant",
                          content: assistantContent,
                          timestamp: new Date(),
                        },
                      ];
                    });
                  }
                } catch {
                  textBuffer = line + "\n" + textBuffer;
                  break;
                }
              }
            }

            const parsed = parseMetadata(assistantContent);
            cleanContent = parsed.cleanContent;
            if (currentSettings.enable_mahidol_ddi === false) {
              cleanContent = sanitizeMahidolReferences(cleanContent);
            }
            category = parsed.category;
            severity = parsed.severity;
            sources = parsed.sources ? validateAndPruneSources(userContent, cleanContent, parsed.sources, currentSettings) : parsed.sources;

            setMessages((prev) =>
              prev.map((m, i) =>
                i === prev.length - 1 && m.role === "assistant"
                  ? { ...m, content: cleanContent, category, severity, sources }
                  : m
              )
            );
          }
        } catch {
          usedCloud = false;
        }

        // 3. ถ้า Cloud ล้มเหลว (เช่น เครดิต Lovable หมด / ไม่มีคีย์) และเครื่องยังไม่ได้ใส่คีย์
        if (!usedCloud) {
          cleanContent = `ยินดีต้อนรับสู่ HerbBot PLK (หมอยาพิษณุโลก)!\n\nขณะนี้ระบบทำงานใน โหมดเครื่องส่วนตัว (Local Standalone Mode) เนื่องจากฟังก์ชันบน Cloud หรือเครดิต Lovable ไม่พร้อมใช้งาน`;

          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: cleanContent,
              category: "general",
              severity: "none",
              timestamp: new Date(),
            },
          ]);
        }
      }

      if (sid && cleanContent) {
        const flatSources = [
          ...(sources?.pubmed || []).map((p) => `PMID:${p.pmid}`),
          ...(sources?.internal || []).map((i) => `${i.type}:${i.id}`),
          ...(sources?.thaijo || []).map((t) => `thaijo:${t.url}`),
        ];
        saveMessage(sid, "assistant", cleanContent, { category, severity, herbs: [], drugs: [], sources: flatSources });
      }
    } catch (e: any) {
      console.error("Chat error:", e);
      toast.error(e.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      clearStageTimers();
      setIsLoading(false);
      setLoadingStage(0);
    }

  };

  const getCategoryLabel = (cat?: string) => {
    switch (cat) {
      case "drug_interaction": return "💊 Drug Interaction";
      case "herbal_info": return "🌿 ข้อมูลสมุนไพร";
      case "dosage": return "⚖️ วิธีใช้/ขนาดยา";
      case "side_effects": return "⚠️ ผลข้างเคียง";
      default: return "📋 ทั่วไป";
    }
  };

  const getSeverityBadge = (sev?: string) => {
    switch (sev) {
      case "major": return <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">⚠️ Major</span>;
      case "moderate": return <span className="text-xs px-2 py-0.5 rounded-full bg-herb-gold/20 text-herb-earth font-medium">⚡ Moderate</span>;
      case "minor": return <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">ℹ️ Minor</span>;
      default: return null;
    }
  };

  const { isMaintenance, message: maintenanceMsg, isAdmin } = useMaintenanceMode();

  if (isMaintenance && !isAdmin) {
    return <MaintenanceOverlay message={maintenanceMsg} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AdminMaintenanceBanner />
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full gradient-herbal flex items-center justify-center shadow-herbal">
              <Leaf className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-thai text-foreground">กลุ่มงานการแพทย์แผนไทยและสมุนไพร</h1>
              <p className="text-xs text-muted-foreground">สำนักงานสาธารณสุขจังหวัดพิษณุโลก</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* กล่องเล็กบอกสถานะ API AI มุมขวาบน (อัปเดตอัตโนมัติทุก 5 นาที) */}
            <a
              href="/admin/ai-settings"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-all shadow-xs group"
              title={`ใช้งานผู้ให้บริการ AI: ${activeApiStatus.name} (${activeApiStatus.model_name}) | อัปเดตล่าสุด: ${activeApiStatus.updatedAtText} น. (ระบบอัปเดตสถานะอัตโนมัติทุก 5 นาที)`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Cpu className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:rotate-12 transition-transform" />
              <span className="font-semibold">{activeApiStatus.name}</span>
              <span className="hidden sm:inline-block text-[10px] bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded-md font-mono">
                {activeApiStatus.model_name}
              </span>
            </a>

            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setSessionId(null); setInput(""); }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-md hover:bg-muted flex items-center gap-1"
              >
                <Home className="w-4 h-4" /> หน้าแรก
              </button>
            )}
            <a href="/herbs" className="text-sm text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-md hover:bg-muted">
              📖 สารานุกรม
            </a>
            <a href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-md hover:bg-muted">
              Admin
            </a>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 container max-w-4xl mx-auto px-4 py-6 overflow-y-auto">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center"
          >
            <motion.img
              src={herbalHero}
              alt="สมุนไพรไทย"
              className="w-48 h-48 object-contain mb-6"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            <h2 className="text-2xl font-bold font-thai text-foreground mb-2">สวัสดีครับ/ค่ะ 🙏</h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              ถามเรื่องสมุนไพรไทย, สรรพคุณ, วิธีใช้ หรือตรวจสอบ Drug-Herb Interaction พร้อมอ้างอิงแหล่งข้อมูลที่เชื่อถือได้
            </p>

            <div className="w-full max-w-2xl space-y-4">
              {suggestedCategories.map((cat, ci) => (
                <motion.div
                  key={ci}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + ci * 0.1 }}
                >
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <span>{cat.icon}</span> {cat.label}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {cat.questions.map((q, qi) => (
                      <button
                        key={qi}
                        onClick={() => { setInput(q); setTimeout(() => { const form = document.querySelector('form'); form?.requestSubmit(); }, 50); }}
                        className="text-left px-3 py-2 rounded-lg border border-border bg-card hover:shadow-herbal hover:border-primary/30 transition-all text-xs text-foreground hover:text-primary"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {messages.map((msg, idx) => {
                const isVerifiedResponse =
                  msg.role === "assistant" &&
                  (msg.content.includes("ผ่านการตรวจทานความถูกต้องโดยกลุ่มงานการแพทย์แผนไทยแล้ว") ||
                    msg.content.includes("Verified Clinical Knowledge"));
                const prevMsg = idx > 0 ? messages[idx - 1] : undefined;
                const questionText = prevMsg?.role === "user" ? prevMsg.content : "";
                const currentFeedback =
                  feedbackStates[msg.id] || getFeedbackForMessage(msg.id)?.feedback;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "gradient-herbal text-primary-foreground rounded-br-md"
                          : "bg-card border border-border shadow-sm rounded-bl-md"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none text-foreground">
                        {isVerifiedResponse && (
                          <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-xs font-medium not-prose">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>คำตอบนี้ผ่านการตรวจทานความถูกต้องโดยกลุ่มงานการแพทย์แผนไทยแล้ว</span>
                          </div>
                        )}
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ href, children }) => {
                              let targetUrl = href || "";
                              if (targetUrl.includes("ratchakitcha.soc.go.th")) {
                                const linkText =
                                  typeof children === "string"
                                    ? children
                                    : Array.isArray(children)
                                    ? children.map((c) => (typeof c === "string" ? c : "")).join("")
                                    : "";
                                const drugName = extractDrugNameFromKnowledge(linkText);
                                targetUrl = drugName
                                  ? `${window.location.origin}/herbs?name=${encodeURIComponent(drugName)}`
                                  : `${window.location.origin}/herbs`;
                              }
                              return (
                                <a
                                  href={targetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (targetUrl) openExternal(targetUrl);
                                  }}
                                  className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80 font-medium"
                                >
                                  <span>{children}</span>
                                  <ExternalLink className="w-3 h-3 inline-block shrink-0" />
                                </a>
                              );
                            },
                            table: ({ children }) => (
                              <div className="my-3 overflow-x-auto rounded-lg border border-primary/20 shadow-xs">
                                <table className="w-full text-left text-xs border-collapse">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-primary/10 text-primary border-b border-primary/20">
                                {children}
                              </thead>
                            ),
                            th: ({ children }) => (
                              <th className="px-3 py-2.5 font-semibold text-foreground font-thai whitespace-nowrap">
                                {children}
                              </th>
                            ),
                            tbody: ({ children }) => (
                              <tbody className="divide-y divide-border/60 bg-card/60">
                                {children}
                              </tbody>
                            ),
                            tr: ({ children }) => (
                              <tr className="hover:bg-primary/5 transition-colors">
                                {children}
                              </tr>
                            ),
                            td: ({ children }) => (
                              <td className="px-3 py-2.5 text-xs text-foreground/90 align-top">
                                {children}
                              </td>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                    {msg.role === "assistant" && (msg.category || msg.severity) && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {getCategoryLabel(msg.category)}
                        </span>
                        {getSeverityBadge(msg.severity)}
                      </div>
                    )}
                    {msg.role === "assistant" && msg.sources && (
                      ((msg.sources.pubmed && msg.sources.pubmed.length > 0) ||
                       (msg.sources.internal && msg.sources.internal.length > 0) ||
                       (msg.sources.thaijo && msg.sources.thaijo.length > 0) ||
                       (msg.sources.knowledge && msg.sources.knowledge.length > 0)) && (
                        <div className="mt-3 pt-3 border-t border-border/60 space-y-2.5">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <BookOpen className="w-3.5 h-3.5 text-primary" />
                            <span>แหล่งอ้างอิงที่ตรวจสอบได้</span>
                          </div>

                          {/* 1. ฐานข้อมูลภายใน (สมุนไพรเดี่ยว / ตำรับยาแผนไทย สสจ.พิษณุโลก) */}
                          {msg.sources.internal && msg.sources.internal.length > 0 && (
                            <div className="space-y-1.5">
                              {msg.sources.internal.map((s) => {
                                const url = `${window.location.origin}/herbs?${s.type}=${encodeURIComponent(s.name || s.id)}&name=${encodeURIComponent(s.name || "")}&id=${encodeURIComponent(s.id || "")}`;
                                return (
                                  <div
                                    key={`${s.type}-${s.id}`}
                                    className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg bg-primary/5 hover:bg-primary/10 border border-primary/15 transition-all"
                                  >
                                    <div className="flex items-start gap-2 min-w-0 flex-1">
                                      <Leaf className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                                      <div className="min-w-0">
                                        <span className="font-medium text-foreground">{s.name}</span>
                                        <span className="text-muted-foreground ml-1.5">
                                          — {s.type === "herb" ? "สมุนไพรเดี่ยว" : "ตำรับยาแผนไทย"}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        aria-label="คัดลอกลิงก์"
                                        title="คัดลอกลิงก์"
                                        onClick={() => copyLink(url)}
                                        className="p-1.5 rounded-md hover:bg-background text-muted-foreground transition-colors cursor-pointer"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openExternal(url)}
                                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-colors cursor-pointer"
                                        title="เปิดเอกสารข้อมูลสมุนไพร/ตำรับยา"
                                      >
                                        <span>เปิดเอกสาร</span>
                                        <ExternalLink className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* 2. งานวิจัยสากล PubMed */}
                          {msg.sources.pubmed && msg.sources.pubmed.length > 0 && (
                            <div className="space-y-1.5">
                              {msg.sources.pubmed.map((p) => {
                                const url = `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`;
                                return (
                                  <div
                                    key={p.pmid}
                                    className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg bg-muted/50 hover:bg-muted border border-border/40 transition-all"
                                  >
                                    <div className="flex items-start gap-2 min-w-0 flex-1">
                                      <FlaskConical className="w-3.5 h-3.5 text-herb-earth mt-0.5 shrink-0" />
                                      <div className="min-w-0">
                                        <span className="font-medium text-foreground line-clamp-1">{p.title}</span>
                                        <span className="text-muted-foreground block text-[11px] mt-0.5">
                                          {p.authors} · {p.journal} {p.year && `(${p.year})`} · PMID: {p.pmid}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        aria-label="คัดลอกลิงก์"
                                        title="คัดลอกลิงก์"
                                        onClick={() => copyLink(url)}
                                        className="p-1.5 rounded-md hover:bg-background text-muted-foreground transition-colors cursor-pointer"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openExternal(url)}
                                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-colors cursor-pointer"
                                        title="เปิดเอกสารงานวิจัย PubMed"
                                      >
                                        <span>เปิดเอกสาร</span>
                                        <ExternalLink className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* 3. งานวิจัยไทย ThaiJO */}
                          {msg.sources.thaijo && msg.sources.thaijo.length > 0 && (
                            <div className="space-y-1.5">
                              {msg.sources.thaijo.map((t) => (
                                <div
                                  key={t.url}
                                  className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg bg-herb-gold/10 hover:bg-herb-gold/20 border border-herb-gold/25 transition-all"
                                >
                                  <div className="flex items-start gap-2 min-w-0 flex-1">
                                    <BookOpen className="w-3.5 h-3.5 text-herb-gold mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                      <span className="font-medium text-foreground line-clamp-1">{t.title}</span>
                                      <span className="text-muted-foreground block text-[11px] mt-0.5">
                                        {t.authors ? `${t.authors} · ` : ""}{t.journal} {t.year && `(${t.year}) `}· งานวิจัยไทย (ThaiJO)
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      aria-label="คัดลอกลิงก์"
                                      title="คัดลอกลิงก์"
                                      onClick={() => copyLink(t.url)}
                                      className="p-1.5 rounded-md hover:bg-background text-muted-foreground transition-colors cursor-pointer"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openExternal(t.url)}
                                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-herb-gold/90 text-white hover:bg-herb-gold shadow-xs transition-colors cursor-pointer"
                                      title="เปิดเอกสารงานวิจัย ThaiJO"
                                    >
                                      <span>เปิดเอกสาร</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 4. เอกสารองค์ความรู้และคู่มือกระทรวงสาธารณสุข */}
                          {msg.sources.knowledge && msg.sources.knowledge.length > 0 && (
                            <div className="space-y-1.5">
                              {msg.sources.knowledge
                                .filter(
                                  (k) =>
                                    knowledgeSettings.enable_mahidol_ddi !== false ||
                                    (k.category !== "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)" &&
                                      !k.source?.includes("มหิดล") &&
                                      !k.source?.includes("ศูนย์ข้อมูลสมุนไพร") &&
                                      !k.title?.includes("มหิดล") &&
                                      !k.source_url?.includes("mahidol"))
                                )
                                .map((k) => (
                                <div
                                  key={k.id}
                                  className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 transition-all"
                                >
                                  <div className="flex items-start gap-2 min-w-0 flex-1">
                                    <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                      <span className="font-medium text-foreground line-clamp-1">{k.title}</span>
                                      <span className="text-muted-foreground block text-[11px] mt-0.5">
                                        {k.source || "คู่มือและแนวทางการแพทย์แผนไทย"} {k.category && `(${k.category})`}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {getKnowledgeLink(k) && (
                                      <button
                                        type="button"
                                        aria-label="คัดลอกลิงก์"
                                        title={isNlemKnowledge(k) ? "คัดลอกลิงก์ข้อมูลตัวยา" : "คัดลอกลิงก์"}
                                        onClick={() => copyLink(getKnowledgeLink(k))}
                                        className="p-1.5 rounded-md hover:bg-background text-muted-foreground transition-colors cursor-pointer"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleOpenKnowledge(k)}
                                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors cursor-pointer"
                                      title={isNlemKnowledge(k) ? "เปิดข้อมูลตัวยาที่ค้นหา" : "เปิดอ่านเอกสารองค์ความรู้"}
                                    >
                                      <span>เปิดเอกสาร</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* บล็อกแสดงรายการอ้างอิงตามมาตรฐาน APA 7th Edition พร้อมปุ่มเปิดเอกสารท้ายแต่ละรายการ (ซ่อนอ้างอิงฐานข้อมูลภายใน) */}
                          {((msg.sources?.pubmed && msg.sources.pubmed.length > 0) ||
                            (msg.sources?.thaijo && msg.sources.thaijo.length > 0) ||
                            (msg.sources?.knowledge && msg.sources.knowledge.length > 0)) && (
                            <div className="mt-2.5 pt-2.5 border-t border-border/40 bg-muted/40 p-2.5 rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                                  รูปแบบการอ้างอิง (APA 7th Edition)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const allApa = [
                                      ...(msg.sources?.pubmed || []).map(
                                        (p) => `${p.authors}. (${p.year || "n.d."}). ${p.title}. ${p.journal}. https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`
                                      ),
                                      ...(msg.sources?.thaijo || []).map(
                                        (t) => `${t.authors ? `${t.authors}. ` : ""}(${t.year || "ม.ป.ป."}). ${t.title}. ${t.journal}. ${t.url}`
                                      ),
                                      ...(msg.sources?.knowledge || [])
                                        .filter(
                                          (k) =>
                                            knowledgeSettings.enable_mahidol_ddi !== false ||
                                            (k.category !== "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)" &&
                                              !k.source?.includes("มหิดล") &&
                                              !k.source?.includes("ศูนย์ข้อมูลสมุนไพร") &&
                                              !k.title?.includes("มหิดล") &&
                                              !k.source_url?.includes("mahidol"))
                                        )
                                        .map((k) => {
                                          const docUrl = getKnowledgeLink(k);
                                          return `${k.source || "กรมการแพทย์แผนไทยและการแพทย์ทางเลือก"}. (2567). ${k.title}. กระทรวงสาธารณสุข.${docUrl ? ` ${docUrl}` : ""}`;
                                        }),
                                    ].join("\n\n");
                                    copyLink(allApa);
                                    toast.success("คัดลอกรายการอ้างอิง APA 7 ทั้งหมดแล้ว");
                                  }}
                                  className="text-[10px] text-primary hover:underline flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-primary/10 transition-colors cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" />
                                  คัดลอก APA 7
                                </button>
                              </div>
                              <div className="text-[11px] text-muted-foreground space-y-2 pl-0.5">
                              {(msg.sources?.pubmed || []).map((p) => {
                                const url = `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`;
                                return (
                                  <div
                                    key={`apa-pubmed-${p.pmid}`}
                                    className="p-2 rounded-md bg-background/70 border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                  >
                                    <p className="leading-relaxed flex-1">
                                      {p.authors}. ({p.year || "n.d."}). {p.title}. <em>{p.journal}</em>.{" "}
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          openExternal(url);
                                        }}
                                        className="text-primary hover:underline break-all"
                                      >
                                        {url}
                                      </a>
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => openExternal(url)}
                                      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0 self-end sm:self-auto cursor-pointer"
                                      title="เปิดเอกสารงานวิจัย PubMed"
                                    >
                                      <span>เปิดเอกสาร</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                );
                              })}
                              {(msg.sources?.thaijo || []).map((t, idx) => (
                                <div
                                  key={`apa-thaijo-${idx}`}
                                  className="p-2 rounded-md bg-background/70 border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                >
                                  <p className="leading-relaxed flex-1">
                                    {t.authors ? `${t.authors}. ` : ""}({t.year || "ม.ป.ป."}). {t.title}. <em>{t.journal}</em>.{" "}
                                    <a
                                      href={t.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        openExternal(t.url);
                                      }}
                                      className="text-primary hover:underline break-all"
                                    >
                                      {t.url}
                                    </a>
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => openExternal(t.url)}
                                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded bg-herb-gold/15 text-herb-gold hover:bg-herb-gold/25 transition-colors shrink-0 self-end sm:self-auto cursor-pointer"
                                    title="เปิดเอกสารงานวิจัย ThaiJO"
                                  >
                                    <span>เปิดเอกสาร</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ))}
                              {(msg.sources?.knowledge || [])
                                .filter(
                                  (k) =>
                                    knowledgeSettings.enable_mahidol_ddi !== false ||
                                    (k.category !== "อันตรกิริยาระหว่างยาและสมุนไพร (DDI)" &&
                                      !k.source?.includes("มหิดล") &&
                                      !k.source?.includes("ศูนย์ข้อมูลสมุนไพร") &&
                                      !k.title?.includes("มหิดล") &&
                                      !k.source_url?.includes("mahidol"))
                                )
                                .map((k) => {
                                const docUrl = getKnowledgeLink(k);
                                const isNlem = isNlemKnowledge(k);
                                return (
                                  <div
                                    key={`apa-knowledge-${k.id}`}
                                    className="p-2 rounded-md bg-background/70 border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                  >
                                    <p className="leading-relaxed flex-1">
                                      {k.source || "กรมการแพทย์แผนไทยและการแพทย์ทางเลือก"}. (2567). <em>{k.title}</em>. กระทรวงสาธารณสุข.
                                      {docUrl && (
                                        <>
                                          {" "}
                                          <a
                                            href={docUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              openExternal(docUrl);
                                            }}
                                            className="text-primary hover:underline break-all"
                                            title={isNlem ? "เปิดดูข้อมูลตัวยาในระบบ" : undefined}
                                          >
                                            {docUrl}
                                          </a>
                                        </>
                                      )}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenKnowledge(k)}
                                      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/25 transition-colors shrink-0 self-end sm:self-auto cursor-pointer"
                                      title={isNlem ? "เปิดข้อมูลตัวยาที่ค้นหา" : "เปิดอ่านเอกสารองค์ความรู้"}
                                    >
                                      <span>เปิดเอกสาร</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                );
                              })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    )}

                    {/* User Feedback Action Bar & Copy Button */}
                    {msg.role === "assistant" && (
                      <div className="flex items-center justify-between gap-2 pt-2 mt-3 border-t border-border/40 text-[11px] text-muted-foreground select-none flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground/80 hidden sm:inline">
                            คำตอบนี้มีประโยชน์หรือไม่?
                          </span>
                          <button
                            type="button"
                            onClick={() => handleThumbsUp(msg.id, questionText, msg.content)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors cursor-pointer text-[10px] ${
                              currentFeedback === "helpful"
                                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                            title="มีประโยชน์และถูกต้อง"
                          >
                            <ThumbsUp className="w-3 h-3" />
                            <span>มีประโยชน์</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleThumbsDown(msg.id, questionText, msg.content)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors cursor-pointer text-[10px] ${
                              currentFeedback === "unhelpful"
                                ? "bg-rose-500/20 text-rose-700 dark:text-rose-300 font-semibold"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                            title="ข้อมูลไม่ครบถ้วน หรือขอให้ผู้เชี่ยวชาญตรวจสอบ"
                          >
                            <ThumbsDown className="w-3 h-3" />
                            <span>ขอตรวจสอบ</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-auto">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.content, msg.id)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors cursor-pointer text-[10px] border border-border/50 ${
                              copiedMessageId === msg.id
                                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-medium"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground bg-background/50"
                            }`}
                            title="คัดลอกข้อความคำตอบ"
                          >
                            {copiedMessageId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>คัดลอกแล้ว</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>คัดลอก</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
                );
              })}
            </AnimatePresence>

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Leaf className="w-4 h-4 animate-pulse-soft text-primary" />
                    <span className="text-sm">
                      {loadingStage === 0
                        ? "กำลังค้นฐานข้อมูลสมุนไพร..."
                        : loadingStage === 1
                        ? "กำลังค้นงานวิจัยที่เกี่ยวข้อง..."
                        : loadingStage === 2
                        ? "กำลังเรียบเรียงคำตอบ..."
                        : "กำลังตรวจสอบความถูกต้องของคำตอบ..."}
                    </span>

                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-primary"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Emergency Banner */}
      <div className="border-t border-destructive/20 bg-destructive/5">
        <div className="container max-w-4xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-destructive">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>หากมีอาการไม่พึงประสงค์จากการใช้ยา ให้หยุดใช้ทันทีและติดต่อแพทย์</span>
          </div>
          <a
            href="tel:1669"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 transition-opacity"
          >
            <Phone className="w-3.5 h-3.5" />
            1669 ฉุกเฉิน
          </a>
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card/80 backdrop-blur-sm sticky bottom-0">
        <div className="container max-w-4xl mx-auto px-4 py-3">
          {(!knowledgeSettings.enable_internal_db || !knowledgeSettings.enable_external_research || !knowledgeSettings.enable_mahidol_ddi) && (
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
                <span>⚙️ สถานะแหล่งข้อมูล:</span>
                {!knowledgeSettings.enable_internal_db && <span className="line-through text-muted-foreground">ฐานข้อมูลในเว็บ</span>}
                {!knowledgeSettings.enable_internal_db && (!knowledgeSettings.enable_external_research || !knowledgeSettings.enable_mahidol_ddi) && <span>•</span>}
                {!knowledgeSettings.enable_mahidol_ddi && <span className="line-through text-muted-foreground">DDI ม.มหิดล</span>}
                {!knowledgeSettings.enable_mahidol_ddi && !knowledgeSettings.enable_external_research && <span>•</span>}
                {!knowledgeSettings.enable_external_research && <span className="line-through text-muted-foreground">งานวิจัยภายนอก/APA 7</span>}
                <a href="/admin" className="underline font-medium hover:text-foreground ml-1">ตั้งค่าในคลังความรู้</a>
              </span>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="ถามเรื่องสมุนไพร หรือ Drug-Herb Interaction..."
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-11 h-11 rounded-xl gradient-herbal text-primary-foreground flex items-center justify-center shadow-herbal hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-1 mt-2 text-[11px] text-muted-foreground">
            <span className="text-center sm:text-left">
              ⚕️ ข้อมูลนี้ไม่ใช่คำแนะนำทางการแพทย์ ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้ | อ้างอิงจากฐานข้อมูลที่เชื่อถือได้
            </span>
            <span className="font-mono text-[10px] bg-muted/60 px-2 py-0.5 rounded border border-border/50 text-muted-foreground shrink-0 select-none">
              V1.1 07092026
            </span>
          </div>
        </div>
      </div>

      {/* Dialog หน้าต่างอ่านเอกสารองค์ความรู้และคู่มือ สธ. ฉบับเต็ม */}
      <Dialog open={!!selectedKnowledgeDoc} onOpenChange={(open) => { if (!open) setSelectedKnowledgeDoc(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden border-border bg-card">
          <DialogHeader className="p-5 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <BookOpen className="w-4 h-4" />
              <span>เอกสารองค์ความรู้และแนวทางปฏิบัติ</span>
              {selectedKnowledgeDoc?.category && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] border border-emerald-500/20">
                  {selectedKnowledgeDoc.category}
                </span>
              )}
            </div>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground mt-1.5 leading-snug">
              {selectedKnowledgeDoc?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              แหล่งที่มา: {selectedKnowledgeDoc?.source || "กรมการแพทย์แผนไทยและการแพทย์ทางเลือก กระทรวงสาธารณสุข"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {fetchingKnowledgeContent ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Leaf className="w-6 h-6 animate-pulse-soft text-emerald-500" />
                <span className="text-xs">กำลังโหลดเนื้อหาเอกสาร...</span>
              </div>
            ) : selectedKnowledgeDoc?.content ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed">
                <ReactMarkdown>{selectedKnowledgeDoc.content}</ReactMarkdown>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-xs">
                <p>เอกสารฉบับนี้เป็นแนวทางมาตรฐานของการแพทย์แผนไทยและสาธารณสุข</p>
              </div>
            )}
          </div>

          <DialogFooter className="p-3 border-t border-border bg-muted/20 flex flex-row items-center justify-between gap-2 sm:justify-between">
            <div className="flex items-center gap-2">
              {selectedKnowledgeDoc?.content && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedKnowledgeDoc?.content) {
                      void copyLink(selectedKnowledgeDoc.content);
                      toast.success("คัดลอกเนื้อหาเอกสารแล้ว");
                    }
                  }}
                  className="text-xs gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกเนื้อหา</span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openExternal("https://dtam.moph.go.th/")}
                className="text-xs gap-1 hidden sm:inline-flex"
              >
                <span>เว็บกรมแพทย์แผนไทยฯ</span>
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setSelectedKnowledgeDoc(null)}
              className="text-xs"
            >
              ปิดหน้าต่าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ส่งข้อเสนอแนะและแจ้งขอตรวจสอบความถูกต้อง */}
      <Dialog open={!!feedbackModalMsg} onOpenChange={(open) => { if (!open) setFeedbackModalMsg(null); }}>
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <ThumbsDown className="w-4 h-4 text-rose-500" />
              <span>ขอให้ผู้เชี่ยวชาญตรวจสอบความถูกต้อง</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              คำถามและคำตอบนี้จะถูกส่งไปยังศูนย์ตรวจสอบความรู้ เพื่อให้เภสัชกรและแพทย์แผนไทยตรวจทานและปรับปรุงคำตอบให้ถูกต้อง
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 space-y-1">
              <span className="font-semibold block text-foreground">คำถาม: {feedbackModalMsg?.question}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-foreground block">ข้อเสนอแนะหรือข้อมูลที่ต้องการแก้ไข (ไม่บังคับ):</span>
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="เช่น ขนาดยายังไม่ชัดเจน, ข้อมูลไม่ครบถ้วน, มีข้อห้ามใช้เพิ่มเติม..."
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary font-thai"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setFeedbackModalMsg(null)} className="text-xs">
              ยกเลิก
            </Button>
            <Button size="sm" onClick={submitNegativeFeedback} className="text-xs gradient-herbal text-primary-foreground shadow-herbal">
              ส่งให้ผู้เชี่ยวชาญตรวจสอบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatPage;
