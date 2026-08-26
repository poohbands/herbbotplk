import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Upload, FileText, Sparkles, Save, Trash2, History, RotateCcw,
  Download, Loader2, ClipboardPaste, CheckCircle2, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";

type AnyRow = Record<string, any>;
type Extracted = { herbs: AnyRow[]; formulas: AnyRow[]; knowledge: AnyRow[] };
type Stats = { chunks: number; names_found: number; names_extracted: number; missing: string[]; truncated?: boolean };
type Source = { file_path?: string; file_name?: string; text?: string };

type ImportJob = {
  id: string;
  file_name: string;
  status: string;
  committed_count: number;
  error: string | null;
  created_at: string;
};

type DataVersion = {
  id: string;
  label: string;
  note: string | null;
  herbs_count: number;
  formulas_count: number;
  knowledge_count: number;
  created_at: string;
};

const TEXT_FIELDS: Record<string, string[]> = {
  herbs: ["name_thai", "name_english", "name_scientific", "family", "category", "dosage", "usage_instructions"],
  formulas: ["name_thai", "name_english", "formula_code", "category", "indication", "preparation", "dosage", "usage_instructions"],
  knowledge: ["title", "category", "source", "source_url"],
};
const LONG_FIELDS: Record<string, string[]> = {
  herbs: ["description"],
  formulas: [],
  knowledge: ["content"],
};
const ARRAY_FIELDS: Record<string, string[]> = {
  herbs: ["local_names", "properties", "precautions", "contraindications", "drug_interactions"],
  formulas: ["ingredients", "properties", "precautions", "contraindications", "drug_interactions"],
  knowledge: ["tags"],
};

const LABELS: Record<string, string> = {
  name_thai: "ชื่อไทย", name_english: "ชื่ออังกฤษ", name_scientific: "ชื่อวิทยาศาสตร์",
  family: "วงศ์", category: "หมวดหมู่", dosage: "ขนาดใช้", usage_instructions: "วิธีใช้",
  description: "รายละเอียด", local_names: "ชื่อท้องถิ่น", properties: "สรรพคุณ",
  precautions: "ข้อควรระวัง", contraindications: "ข้อห้ามใช้", drug_interactions: "ปฏิกิริยากับยาแผนปัจจุบัน",
  formula_code: "รหัสตำรับ", indication: "ข้อบ่งใช้", preparation: "วิธีเตรียม", ingredients: "ส่วนประกอบ",
  title: "หัวข้อ", content: "เนื้อหา", tags: "แท็ก", source: "แหล่งอ้างอิง", source_url: "URL อ้างอิง",
};

const GROUP_LABELS: Record<string, string> = {
  herbs: "สมุนไพรเดี่ยว", formulas: "ตำรับยาแผนไทย", knowledge: "คลังความรู้",
};

const CSV_TEMPLATE =
  "name_thai,name_english,name_scientific,category,description,properties,dosage,usage_instructions,precautions,contraindications,drug_interactions\n" +
  "ฟ้าทะลายโจร,Andrographis,Andrographis paniculata,สมุนไพรเดี่ยว,ใช้บรรเทาอาการหวัด,\"แก้ไข้|แก้เจ็บคอ\",1500 mg/วัน,รับประทานหลังอาหาร,\"ห้ามใช้เกิน 7 วัน\",\"หญิงตั้งครรภ์\",\"warfarin|ยาลดความดัน\"\n";

const getSafeFileExtension = (fileName: string) => {
  const match = fileName.match(/\.([a-zA-Z0-9]{1,12})$/);
  return match ? `.${match[1].toLowerCase()}` : "";
};

const createImportStoragePath = (fileName: string) => {
  const randomId = Math.random().toString(36).slice(2, 10);
  return `imports/${Date.now()}-${randomId}${getSafeFileExtension(fileName)}`;
};

const DataImporter = () => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [pasted, setPasted] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [data, setData] = useState<Extracted | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [versions, setVersions] = useState<DataVersion[]>([]);

  const loadMeta = async () => {
    const [j, v] = await Promise.all([
      supabase.from("import_jobs").select("*").order("created_at", { ascending: false }).limit(15),
      supabase.from("data_versions").select("id,label,note,herbs_count,formulas_count,knowledge_count,created_at").order("created_at", { ascending: false }).limit(20),
    ]);
    setJobs((j.data as ImportJob[]) || []);
    setVersions((v.data as DataVersion[]) || []);
  };

  useEffect(() => { loadMeta(); }, []);

  const mergeStats = (list: (Stats | undefined)[]): Stats => ({
    chunks: list.reduce((a, s) => a + (s?.chunks || 0), 0),
    names_found: list.reduce((a, s) => a + (s?.names_found || 0), 0),
    names_extracted: list.reduce((a, s) => a + (s?.names_extracted || 0), 0),
    missing: Array.from(new Set(list.flatMap((s) => s?.missing || []))),
    truncated: list.some((s) => s?.truncated),
  });

  const setResult = (id: string | null, res: Extracted) => {
    setJobId(id);
    setData(res);
    const sel: Record<string, boolean> = {};
    (["herbs", "formulas", "knowledge"] as const).forEach((g) =>
      (res[g] || []).forEach((_, i) => { sel[`${g}-${i}`] = true; }),
    );
    setSelected(sel);
  };

  const callFn = async (body: AnyRow) => {
    const { data: res, error } = await supabase.functions.invoke("import-drug-data", { body });
    if (error) {
      let msg = error.message;
      try {
        const ctx: any = (error as any).context;
        if (ctx?.json) msg = (await ctx.json())?.error || msg;
        else if (ctx?.text) msg = JSON.parse(await ctx.text())?.error || msg;
      } catch { /* keep default */ }
      throw new Error(msg);
    }
    if ((res as any)?.error) throw new Error((res as any).error);
    return res as any;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const all: Extracted = { herbs: [], formulas: [], knowledge: [] };
    const srcs: Source[] = [];
    const statList: (Stats | undefined)[] = [];
    let lastJob: string | null = null;
    try {
      for (const file of Array.from(files)) {
        setProgress(`กำลังอัปโหลด ${file.name}...`);
        const path = createImportStoragePath(file.name);
        const { error: upErr } = await supabase.storage.from("imports").upload(path, file);
        if (upErr) throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ: ${upErr.message}`);
        setProgress(`AI กำลังอ่าน ${file.name}...`);
        const res = await callFn({ action: "extract", file_path: path, file_name: file.name });
        lastJob = res.job_id;
        srcs.push({ file_path: path, file_name: file.name });
        statList.push(res.extracted?.stats);
        all.herbs.push(...(res.extracted?.herbs || []));
        all.formulas.push(...(res.extracted?.formulas || []));
        all.knowledge.push(...(res.extracted?.knowledge || []));
      }
      setSources(srcs);
      setStats(mergeStats(statList));
      setResult(lastJob, all);
      toast({ title: "อ่านเอกสารสำเร็จ", description: `พบ ${all.herbs.length + all.formulas.length + all.knowledge.length} รายการ — กรุณาตรวจทานก่อนบันทึก` });
    } catch (e: any) {
      toast({ title: "ประมวลผลไม่สำเร็จ", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false); setProgress(""); loadMeta();
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handlePaste = async () => {
    if (!pasted.trim()) return toast({ title: "กรุณาวางข้อความก่อน", variant: "destructive" });
    setBusy(true); setProgress("AI กำลังแยกข้อมูลจากข้อความ...");
    try {
      const res = await callFn({ action: "extract", text: pasted, file_name: "ข้อความที่วาง" });
      setSources([{ text: pasted }]);
      setStats(res.extracted?.stats || null);
      setResult(res.job_id, res.extracted);
      toast({ title: "แยกข้อมูลสำเร็จ", description: "กรุณาตรวจทานก่อนบันทึก" });
    } catch (e: any) {
      toast({ title: "ประมวลผลไม่สำเร็จ", description: e.message, variant: "destructive" });
    } finally { setBusy(false); setProgress(""); loadMeta(); }
  };

  const retryMissing = async () => {
    if (!stats?.missing?.length || !sources.length) return;
    setBusy(true); setProgress(`กำลังดึงรายการที่ขาด ${stats.missing.length} รายการ...`);
    try {
      const merged: Extracted = {
        herbs: [...(data?.herbs || [])],
        formulas: [...(data?.formulas || [])],
        knowledge: [...(data?.knowledge || [])],
      };
      const statList: (Stats | undefined)[] = [];
      for (const src of sources) {
        const res = await callFn({ action: "extract", ...src, only_names: stats.missing });
        const ex = res.extracted || {};
        const known = new Set(
          [...merged.herbs, ...merged.formulas].map((r) => String(r.name_thai || "").replace(/\s+/g, "")),
        );
        merged.herbs.push(...(ex.herbs || []).filter((r: AnyRow) => !known.has(String(r.name_thai || "").replace(/\s+/g, ""))));
        merged.formulas.push(...(ex.formulas || []).filter((r: AnyRow) => !known.has(String(r.name_thai || "").replace(/\s+/g, ""))));
        statList.push(ex.stats);
      }
      const gotNames = new Set(
        [...merged.herbs, ...merged.formulas].map((r) => String(r.name_thai || "").replace(/\s+/g, "")),
      );
      setResult(jobId, merged);
      setStats({
        ...stats,
        names_extracted: merged.herbs.length + merged.formulas.length,
        missing: stats.missing.filter((n) => !gotNames.has(n.replace(/\s+/g, ""))),
      });
      toast({ title: "ดึงข้อมูลรอบเพิ่มเติมเสร็จแล้ว" });
    } catch (e: any) {
      toast({ title: "ดึงข้อมูลไม่สำเร็จ", description: e.message, variant: "destructive" });
    } finally { setBusy(false); setProgress(""); }
  };

  const updateField = (group: keyof Extracted, idx: number, field: string, value: any) => {
    setData((d) => {
      if (!d) return d;
      const copy = { ...d, [group]: [...d[group]] };
      copy[group][idx] = { ...copy[group][idx], [field]: value };
      return copy;
    });
  };

  const removeItem = (group: keyof Extracted, idx: number) => {
    setData((d) => (d ? { ...d, [group]: d[group].filter((_, i) => i !== idx) } : d));
  };

  const commit = async () => {
    if (!data) return;
    const pick = (g: keyof Extracted) => data[g].filter((_, i) => selected[`${g}-${i}`] !== false);
    const payload = { herbs: pick("herbs"), formulas: pick("formulas"), knowledge: pick("knowledge") };
    const total = payload.herbs.length + payload.formulas.length + payload.knowledge.length;
    if (!total) return toast({ title: "ยังไม่ได้เลือกรายการใด", variant: "destructive" });
    setBusy(true); setProgress("กำลังบันทึกลงฐานข้อมูล...");
    try {
      const res = await callFn({ action: "commit", job_id: jobId, ...payload, create_version: true });
      toast({
        title: "บันทึกสำเร็จ",
        description: `เพิ่มใหม่ ${res.summary.inserted} · อัปเดต ${res.summary.updated} · ข้าม ${res.summary.skipped} รายการ`,
      });
      setData(null); setJobId(null); setStats(null); setSources([]);
    } catch (e: any) {
      toast({ title: "บันทึกไม่สำเร็จ", description: e.message, variant: "destructive" });
    } finally { setBusy(false); setProgress(""); loadMeta(); }
  };

  const makeVersion = async () => {
    setBusy(true);
    try {
      await callFn({ action: "snapshot", note: "สร้างโดยผู้ดูแลระบบ" });
      toast({ title: "สร้างเวอร์ชันสำรองแล้ว" });
    } catch (e: any) {
      toast({ title: "สร้างเวอร์ชันไม่สำเร็จ", description: e.message, variant: "destructive" });
    } finally { setBusy(false); loadMeta(); }
  };

  const restoreVersion = async (v: DataVersion) => {
    if (!confirm(`ย้อนฐานข้อมูลกลับไปเป็น "${v.label}"?\nระบบจะสำรองข้อมูลปัจจุบันไว้ให้อัตโนมัติ`)) return;
    setBusy(true); setProgress("กำลังย้อนข้อมูล...");
    try {
      const res = await callFn({ action: "restore", version_id: v.id });
      toast({ title: "ย้อนข้อมูลสำเร็จ", description: `สมุนไพร ${res.restored.herbs} · ตำรับ ${res.restored.formulas} · ความรู้ ${res.restored.knowledge}` });
    } catch (e: any) {
      toast({ title: "ย้อนข้อมูลไม่สำเร็จ", description: e.message, variant: "destructive" });
    } finally { setBusy(false); setProgress(""); loadMeta(); }
  };

  const deleteVersion = async (id: string) => {
    if (!confirm("ลบเวอร์ชันนี้?")) return;
    await supabase.from("data_versions").delete().eq("id", id);
    loadMeta();
  };

  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF" + CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "herb-import-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const renderItem = (group: keyof Extracted, item: AnyRow, idx: number) => {
    const key = `${group}-${idx}`;
    const title = item.name_thai || item.title || "(ไม่มีชื่อ)";
    return (
      <AccordionItem key={key} value={key} className="border border-border rounded-lg px-3 mb-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selected[key] !== false}
            onCheckedChange={(c) => setSelected((s) => ({ ...s, [key]: !!c }))}
          />
          <AccordionTrigger className="flex-1 hover:no-underline">
            <span className="text-sm font-thai text-foreground text-left">{title}</span>
          </AccordionTrigger>
          <Button size="icon" variant="ghost" onClick={() => removeItem(group, idx)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
        <AccordionContent className="space-y-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEXT_FIELDS[group].map((f) => (
              <div key={f}>
                <Label className="text-xs">{LABELS[f] || f}</Label>
                <Input value={item[f] ?? ""} onChange={(e) => updateField(group, idx, f, e.target.value)} />
              </div>
            ))}
          </div>
          {LONG_FIELDS[group].map((f) => (
            <div key={f}>
              <Label className="text-xs">{LABELS[f] || f}</Label>
              <Textarea rows={group === "knowledge" ? 8 : 3} value={item[f] ?? ""} onChange={(e) => updateField(group, idx, f, e.target.value)} />
            </div>
          ))}
          {ARRAY_FIELDS[group].map((f) => (
            <div key={f}>
              <Label className="text-xs">{LABELS[f] || f} (คั่นด้วยจุลภาค)</Label>
              <Textarea
                rows={2}
                value={Array.isArray(item[f]) ? item[f].join(", ") : (item[f] ?? "")}
                onChange={(e) => updateField(group, idx, f, e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
              />
            </div>
          ))}
        </AccordionContent>
      </AccordionItem>
    );
  };

  const totalFound = data ? data.herbs.length + data.formulas.length + data.knowledge.length : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-primary/20 p-5 shadow-herbal"
    >
      <div className="flex items-start justify-between gap-3 mb-4 flex-col sm:flex-row">
        <div>
          <h3 className="text-base font-semibold font-thai text-foreground flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            นำเข้าข้อมูลยา (AI Import)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            แนบไฟล์ PDF / Word / Excel / CSV / รูปภาพ แล้วให้ AI แยกข้อมูลเป็นสมุนไพร ตำรับยา และคลังความรู้ ก่อนตรวจทานและบันทึก
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
          <Download className="w-4 h-4" /> เทมเพลต CSV
        </Button>
      </div>

      <Tabs defaultValue="file">
        <TabsList>
          <TabsTrigger value="file">แนบไฟล์</TabsTrigger>
          <TabsTrigger value="text">วางข้อความ</TabsTrigger>
          <TabsTrigger value="versions">เวอร์ชัน & ประวัติ</TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="pt-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-primary/30 rounded-xl p-8 text-center cursor-pointer hover:border-primary/60 transition-colors"
          >
            <FileText className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-thai text-foreground">ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์</p>
            <p className="text-xs text-muted-foreground mt-1">รองรับ .pdf .docx .xlsx .csv .txt .md .jpg .png (เลือกได้หลายไฟล์)</p>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        </TabsContent>

        <TabsContent value="text" className="pt-4 space-y-3">
          <Textarea
            rows={8}
            placeholder="วางเนื้อหาข้อมูลยา/สมุนไพรที่ต้องการนำเข้า..."
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <Button onClick={handlePaste} disabled={busy} className="gap-2">
            <ClipboardPaste className="w-4 h-4" /> ให้ AI แยกข้อมูล
          </Button>
        </TabsContent>

        <TabsContent value="versions" className="pt-4 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold font-thai flex items-center gap-2">
                <History className="w-4 h-4 text-primary" /> เวอร์ชันฐานข้อมูลยา
              </h4>
              <Button size="sm" variant="outline" onClick={makeVersion} disabled={busy}>
                สร้างเวอร์ชันตอนนี้
              </Button>
            </div>
            {versions.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">ยังไม่มีเวอร์ชันที่บันทึกไว้</p>
            ) : (
              <div className="space-y-2">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 border border-border rounded-lg p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-thai text-foreground truncate">{v.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleString("th-TH")} · สมุนไพร {v.herbs_count} · ตำรับ {v.formulas_count} · ความรู้ {v.knowledge_count}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="gap-1" disabled={busy} onClick={() => restoreVersion(v)}>
                        <RotateCcw className="w-3 h-3" /> ย้อนกลับ
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteVersion(v.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold font-thai mb-2">ประวัติการนำเข้า</h4>
            {jobs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">ยังไม่มีประวัติ</p>
            ) : (
              <div className="space-y-2">
                {jobs.map((j) => (
                  <div key={j.id} className="flex items-center justify-between gap-3 text-xs border border-border rounded-lg p-3">
                    <div className="min-w-0">
                      <p className="text-foreground truncate font-thai">{j.file_name}</p>
                      <p className="text-muted-foreground">{new Date(j.created_at).toLocaleString("th-TH")}</p>
                      {j.error && <p className="text-destructive mt-1">{j.error}</p>}
                    </div>
                    <Badge variant={j.status === "committed" ? "default" : j.status === "failed" ? "destructive" : "secondary"} className="shrink-0 gap-1">
                      {j.status === "committed" ? <CheckCircle2 className="w-3 h-3" /> : j.status === "failed" ? <XCircle className="w-3 h-3" /> : null}
                      {j.status === "committed" ? `บันทึกแล้ว ${j.committed_count}` : j.status === "failed" ? "ล้มเหลว" : j.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {busy && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
          <Loader2 className="w-4 h-4 animate-spin" /> {progress || "กำลังทำงาน..."}
        </div>
      )}

      {data && (
        <div className="mt-6 border-t border-border pt-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h4 className="text-sm font-semibold font-thai flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> ตรวจทานข้อมูลก่อนบันทึก ({totalFound} รายการ)
            </h4>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setData(null); setJobId(null); setStats(null); setSources([]); }}>ยกเลิก</Button>
              <Button size="sm" onClick={commit} disabled={busy} className="gap-2">
                <Save className="w-4 h-4" /> บันทึกลงฐานข้อมูล
              </Button>
            </div>
          </div>

          {stats && (
            <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-xs font-thai space-y-2">
              <p className="text-muted-foreground">
                อ่านเอกสาร {stats.chunks} ส่วน · ตรวจพบชื่อยา {stats.names_found} รายการ · ดึงรายละเอียดได้ {stats.names_extracted} รายการ
                {stats.truncated ? " · เอกสารยาวมาก อาจอ่านไม่ครบทุกส่วน" : ""}
              </p>
              {stats.missing.length > 0 && (
                <div className="space-y-2">
                  <p className="text-destructive">
                    ยังขาด {stats.missing.length} รายการ: {stats.missing.join(", ")}
                  </p>
                  <Button size="sm" variant="outline" onClick={retryMissing} disabled={busy} className="gap-2">
                    <RotateCcw className="w-3.5 h-3.5" /> ดึงข้อมูลรายการที่ขาดอีกครั้ง
                  </Button>
                </div>
              )}
            </div>
          )}

          {(["herbs", "formulas", "knowledge"] as const).map((g) =>
            data[g].length ? (
              <div key={g} className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {GROUP_LABELS[g]} ({data[g].length})
                </p>
                <Accordion type="multiple">{data[g].map((item, i) => renderItem(g, item, i))}</Accordion>
              </div>
            ) : null,
          )}
        </div>
      )}
    </motion.div>
  );
};

export default DataImporter;
