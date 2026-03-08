import { useState, useRef, useEffect } from "react";
import { Send, Leaf, Pill, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import herbalHero from "@/assets/herbal-hero.png";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  category?: string;
  timestamp: Date;
};

const SAMPLE_QUESTIONS = [
  "ขมิ้นชันกินร่วมกับยา Warfarin ได้ไหม?",
  "ฟ้าทะลายโจรมีฤทธิ์อย่างไร?",
  "สมุนไพรอะไรช่วยลดน้ำตาลในเลือด?",
  "กระชายขาวมี drug interaction กับยาอะไรบ้าง?",
];

// Mock AI response for demo
const getMockResponse = (question: string): { content: string; category: string } => {
  if (question.includes("Warfarin") || question.includes("warfarin")) {
    return {
      content: `## ⚠️ ขมิ้นชัน × Warfarin\n\n**ระดับความเสี่ยง:** สูง\n\n**คำแนะนำ:**\nขมิ้นชัน (Curcumin) มีฤทธิ์ต้านการแข็งตัวของเลือด ซึ่งอาจเสริมฤทธิ์ของยา Warfarin ทำให้เกิดความเสี่ยงต่อ:\n\n- เลือดออกง่ายขึ้น\n- รอยฟกช้ำ\n- เลือดกำเดาไหล\n\n**ข้อแนะนำ:** ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้ร่วมกัน และควรตรวจค่า INR เป็นประจำ\n\n> *ข้อมูลนี้เป็นข้อมูลทั่วไป ไม่ใช่คำแนะนำทางการแพทย์*`,
      category: "drug-interaction",
    };
  }
  if (question.includes("ฟ้าทะลายโจร")) {
    return {
      content: `## 🌿 ฟ้าทะลายโจร (Andrographis paniculata)\n\n**สรรพคุณหลัก:**\n- ลดไข้ แก้หวัด\n- ต้านการอักเสบ\n- กระตุ้นภูมิคุ้มกัน\n- ต้านไวรัส\n\n**ขนาดที่แนะนำ:** 1-3 กรัม/วัน (ผงแห้ง)\n\n**ข้อควรระวัง:**\n- ไม่ควรใช้ในหญิงตั้งครรภ์\n- อาจมีปฏิกิริยากับยาลดความดันและยาต้านการแข็งตัวของเลือด\n\n> *ควรปรึกษาแพทย์ก่อนใช้*`,
      category: "herbal-info",
    };
  }
  if (question.includes("น้ำตาล")) {
    return {
      content: `## 🍃 สมุนไพรที่ช่วยลดน้ำตาลในเลือด\n\n1. **มะระขี้นก** — ช่วยกระตุ้นการหลั่งอินซูลิน\n2. **อบเชย** — ช่วยเพิ่มความไวต่ออินซูลิน\n3. **ขมิ้นชัน** — มีฤทธิ์ต้านการอักเสบและช่วยควบคุมน้ำตาล\n4. **ใบหม่อน** — ยับยั้งเอนไซม์ alpha-glucosidase\n\n**⚠️ ข้อควรระวัง:** หากใช้ยาลดน้ำตาลอยู่แล้ว ต้องระวังภาวะน้ำตาลต่ำ\n\n> *ปรึกษาแพทย์ก่อนใช้ร่วมกับยาแผนปัจจุบัน*`,
      category: "herbal-info",
    };
  }
  return {
    content: `## 🌿 ข้อมูลสมุนไพร\n\nขอบคุณสำหรับคำถามครับ/ค่ะ\n\nสำหรับคำถามเกี่ยวกับ "${question}" — ระบบกำลังประมวลผลข้อมูลจากฐานข้อมูลสมุนไพรไทย\n\n**คำแนะนำเบื้องต้น:**\n- ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้สมุนไพรร่วมกับยาแผนปัจจุบัน\n- ตรวจสอบ drug interaction ก่อนใช้เสมอ\n\n> *เชื่อมต่อ Lovable Cloud เพื่อใช้ AI ตอบคำถามแบบเต็มรูปแบบ*`,
    category: "general",
  };
};

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Simulate AI delay
    await new Promise((r) => setTimeout(r, 1200));
    const response = getMockResponse(userMsg.content);
    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: response.content,
      category: response.category,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, aiMsg]);
    setIsLoading(false);
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
              <h1 className="text-lg font-bold font-thai text-foreground">สมุนไพรAI</h1>
              <p className="text-xs text-muted-foreground">ที่ปรึกษาด้านยาสมุนไพรและ Drug Interaction</p>
            </div>
          </div>
          <a href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-md hover:bg-muted">
            Admin
          </a>
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
            <h2 className="text-2xl font-bold font-thai text-foreground mb-2">
              สวัสดีครับ/ค่ะ 🙏
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              ถามเรื่องสมุนไพรไทย, สรรพคุณ, วิธีใช้ หรือตรวจสอบปฏิกิริยาระหว่างยาสมุนไพรกับยาแผนปัจจุบัน
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
              {SAMPLE_QUESTIONS.map((q, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  onClick={() => {
                    setInput(q);
                  }}
                  className="text-left p-3 rounded-lg border border-border bg-card hover:shadow-herbal hover:border-primary/30 transition-all text-sm text-foreground group"
                >
                  <span className="flex items-start gap-2">
                    {q.includes("drug") || q.includes("Warfarin") || q.includes("interaction") ? (
                      <AlertTriangle className="w-4 h-4 text-herb-terracotta mt-0.5 shrink-0" />
                    ) : (
                      <Leaf className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    )}
                    <span className="group-hover:text-primary transition-colors">{q}</span>
                  </span>
                </motion.button>
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
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                    {msg.category && (
                      <div className="mt-2 flex items-center gap-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {msg.category === "drug-interaction" && "💊 Drug Interaction"}
                          {msg.category === "herbal-info" && "🌿 ข้อมูลสมุนไพร"}
                          {msg.category === "general" && "📋 ทั่วไป"}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Leaf className="w-4 h-4 animate-pulse-soft text-primary" />
                    <span className="text-sm">กำลังค้นหาข้อมูล...</span>
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

      {/* Input */}
      <div className="border-t border-border bg-card/80 backdrop-blur-sm sticky bottom-0">
        <div className="container max-w-4xl mx-auto px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-2"
          >
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="ถามเรื่องสมุนไพร หรือ Drug Interaction..."
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
            ⚠️ ข้อมูลนี้ไม่ใช่คำแนะนำทางการแพทย์ ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้ยาสมุนไพร
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
