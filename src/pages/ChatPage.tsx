import { useState, useRef, useEffect } from "react";
import { Send, Leaf, AlertTriangle, Phone, ShieldAlert, Home, ExternalLink, BookOpen, FlaskConical, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import herbalHero from "@/assets/herbal-hero.png";
import { toast } from "sonner";
import { processLocalChat, hasLocalProviderKey } from "@/lib/local-chat-service";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type PubMedSource = { pmid: string; title: string; authors: string; year: string; journal: string };
type ThaiJoSource = { title: string; authors: string; journal: string; url: string };
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
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (win) return;
  } catch {
    /* ignore */
  }
  try {
    // fallback: ใช้ anchor target=_blank (ไม่แตะ location ของหน้าปัจจุบัน)
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    void copyLink(url);
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleOpenKnowledge = async (k: KnowledgeSource) => {
    if (k.source_url && (k.source_url.startsWith("http://") || k.source_url.startsWith("https://"))) {
      openExternal(k.source_url);
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

      // 1. ถ้ามี Local Provider Key ที่ตั้งค่าไว้ ให้เรียกผ่าน Direct Local Service ทันที
      if (hasLocalProviderKey()) {
        let streamAssistant = "";
        const fullResponse = await processLocalChat(userContent, allMessages, (liveText) => {
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
        });

        const parsed = parseMetadata(fullResponse);
        cleanContent = parsed.cleanContent;
        category = parsed.category;
        severity = parsed.severity;
        sources = parsed.sources;

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
            body: JSON.stringify({ messages: allMessages }),
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
            category = parsed.category;
            severity = parsed.severity;
            sources = parsed.sources;

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
          cleanContent = `🌿 **ยินดีต้อนรับสู่ HerbBot PLK (หมอยาพิษณุโลก)!**\n\nขณะนี้ระบบทำงานใน **โหมดเครื่องส่วนตัว (Local Standalone Mode)** เนื่องจากฟังก์ชันบน Cloud หรือเครดิต Lovable ไม่พร้อมใช้งาน\n\n💡 **วิธีเปิดใช้งานให้หมอยาตอบคำถามได้ทันที (ฟรี):**\n1. ไปที่เมนู **[⚙️ ตั้งค่า AI](/admin/ai-settings)** (รหัสผ่านเข้าหน้า: \`sakura4923\`)\n2. รับ API Key ฟรีจาก **[Google AI Studio](https://aistudio.google.com/app/apikey)**\n3. นำคีย์มาวางในช่อง **Google Gemini** แล้วกด **"ทดสอบ"** และกด **"บันทึกการตั้งค่า"**\n\nเมื่อบันทึกแล้ว คุณสามารถพิมพ์ปรึกษาสรรพคุณสมุนไพรและตำรับยากับหมอยาพิษณุโลกได้ทันทีครับ! 🩺`;

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

  return (
    <div className="min-h-screen flex flex-col bg-background">
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
              {messages.map((msg) => (
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
                        <ReactMarkdown
                          components={{
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (href) openExternal(href);
                                }}
                                className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80 font-medium"
                              >
                                <span>{children}</span>
                                <ExternalLink className="w-3 h-3 inline-block shrink-0" />
                              </a>
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
                                const url = `${window.location.origin}/herbs?${s.type}=${encodeURIComponent(s.id)}`;
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
                                          — {s.type === "herb" ? "สมุนไพร" : "ตำรับยาแผนไทย"} (ฐานข้อมูล สสจ.พิษณุโลก)
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
                                        {t.authors ? `${t.authors} · ` : ""}{t.journal} · งานวิจัยไทย (ThaiJO)
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
                              {msg.sources.knowledge.map((k) => (
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
                                    {k.source_url && (
                                      <button
                                        type="button"
                                        aria-label="คัดลอกลิงก์"
                                        title="คัดลอกลิงก์"
                                        onClick={() => copyLink(k.source_url!)}
                                        className="p-1.5 rounded-md hover:bg-background text-muted-foreground transition-colors cursor-pointer"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleOpenKnowledge(k)}
                                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors cursor-pointer"
                                      title="เปิดอ่านเอกสารองค์ความรู้"
                                    >
                                      <span>เปิดเอกสาร</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* บล็อกแสดงรายการอ้างอิงตามมาตรฐาน APA 7th Edition พร้อมปุ่มเปิดเอกสารท้ายแต่ละรายการ */}
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
                                    ...(msg.sources?.internal || []).map((s) =>
                                      s.type === "herb"
                                        ? `สำนักงานสาธารณสุขจังหวัดพิษณุโลก. (2568). ฐานข้อมูลสมุนไพร: ${s.name}. กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก กระทรวงสาธารณสุข.`
                                        : `สำนักงานสาธารณสุขจังหวัดพิษณุโลก. (2568). ฐานข้อมูลตำรับยาแผนไทย: ${s.name}. กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก กระทรวงสาธารณสุข.`
                                    ),
                                    ...(msg.sources?.pubmed || []).map(
                                      (p) => `${p.authors}. (${p.year || "n.d."}). ${p.title}. ${p.journal}. https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`
                                    ),
                                    ...(msg.sources?.thaijo || []).map(
                                      (t) => `${t.authors ? `${t.authors}. ` : ""}(ม.ป.ป.). ${t.title}. ${t.journal}. ${t.url}`
                                    ),
                                    ...(msg.sources?.knowledge || []).map(
                                      (k) => `${k.source || "กรมการแพทย์แผนไทยและการแพทย์ทางเลือก"}. (2567). ${k.title}. กระทรวงสาธารณสุข.${k.source_url ? ` ${k.source_url}` : ""}`
                                    ),
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
                              {(msg.sources?.internal || []).map((s) => {
                                const url = `${window.location.origin}/herbs?${s.type}=${encodeURIComponent(s.id)}`;
                                return (
                                  <div
                                    key={`apa-internal-${s.id}`}
                                    className="p-2 rounded-md bg-background/70 border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                  >
                                    <p className="leading-relaxed flex-1">
                                      สำนักงานสาธารณสุขจังหวัดพิษณุโลก. (2568). <em>{s.type === "herb" ? "ฐานข้อมูลสมุนไพร" : "ฐานข้อมูลตำรับยาแผนไทย"}: {s.name}</em>. กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก กระทรวงสาธารณสุข.
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => openExternal(url)}
                                      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0 self-end sm:self-auto cursor-pointer"
                                      title="เปิดเอกสารข้อมูลสมุนไพร/ตำรับยา"
                                    >
                                      <span>เปิดเอกสาร</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                );
                              })}
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
                                    {t.authors ? `${t.authors}. ` : ""}(ม.ป.ป.). {t.title}. <em>{t.journal}</em>.{" "}
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
                              {(msg.sources?.knowledge || []).map((k) => (
                                <div
                                  key={`apa-knowledge-${k.id}`}
                                  className="p-2 rounded-md bg-background/70 border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                >
                                  <p className="leading-relaxed flex-1">
                                    {k.source || "กรมการแพทย์แผนไทยและการแพทย์ทางเลือก"}. (2567). <em>{k.title}</em>. กระทรวงสาธารณสุข.
                                    {k.source_url && (
                                      <>
                                        {" "}
                                        <a
                                          href={k.source_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            openExternal(k.source_url!);
                                          }}
                                          className="text-primary hover:underline break-all"
                                        >
                                          {k.source_url}
                                        </a>
                                      </>
                                    )}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenKnowledge(k)}
                                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/25 transition-colors shrink-0 self-end sm:self-auto cursor-pointer"
                                    title="เปิดอ่านเอกสารองค์ความรู้"
                                  >
                                    <span>เปิดเอกสาร</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </motion.div>
              ))}
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
          <p className="text-xs text-muted-foreground text-center mt-2">
            ⚕️ ข้อมูลนี้ไม่ใช่คำแนะนำทางการแพทย์ ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้ | อ้างอิงจากฐานข้อมูลที่เชื่อถือได้
          </p>
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
    </div>
  );
};

export default ChatPage;
