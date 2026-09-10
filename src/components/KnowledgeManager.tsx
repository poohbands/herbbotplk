import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, BookOpen, Search, ExternalLink, Globe, Database, Sparkles, ChevronDown, ChevronUp, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  getKnowledgeSettings,
  saveKnowledgeSettings,
  type KnowledgeSettings,
} from "@/lib/knowledge-settings";

type KnowledgeDoc = {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  source: string | null;
  source_url: string | null;
  is_published: boolean;
  updated_at: string;
};

const CATEGORIES = [
  { value: "guideline", label: "แนวทาง/นโยบาย" },
  { value: "article", label: "บทความ" },
  { value: "faq", label: "คำถามพบบ่อย" },
  { value: "research", label: "งานวิจัย" },
  { value: "protocol", label: "แนวปฏิบัติทางคลินิก" },
  { value: "other", label: "อื่น ๆ" },
];

const emptyForm = {
  id: "",
  title: "",
  category: "article",
  content: "",
  tags: "",
  source: "",
  source_url: "",
  is_published: true,
};

const KnowledgeManager = () => {
  const { toast } = useToast();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const [knowledgeSettings, setKnowledgeSettings] = useState<KnowledgeSettings>(() => getKnowledgeSettings());

  const handleToggleExternal = (checked: boolean) => {
    const updated = saveKnowledgeSettings({ enable_external_research: checked });
    setKnowledgeSettings(updated);
    toast({
      title: checked ? "เปิดการดึงงานวิจัยภายนอกและ APA 7 แล้ว" : "ปิดการดึงงานวิจัยภายนอกแล้ว",
      description: checked
        ? "AI จะค้นหางานวิจัยจาก PubMed และ ThaiJO พร้อมสร้างอ้างอิง APA 7 และตรวจสอบความถูกต้อง"
        : "AI จะไม่ดึงงานวิจัยจาก PubMed/ThaiJO มาประกอบคำตอบ",
    });
  };

  const handleToggleInternal = (checked: boolean) => {
    const updated = saveKnowledgeSettings({ enable_internal_db: checked });
    setKnowledgeSettings(updated);
    toast({
      title: checked ? "เปิดการใช้ฐานข้อมูลภายในเว็บแล้ว" : "ปิดการใช้ฐานข้อมูลภายในเว็บแล้ว",
      description: checked
        ? "AI จะใช้ข้อมูลสมุนไพรเดี่ยว ตำรับยาไทย และเอกสารความรู้ สสจ.พิษณุโลก"
        : "AI จะไม่ดึงข้อมูลจากฐานข้อมูลภายในเว็บ",
    });
  };

  const handleToggleMahidol = (checked: boolean) => {
    const updated = saveKnowledgeSettings({ enable_mahidol_ddi: checked });
    setKnowledgeSettings(updated);
    toast({
      title: checked
        ? "เปิดการใช้ฐานข้อมูลอันตรกิริยา ม.มหิดล แล้ว"
        : "ปิดการใช้ฐานข้อมูลอันตรกิริยา ม.มหิดล แล้ว",
      description: checked
        ? "AI จะใช้ข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน จากคณะเภสัชศาสตร์ ม.มหิดล พร้อมอ้างอิงลิงก์ตรง"
        : "AI จะไม่ดึงข้อมูลอันตรกิริยายาจาก ม.มหิดล มาประกอบคำตอบ",
    });
  };

  const handleToggleTu = (checked: boolean) => {
    const updated = saveKnowledgeSettings({ enable_tu_ddi: checked });
    setKnowledgeSettings(updated);
    toast({
      title: checked
        ? "เปิดการใช้ฐานข้อมูลอันตรกิริยา ม.ธรรมศาสตร์ แล้ว"
        : "ปิดการใช้ฐานข้อมูลอันตรกิริยา ม.ธรรมศาสตร์ แล้ว",
      description: checked
        ? "AI จะใช้ข้อมูลข้อควรระวังอันตรกิริยาระหว่างสมุนไพร/ตำรับยาไทยกับยาแผนปัจจุบัน จาก ศ. ดร.ภญ.อรุณพร อิฐรัตน์ ม.ธรรมศาสตร์ พร้อมอ้างอิง APA 7th Edition"
        : "AI จะไม่ดึงข้อมูลอันตรกิริยายาจาก ม.ธรรมศาสตร์ มาประกอบคำตอบ",
    });
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast({ title: "โหลดข้อมูลไม่สำเร็จ", description: error.message, variant: "destructive" });
    setDocs((data as KnowledgeDoc[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ ...emptyForm }); setOpen(true); };
  const openEdit = (d: KnowledgeDoc) => {
    setForm({
      id: d.id, title: d.title, category: d.category, content: d.content,
      tags: (d.tags || []).join(", "), source: d.source || "", source_url: d.source_url || "",
      is_published: d.is_published,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: "กรุณากรอกหัวข้อและเนื้อหา", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      category: form.category,
      content: form.content,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      source: form.source.trim() || null,
      source_url: form.source_url.trim() || null,
      is_published: form.is_published,
    };
    const { error } = form.id
      ? await supabase.from("knowledge_documents").update(payload).eq("id", form.id)
      : await supabase.from("knowledge_documents").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "บันทึกไม่สำเร็จ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: form.id ? "อัปเดตเรียบร้อย" : "เพิ่มความรู้ใหม่แล้ว" });
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("ยืนยันการลบเอกสารความรู้นี้?")) return;
    const { error } = await supabase.from("knowledge_documents").delete().eq("id", id);
    if (error) return toast({ title: "ลบไม่สำเร็จ", description: error.message, variant: "destructive" });
    toast({ title: "ลบเรียบร้อย" });
    load();
  };

  const togglePublish = async (d: KnowledgeDoc) => {
    const { error } = await supabase
      .from("knowledge_documents")
      .update({ is_published: !d.is_published })
      .eq("id", d.id);
    if (error) return toast({ title: "อัปเดตสถานะไม่สำเร็จ", variant: "destructive" });
    load();
  };

  const filtered = docs.filter((d) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      d.title.toLowerCase().includes(q) ||
      d.content.toLowerCase().includes(q) ||
      (d.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-primary/20 p-5 shadow-herbal"
    >
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold font-thai text-foreground flex items-center gap-2">
              คลังความรู้ (Knowledge Base)
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                {docs.length} รายการ
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isExpanded
                ? "คลิกเพื่อย่อปิดคลังความรู้"
                : "คลิกเพื่อขยายดูรายละเอียดคลังความรู้ จัดการเอกสาร และตั้งค่าแหล่งข้อมูล AI"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {isExpanded && (
            <Button onClick={openNew} size="sm" className="gap-1.5 h-8 text-xs">
              <Plus className="w-3.5 h-3.5" /> เพิ่มความรู้ใหม่
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 text-xs gap-1.5 font-thai border-primary/30 text-primary hover:bg-primary/10"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                ย่อคลังความรู้
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                ขยายคลังความรู้
              </>
            )}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden pt-5"
          >
      {/* กล่องเมนูเปิด-ปิดแหล่งข้อมูลสำหรับ AI (External APA 7 & Internal DB) */}
      <div className="bg-muted/40 rounded-xl border border-border p-4 mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold font-thai text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              การควบคุมแหล่งข้อมูลสำหรับ AI (AI Data Source & APA 7 Settings)
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              กำหนดให้ระบบ AI ดึงข้อมูลจากภายนอกหรือภายในเว็บในการตอบคำถาม พร้อมระบบตรวจสอบความถูกต้อง
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* เมนูที่ 1: แหล่งข้อมูลวิจัยภายนอก (PubMed & ThaiJO) + อ้างอิง APA 7 */}
          <div
            className={`p-3.5 rounded-lg border transition-all ${
              knowledgeSettings.enable_external_research
                ? "bg-card border-primary/30 shadow-xs"
                : "bg-card/50 border-border opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <Globe
                    className={`w-4 h-4 ${
                      knowledgeSettings.enable_external_research
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                  <span className="text-sm font-medium text-foreground font-thai">
                    1. งานวิจัยภายนอกและอ้างอิง APA 7
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ดึงงานวิจัยสากล (PubMed) และงานวิจัยไทย (ThaiJO) มาประกอบการตอบ พร้อมสร้างเอกสารอ้างอิงตามมาตรฐาน APA 7th Edition และตรวจสอบความถูกต้องตรงประเด็น
                </p>
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <Badge
                    variant={
                      knowledgeSettings.enable_external_research
                        ? "default"
                        : "secondary"
                    }
                    className="text-[10px] px-1.5 py-0"
                  >
                    {knowledgeSettings.enable_external_research
                      ? "เปิดใช้งาน"
                      : "ปิดใช้งาน"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    PubMed
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    ThaiJO
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    APA 7th
                  </Badge>
                </div>
              </div>
              <Switch
                checked={knowledgeSettings.enable_external_research}
                onCheckedChange={handleToggleExternal}
                aria-label="เปิด-ปิดการดึงข้อมูลวิจัยภายนอกและอ้างอิง APA 7"
              />
            </div>
          </div>

          {/* เมนูที่ 2: ฐานข้อมูลภายในเว็บ */}
          <div
            className={`p-3.5 rounded-lg border transition-all ${
              knowledgeSettings.enable_internal_db
                ? "bg-card border-primary/30 shadow-xs"
                : "bg-card/50 border-border opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <Database
                    className={`w-4 h-4 ${
                      knowledgeSettings.enable_internal_db
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                  <span className="text-sm font-medium text-foreground font-thai">
                    2. ฐานข้อมูลภายในเว็บ (Internal DB)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ดึงข้อมูลสมุนไพรเดี่ยว, ตำรับยาไทย, ข้อบ่งใช้, ขนาดใช้, ข้อควรระวัง และคลังความรู้ภายในระบบ สสจ.พิษณุโลก มาใช้ตอบคำถาม
                </p>
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <Badge
                    variant={
                      knowledgeSettings.enable_internal_db
                        ? "default"
                        : "secondary"
                    }
                    className="text-[10px] px-1.5 py-0"
                  >
                    {knowledgeSettings.enable_internal_db
                      ? "เปิดใช้งาน"
                      : "ปิดใช้งาน"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    สมุนไพรเดี่ยว
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    ตำรับยาไทย
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    เอกสาร สสจ.
                  </Badge>
                </div>
              </div>
              <Switch
                checked={knowledgeSettings.enable_internal_db}
                onCheckedChange={handleToggleInternal}
                aria-label="เปิด-ปิดการใช้ฐานข้อมูลภายในเว็บ"
              />
            </div>
          </div>

          {/* เมนูที่ 3: ฐานข้อมูลอันตรกิริยายา คณะเภสัชศาสตร์ มหาวิทยาลัยมหิดล */}
          <div
            className={`p-3.5 rounded-lg border transition-all ${
              knowledgeSettings.enable_mahidol_ddi
                ? "bg-card border-primary/30 shadow-xs"
                : "bg-card/50 border-border opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <BookOpen
                    className={`w-4 h-4 ${
                      knowledgeSettings.enable_mahidol_ddi
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                  <span className="text-sm font-medium text-foreground font-thai">
                    3. อันตรกิริยาระหว่างยา ม.มหิดล (Herb-Drug Interaction)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ฐานข้อมูลอันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ มหาวิทยาลัยมหิดล ระดับความรุนแรง และข้อแนะนำทางการแพทย์
                </p>
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <Badge
                    variant={
                      knowledgeSettings.enable_mahidol_ddi
                        ? "default"
                        : "secondary"
                    }
                    className="text-[10px] px-1.5 py-0"
                  >
                    {knowledgeSettings.enable_mahidol_ddi
                      ? "เปิดใช้งาน"
                      : "ปิดใช้งาน"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    ม.มหิดล
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    DDI Database
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    ลิงก์อ้างอิงตรง
                  </Badge>
                </div>
              </div>
              <Switch
                checked={knowledgeSettings.enable_mahidol_ddi}
                onCheckedChange={handleToggleMahidol}
                aria-label="เปิด-ปิดฐานข้อมูลอันตรกิริยายา ม.มหิดล"
              />
            </div>
          </div>

          {/* เมนูที่ 4: ฐานข้อมูลอันตรกิริยายา ม.ธรรมศาสตร์ (ศ. ดร.ภญ.อรุณพร อิฐรัตน์) */}
          <div
            className={`p-3.5 rounded-lg border transition-all ${
              knowledgeSettings.enable_tu_ddi
                ? "bg-card border-primary/30 shadow-xs"
                : "bg-card/50 border-border opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <GraduationCap
                    className={`w-4 h-4 ${
                      knowledgeSettings.enable_tu_ddi
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                  <span className="text-sm font-medium text-foreground font-thai">
                    4. อันตรกิริยาระหว่างยา ม.ธรรมศาสตร์ (Herb-Drug Interaction)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ฐานข้อมูลข้อควรระวังอันตรกิริยาระหว่างสมุนไพร/ตำรับยาไทยกับยาแผนปัจจุบัน ผลงานวิชาการของ ศ. ดร.ภญ.อรุณพร อิฐรัตน์ สถานการแพทย์แผนไทยประยุกต์ คณะแพทยศาสตร์ ม.ธรรมศาสตร์ พร้อมอ้างอิง APA 7th Edition
                </p>
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <Badge
                    variant={
                      knowledgeSettings.enable_tu_ddi
                        ? "default"
                        : "secondary"
                    }
                    className="text-[10px] px-1.5 py-0"
                  >
                    {knowledgeSettings.enable_tu_ddi
                      ? "เปิดใช้งาน"
                      : "ปิดใช้งาน"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    ม.ธรรมศาสตร์
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    DDI Database
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    ศ. ดร.ภญ.อรุณพร อิฐรัตน์
                  </Badge>
                </div>
              </div>
              <Switch
                checked={knowledgeSettings.enable_tu_ddi}
                onCheckedChange={handleToggleTu}
                aria-label="เปิด-ปิดฐานข้อมูลอันตรกิริยายา ม.ธรรมศาสตร์"
              />
            </div>
          </div>
        </div>

        {!knowledgeSettings.enable_external_research &&
          !knowledgeSettings.enable_internal_db &&
          !knowledgeSettings.enable_mahidol_ddi &&
          !knowledgeSettings.enable_tu_ddi && (
            <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-md flex items-center gap-1.5">
              ⚠️ คุณกำลังปิดทุกแหล่งข้อมูล AI จะตอบด้วยความรู้ทั่วไปและแนวทาง 10 กลุ่มอาการของกระทรวงสาธารณสุขเท่านั้น
            </div>
          )}
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
        <Input
          placeholder="ค้นหาจากหัวข้อ เนื้อหา หรือแท็ก..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">กำลังโหลด...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          ยังไม่มีเอกสารความรู้ — กด "เพิ่มความรู้ใหม่" เพื่อเริ่มต้น
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <div key={d.id} className="border border-border rounded-lg p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-semibold text-foreground font-thai">{d.title}</h4>
                    <Badge variant="outline" className="text-xs">
                      {CATEGORIES.find((c) => c.value === d.category)?.label || d.category}
                    </Badge>
                    {!d.is_published && (
                      <Badge variant="secondary" className="text-xs">ยังไม่เผยแพร่</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                    {d.content}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(d.tags || []).slice(0, 6).map((t) => (
                      <span key={t} className="text-xs bg-muted px-2 py-0.5 rounded">#{t}</span>
                    ))}
                  </div>
                  {d.source && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      แหล่งอ้างอิง: {d.source}
                      {d.source_url && (
                        <a href={d.source_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Switch checked={d.is_published} onCheckedChange={() => togglePublish(d)} />
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(d)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(d.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-thai">
              {form.id ? "แก้ไขเอกสารความรู้" : "เพิ่มเอกสารความรู้ใหม่"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>หัวข้อ *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>หมวดหมู่</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch
                  checked={form.is_published}
                  onCheckedChange={(v) => setForm({ ...form, is_published: v })}
                />
                <Label className="mb-0">เผยแพร่ให้ AI ใช้ตอบ</Label>
              </div>
            </div>
            <div>
              <Label>เนื้อหา * (รองรับ Markdown)</Label>
              <Textarea
                rows={12}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="เขียนเนื้อหาความรู้ที่ต้องการให้ AI ใช้ตอบ..."
              />
            </div>
            <div>
              <Label>แท็ก (คั่นด้วยจุลภาค)</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="เช่น ฟ้าทะลายโจร, ไข้หวัด, สรรพคุณ"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>แหล่งอ้างอิง</Label>
                <Input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="เช่น กรมการแพทย์แผนไทยฯ"
                />
              </div>
              <div>
                <Label>URL แหล่งอ้างอิง</Label>
                <Input
                  value={form.source_url}
                  onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={save} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default KnowledgeManager;
