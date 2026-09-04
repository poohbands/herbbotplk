import { useState, useRef, useEffect } from "react";
import { Send, Leaf, AlertTriangle, Phone, ShieldAlert, Home, ExternalLink, BookOpen, FlaskConical, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import herbalHero from "@/assets/herbal-hero.png";
import { toast } from "sonner";

type PubMedSource = { pmid: string; title: string; authors: string; year: string; journal: string; pmcid?: string; doi?: string };
type ThaiJoSource = { title: string; authors: string; journal: string; url: string };
type ThaiRefSource = { name: string; org: string; url: string };
type KnowledgeSource = { id: string; title: string; category: string; source: string | null; source_url: string | null };
type InternalSource = { type: "herb" | "formula"; id: string; name: string };
type SourcesPayload = { pubmed: PubMedSource[]; internal: InternalSource[]; thaijo?: ThaiJoSource[]; thai_ref?: ThaiRefSource[]; knowledge?: KnowledgeSource[] };


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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    try {
      const allMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
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

      // Parse metadata and save
      const { cleanContent, category, severity, herbs, drugs, sources } = parseMetadata(assistantContent);

      // Update final message with clean content
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 && m.role === "assistant"
            ? { ...m, content: cleanContent, category, severity, sources }
            : m
        )
      );

      if (sid) {
        const flatSources = [
          ...(sources?.pubmed || []).map((p) => `PMID:${p.pmid}`),
          ...(sources?.internal || []).map((i) => `${i.type}:${i.id}`),
          ...(sources?.thaijo || []).map((t) => `thaijo:${t.url}`),
        ];
        saveMessage(sid, "assistant", cleanContent, { category, severity, herbs, drugs, sources: flatSources });
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
                              >
                                {children}
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
                      (msg.sources.pubmed?.length > 0 || msg.sources.internal?.length > 0 || msg.sources.thaijo?.length > 0 || msg.sources.thai_ref?.length > 0 || msg.sources.knowledge?.length > 0) && (
                        <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>แหล่งอ้างอิงที่ตรวจสอบได้</span>
                          </div>
                          {msg.sources.internal?.length > 0 && (
                            <div className="space-y-1">
                              {msg.sources.internal.map((s) => {
                                const url = `${window.location.origin}/herbs?${s.type}=${s.id}`;
                                return (
                                  <a
                                    key={`${s.type}-${s.id}`}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      openExternal(url);
                                    }}
                                    className="flex items-start gap-2 text-xs p-2 rounded-md bg-primary/5 hover:bg-primary/10 transition-colors group"
                                  >
                                    <Leaf className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                                    <span className="flex-1">
                                      <span className="font-medium text-foreground">{s.name}</span>
                                      <span className="text-muted-foreground ml-1">
                                        — {s.type === "herb" ? "สมุนไพร" : "ตำรับยาแผนไทย"} (ฐานข้อมูลภายใน)
                                      </span>
                                    </span>
                                    <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                  </a>
                                );
                              })}
                            </div>
                          )}
                          {msg.sources.pubmed?.length > 0 && (
                            <div className="space-y-1">
                              {msg.sources.pubmed.map((p) => {
                                const url = `https://europepmc.org/article/MED/${p.pmid}`;
                                const mirrors = [
                                  { label: "PubMed", href: `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/` },
                                  ...(p.pmcid ? [{ label: "ฉบับเต็ม (PMC)", href: `https://www.ncbi.nlm.nih.gov/pmc/articles/${p.pmcid}/` }] : []),
                                  ...(p.doi ? [{ label: "DOI", href: `https://doi.org/${p.doi}` }] : []),
                                ];
                                return (
                                  <div
                                    key={p.pmid}
                                    className="text-xs p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors group"
                                  >
                                    <div className="flex items-start gap-2">
                                      <FlaskConical className="w-3.5 h-3.5 text-herb-earth mt-0.5 shrink-0" />
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          openExternal(url);
                                        }}
                                        className="flex-1 min-w-0 text-left"
                                      >
                                        <span className="font-medium text-foreground line-clamp-2">{p.title}</span>
                                        <span className="text-muted-foreground block mt-0.5">
                                          {p.authors} · {p.journal} {p.year && `(${p.year})`} · PMID: {p.pmid}
                                        </span>
                                      </a>
                                      <button
                                        type="button"
                                        aria-label="คัดลอกลิงก์"
                                        title="คัดลอกลิงก์"
                                        onClick={() => copyLink(url)}
                                        className="shrink-0 p-1 rounded hover:bg-background/80 text-muted-foreground opacity-60 group-hover:opacity-100"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label="เปิดลิงก์ในแท็บใหม่"
                                        title="เปิดลิงก์ในแท็บใหม่ (Europe PMC)"
                                        onClick={() => openExternal(url)}
                                        className="shrink-0 p-1 rounded hover:bg-background/80 text-muted-foreground opacity-60 group-hover:opacity-100"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-1 pl-5 text-[11px] text-muted-foreground">
                                      <span>ลิงก์สำรอง:</span>
                                      {mirrors.map((m) => (
                                        <a
                                          key={m.label}
                                          href={m.href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            openExternal(m.href);
                                          }}
                                          className="underline underline-offset-2 hover:text-foreground"
                                        >
                                          {m.label}
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {msg.sources.thaijo?.length > 0 && (
                            <div className="space-y-1">
                              {msg.sources.thaijo.map((t) => (
                                <div
                                  key={t.url}
                                  className="flex items-start gap-2 text-xs p-2 rounded-md bg-herb-gold/10 hover:bg-herb-gold/20 transition-colors group"
                                >
                                  <BookOpen className="w-3.5 h-3.5 text-herb-gold mt-0.5 shrink-0" />
                                  <a
                                    href={t.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      openExternal(t.url);
                                    }}
                                    className="flex-1 min-w-0 text-left"
                                  >
                                    <span className="font-medium text-foreground line-clamp-2">{t.title}</span>
                                    <span className="text-muted-foreground block mt-0.5">
                                      {t.authors ? `${t.authors} · ` : ""}{t.journal} · งานวิจัยไทย (ThaiJO)
                                    </span>
                                  </a>
                                  <button
                                    type="button"
                                    aria-label="คัดลอกลิงก์"
                                    title="คัดลอกลิงก์"
                                    onClick={() => copyLink(t.url)}
                                    className="shrink-0 p-1 rounded hover:bg-background/80 text-muted-foreground opacity-60 group-hover:opacity-100"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label="เปิดลิงก์ในแท็บใหม่"
                                    title="เปิดลิงก์ในแท็บใหม่"
                                    onClick={() => openExternal(t.url)}
                                    className="shrink-0 p-1 rounded hover:bg-background/80 text-muted-foreground opacity-60 group-hover:opacity-100"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {msg.sources.thai_ref?.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[11px] font-medium text-muted-foreground pt-1">ค้นข้อมูลเรื่องนี้เพิ่มเติมจากแหล่งไทยที่น่าเชื่อถือ</p>
                              {msg.sources.thai_ref.map((r) => (
                                <div
                                  key={r.url}
                                  className="flex items-start gap-2 text-xs p-2 rounded-md bg-primary/5 hover:bg-primary/10 transition-colors group"
                                >
                                  <Leaf className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                                  <a
                                    href={r.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      openExternal(r.url);
                                    }}
                                    className="flex-1 min-w-0 text-left"
                                  >
                                    <span className="font-medium text-foreground line-clamp-2">{r.name}</span>
                                    <span className="text-muted-foreground block mt-0.5">{r.org}</span>
                                  </a>
                                  <button
                                    type="button"
                                    aria-label="คัดลอกลิงก์"
                                    title="คัดลอกลิงก์"
                                    onClick={() => copyLink(r.url)}
                                    className="shrink-0 p-1 rounded hover:bg-background/80 text-muted-foreground opacity-60 group-hover:opacity-100"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label="เปิดลิงก์ในแท็บใหม่"
                                    title="เปิดลิงก์ในแท็บใหม่"
                                    onClick={() => openExternal(r.url)}
                                    className="shrink-0 p-1 rounded hover:bg-background/80 text-muted-foreground opacity-60 group-hover:opacity-100"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {msg.sources.knowledge?.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[11px] font-medium text-muted-foreground pt-1">คลังความรู้ในระบบ</p>
                              {msg.sources.knowledge.map((k) => (
                                <div
                                  key={k.id}
                                  className="flex items-start gap-2 text-xs p-2 rounded-md bg-muted/50 group"
                                >
                                  <BookOpen className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    {k.source_url ? (
                                      <a
                                        href={k.source_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          openExternal(k.source_url!);
                                        }}
                                        className="font-medium text-foreground line-clamp-2 hover:underline"
                                      >
                                        {k.title}
                                      </a>
                                    ) : (
                                      <span className="font-medium text-foreground line-clamp-2">{k.title}</span>
                                    )}
                                    <span className="text-muted-foreground block mt-0.5">
                                      {k.source || "เอกสารภายในระบบ"}
                                    </span>
                                  </div>
                                  {k.source_url && (
                                    <>
                                      <button
                                        type="button"
                                        aria-label="คัดลอกลิงก์"
                                        title="คัดลอกลิงก์"
                                        onClick={() => copyLink(k.source_url!)}
                                        className="shrink-0 p-1 rounded hover:bg-background/80 text-muted-foreground opacity-60 group-hover:opacity-100"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label="เปิดลิงก์ในแท็บใหม่"
                                        title="เปิดลิงก์ในแท็บใหม่"
                                        onClick={() => openExternal(k.source_url!)}
                                        className="shrink-0 p-1 rounded hover:bg-background/80 text-muted-foreground opacity-60 group-hover:opacity-100"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}


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
    </div>
  );
};

export default ChatPage;
