import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, BookOpen, Search, ExternalLink } from "lucide-react";
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold font-thai text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            คลังความรู้ (Knowledge Base)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            เพิ่ม/แก้ไขเอกสารความรู้ที่ระบบ AI จะดึงมาใช้ตอบผู้ใช้อัตโนมัติ
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> เพิ่มความรู้ใหม่
        </Button>
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
