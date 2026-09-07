import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Search, Leaf, ArrowLeft, AlertTriangle, Pill, X, BookOpen, Shield, FlaskConical, Beaker } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { HERBS_97_DATA } from "@/lib/herbs97-service";
import { useMaintenanceMode } from "@/lib/maintenance-service";
import MaintenanceOverlay from "@/components/MaintenanceOverlay";
import AdminMaintenanceBanner from "@/components/AdminMaintenanceBanner";

type Herb = {
  id: string;
  name_thai: string;
  name_english: string | null;
  name_scientific: string | null;
  local_names: string[] | null;
  family: string | null;
  description: string | null;
  properties: string[] | null;
  usage_instructions: string | null;
  dosage: string | null;
  precautions: string[] | null;
  contraindications: string[] | null;
  drug_interactions: string[] | null;
  image_url: string | null;
  category: string | null;
  is_in_nlem: boolean;
};

type Formula = {
  id: string;
  herb97_id?: string;
  name_thai: string;
  name_english: string | null;
  formula_code: string | null;
  category: string | null;
  is_in_nlem: boolean;
  indication: string | null;
  ingredients: string[] | null;
  preparation: string | null;
  dosage: string | null;
  usage_instructions: string | null;
  precautions: string[] | null;
  contraindications: string[] | null;
  drug_interactions: string[] | null;
  properties: string[] | null;
  references?: string | null;
  evidence_level?: string | null;
};

const HERB_CATEGORIES = ["ทั้งหมด", "สมุนไพรในบัญชียาหลัก", "สมุนไพรเครื่องเทศ", "สมุนไพรลดน้ำตาล"];
const FORMULA_CATEGORIES = ["ทั้งหมด", "ตำรับยาหอม", "ตำรับยาแก้ไข้", "ตำรับยาแก้ท้อง", "ตำรับยาสตรี", "ตำรับยาบำรุง", "ตำรับยาระบาย", "ตำรับยาแก้ไอ"];

/** ฟังก์ชันถอดรหัส URL พารามิเตอร์อย่างปลอดภัย (รองรับ single & double encoding) */
const safeDecode = (val: string | null | undefined): string => {
  if (!val) return "";
  try {
    let decoded = decodeURIComponent(val.trim());
    if (decoded.includes("%")) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch {}
    }
    return decoded.trim();
  } catch {
    return (val || "").trim();
  }
};

/** ฟังก์ชันทำความสะอาดชื่อภาษาไทยเพื่อใช้เปรียบเทียบ */
const cleanThai = (s: string): string =>
  s
    .toLowerCase()
    .replace(/^(ยา)?(น้ำมัน|สเปรย์|ทา|ขี้ผึ้ง)?(สารสกัด(จาก)?)?/, "")
    .replace(/[\s\-_,()\/\\:.\[\]]+/g, "")
    .trim();

/** ฟังก์ชันสกัดคีย์เวิร์ดสำคัญ (เช่น อัตราส่วน 1:1, 20:1 และคำสำคัญ) */
const extractTokens = (s: string): string[] => {
  const lower = s.toLowerCase();
  const tokens: string[] = [];

  const ratios = lower.match(/\d+:\d+/g);
  if (ratios) tokens.push(...ratios);

  const words = lower
    .replace(/\d+:\d+/g, " ")
    .split(/[\s\-_,()\/\\:.\[\]]+/)
    .map((w) => cleanThai(w) || w)
    .filter((w) => w.length >= 2);

  tokens.push(...words);
  return Array.from(new Set(tokens.filter(Boolean)));
};

/** เตรียมข้อมูลเริ่มต้นจาก 97 รายการในหน่วยความจำทันที (ไม่ต้องรอ Supabase เพื่อให้เปิด Modal ได้ทันที 100%) */
const INITIAL_FORMULAS: Formula[] = HERBS_97_DATA.map((h) => ({
  id: h.id,
  herb97_id: h.id,
  name_thai: h.name,
  name_english: null,
  formula_code: `NLEM-${String(h.index).padStart(3, "0")}`,
  category: h.category || "ตำรับยาแผนไทย",
  is_in_nlem: true,
  indication: h.indication || null,
  ingredients: h.ingredients ? [h.ingredients] : [],
  preparation: h.dosage_form || null,
  dosage: h.dosage_usage || null,
  usage_instructions: h.dosage_usage || null,
  precautions: h.precautions_contraindications ? [h.precautions_contraindications] : [],
  contraindications: [],
  drug_interactions: h.drug_interaction ? [h.drug_interaction] : [],
  properties: [],
  references: h.references || null,
  evidence_level: h.evidence_level || null,
}));

const HerbsPage = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<"herbs" | "formulas">("herbs");
  const [herbs, setHerbs] = useState<Herb[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>(INITIAL_FORMULAS);
  const [filtered, setFiltered] = useState<Herb[]>([]);
  const [filteredFormulas, setFilteredFormulas] = useState<Formula[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ทั้งหมด");
  const [selectedHerb, setSelectedHerb] = useState<Herb | null>(null);
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHerbs();
    loadFormulas();
  }, []);

  const handleCloseModal = () => {
    setSelectedHerb(null);
    setSelectedFormula(null);
    if (window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  // Auto-open modal if URL has ?herb=... or ?formula=... or ?name=... or ?id=... or ?q=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const herbParam = safeDecode(params.get("herb"));
    const formulaParam = safeDecode(params.get("formula"));
    const nameParam = safeDecode(params.get("name"));
    const idParam = safeDecode(params.get("id") || params.get("q"));

    const rawTarget = nameParam || formulaParam || herbParam || idParam;
    if (!rawTarget) return;

    const target = rawTarget.toLowerCase();
    const normTarget = cleanThai(rawTarget);

    // ตรวจสอบว่า target, formulaParam, herbParam หรือ idParam ตรงกับรายการใน HERBS_97_DATA หรือไม่
    const direct97 = HERBS_97_DATA.find((h) => {
      const hid = h.id.toLowerCase();
      return (
        hid === target ||
        (idParam && hid === idParam.toLowerCase()) ||
        (formulaParam && hid === formulaParam.toLowerCase()) ||
        (herbParam && hid === herbParam.toLowerCase()) ||
        h.name.toLowerCase() === target ||
        cleanThai(h.name) === normTarget
      );
    });

    const tokens = extractTokens(rawTarget);

    const matchFormula = (f: Formula): boolean => {
      const fid = f.id.toLowerCase();
      const fHerb97Id = (f.herb97_id || "").toLowerCase();
      const fName = f.name_thai.toLowerCase();
      const normF = cleanThai(f.name_thai);

      // 1. Direct ID / Herb97 ID match
      if (idParam && (fid === idParam.toLowerCase() || fHerb97Id === idParam.toLowerCase())) return true;
      if (formulaParam && (fid === formulaParam.toLowerCase() || fHerb97Id === formulaParam.toLowerCase())) return true;
      if (direct97 && (fHerb97Id === direct97.id.toLowerCase() || fid === direct97.id.toLowerCase() || normF === cleanThai(direct97.name))) return true;

      // 2. Exact name match
      if (nameParam && (fName === nameParam.toLowerCase() || normF === cleanThai(nameParam))) return true;
      if (formulaParam && (fName === formulaParam.toLowerCase() || normF === cleanThai(formulaParam))) return true;
      if (fName === target || normF === normTarget) return true;
      if (f.name_english && f.name_english.toLowerCase() === target) return true;

      // 3. Substring containment match (เมื่อความยาวอักขระ >= 3)
      if (normTarget.length >= 3 && (normF.includes(normTarget) || normTarget.includes(normF))) return true;

      // 4. Token matching (เช่น คำค้นกัญชา THC:CBD 1:1 หรือ 20:1)
      if (tokens.length >= 2 && tokens.every((t) => normF.includes(cleanThai(t)) || fName.includes(t.toLowerCase()))) return true;

      return false;
    };

    const matchHerb = (h: Herb): boolean => {
      const hid = h.id.toLowerCase();
      const hName = h.name_thai.toLowerCase();
      const normH = cleanThai(h.name_thai);

      // 1. Direct ID match
      if (idParam && hid === idParam.toLowerCase()) return true;
      if (herbParam && hid === herbParam.toLowerCase()) return true;

      // 2. Exact name match
      if (nameParam && (hName === nameParam.toLowerCase() || normH === cleanThai(nameParam))) return true;
      if (herbParam && (hName === herbParam.toLowerCase() || normH === cleanThai(herbParam))) return true;
      if (hName === target || normH === normTarget) return true;
      if (h.name_english && h.name_english.toLowerCase() === target) return true;
      if (h.name_scientific && h.name_scientific.toLowerCase() === target) return true;

      // 3. Local names
      if (h.local_names?.some((ln) => {
        const normLn = cleanThai(ln);
        return normLn === normTarget || (normTarget.length >= 3 && normLn.includes(normTarget));
      })) return true;

      // 4. Substring containment match
      if (normTarget.length >= 3 && (normH.includes(normTarget) || normTarget.includes(normH))) return true;

      // 5. Token matching
      if (tokens.length >= 2 && tokens.every((t) => normH.includes(cleanThai(t)) || hName.includes(t.toLowerCase()))) return true;

      return false;
    };

    // ลำดับการค้นหาตาม Intent ของพารามิเตอร์:
    // A. ถ้ามี formulaParam หรือระบุว่าเป็นตำรับยาจาก direct97 -> ค้นหาใน formulas ก่อน
    if (formulaParam || direct97) {
      const foundF = formulas.find(matchFormula);
      if (foundF) {
        setActiveTab("formulas");
        setSelectedFormula(foundF);
        return;
      }
      const foundH = herbs.find(matchHerb);
      if (foundH) {
        setActiveTab("herbs");
        setSelectedHerb(foundH);
        return;
      }
    }

    // B. ถ้ามี herbParam -> ค้นหาใน herbs ก่อน
    if (herbParam) {
      const foundH = herbs.find(matchHerb);
      if (foundH) {
        setActiveTab("herbs");
        setSelectedHerb(foundH);
        return;
      }
      const foundF = formulas.find(matchFormula);
      if (foundF) {
        setActiveTab("formulas");
        setSelectedFormula(foundF);
        return;
      }
    }

    // C. กรณีมีเฉพาะ nameParam หรือ idParam หรือค้นหาทั่วไป:
    const foundFormula = formulas.find(matchFormula);
    if (foundFormula) {
      setActiveTab("formulas");
      setSelectedFormula(foundFormula);
      return;
    }

    const foundHerb = herbs.find(matchHerb);
    if (foundHerb) {
      setActiveTab("herbs");
      setSelectedHerb(foundHerb);
      return;
    }
  }, [herbs, formulas, location.search]);

  useEffect(() => {
    setCategory("ทั้งหมด");
    setSearch("");
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "herbs") {
      let result = herbs;
      if (category !== "ทั้งหมด") result = result.filter((h) => h.category === category);
      if (search.trim()) {
        const q = search.toLowerCase();
        result = result.filter(
          (h) =>
            h.name_thai.toLowerCase().includes(q) ||
            h.name_english?.toLowerCase().includes(q) ||
            h.name_scientific?.toLowerCase().includes(q) ||
            h.local_names?.some((n) => n.toLowerCase().includes(q)) ||
            h.properties?.some((p) => p.toLowerCase().includes(q))
        );
      }
      setFiltered(result);
    } else {
      let result = formulas;
      if (category !== "ทั้งหมด") result = result.filter((f) => f.category === category);
      if (search.trim()) {
        const q = search.toLowerCase();
        result = result.filter(
          (f) =>
            f.name_thai.toLowerCase().includes(q) ||
            f.name_english?.toLowerCase().includes(q) ||
            f.indication?.toLowerCase().includes(q) ||
            f.ingredients?.some((i) => i.toLowerCase().includes(q)) ||
            f.properties?.some((p) => p.toLowerCase().includes(q))
        );
      }
      setFilteredFormulas(result);
    }
  }, [herbs, formulas, search, category, activeTab]);

  const loadHerbs = async () => {
    try {
      const { data, error } = await supabase.from("herbs").select("*").order("name_thai");
      if (!error && data) setHerbs(data as Herb[]);
    } catch (e) {
      console.error("loadHerbs error:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadFormulas = async () => {
    try {
      const { data, error } = await supabase.from("thai_formulas").select("*").order("name_thai");
      if (error) {
        console.error("Error loading formulas from supabase:", error);
        return;
      }
      const dbFormulas = (data || []) as Formula[];

      const mappedDbFormulas: Formula[] = dbFormulas.map((df) => {
        const match97 = HERBS_97_DATA.find(
          (h) => h.name.trim() === df.name_thai.trim() || cleanThai(h.name) === cleanThai(df.name_thai)
        );
        return {
          ...df,
          herb97_id: match97?.id,
          references: match97?.references || (df as any).references || null,
          evidence_level: match97?.evidence_level || (df as any).evidence_level || null,
        };
      });

      const existingNames = new Set(mappedDbFormulas.map((f) => f.name_thai.trim()));
      const existingHerb97Ids = new Set(
        mappedDbFormulas.map((f) => f.herb97_id).filter(Boolean)
      );

      const additionalFormulas: Formula[] = HERBS_97_DATA
        .filter((h) => !existingNames.has(h.name.trim()) && !existingHerb97Ids.has(h.id))
        .map((h) => ({
          id: h.id,
          herb97_id: h.id,
          name_thai: h.name,
          name_english: null,
          formula_code: `NLEM-${String(h.index).padStart(3, "0")}`,
          category: h.category || "ตำรับยาแผนไทย",
          is_in_nlem: true,
          indication: h.indication || null,
          ingredients: h.ingredients ? [h.ingredients] : [],
          preparation: h.dosage_form || null,
          dosage: h.dosage_usage || null,
          usage_instructions: h.dosage_usage || null,
          precautions: h.precautions_contraindications ? [h.precautions_contraindications] : [],
          contraindications: [],
          drug_interactions: h.drug_interaction ? [h.drug_interaction] : [],
          properties: [],
          references: h.references || null,
          evidence_level: h.evidence_level || null,
        }));

      setFormulas([...mappedDbFormulas, ...additionalFormulas]);
    } catch (e) {
      console.error("loadFormulas error:", e);
    }
  };

  const categories = activeTab === "herbs" ? HERB_CATEGORIES : FORMULA_CATEGORIES;
  const count = activeTab === "herbs" ? filtered.length : filteredFormulas.length;

  const { isMaintenance, message: maintenanceMsg, isAdmin } = useMaintenanceMode();

  if (isMaintenance && !isAdmin) {
    return <MaintenanceOverlay message={maintenanceMsg} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminMaintenanceBanner />
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="container max-w-6xl mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full gradient-herbal flex items-center justify-center shadow-herbal">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-thai text-foreground">สารานุกรมสมุนไพรไทย</h1>
              <p className="text-xs text-muted-foreground">ฐานข้อมูลสมุนไพรและตำรับยาแผนไทย</p>
            </div>
          </div>
          <a href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-muted">
            <ArrowLeft className="w-4 h-4" /> กลับหน้าแชท
          </a>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setActiveTab("herbs")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === "herbs"
                ? "gradient-herbal text-primary-foreground shadow-herbal"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Leaf className="w-4 h-4" /> สมุนไพรเดี่ยว
          </button>
          <button
            onClick={() => setActiveTab("formulas")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === "formulas"
                ? "gradient-herbal text-primary-foreground shadow-herbal"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <FlaskConical className="w-4 h-4" /> ตำรับยาแผนไทย
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={activeTab === "herbs" ? "ค้นหาสมุนไพร ชื่อไทย ชื่อวิทยาศาสตร์ สรรพคุณ..." : "ค้นหาตำรับยา ส่วนประกอบ สรรพคุณ..."}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  category === cat
                    ? "gradient-herbal text-primary-foreground shadow-herbal"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          พบ {count} รายการ {search && `สำหรับ "${search}"`}
        </p>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Leaf className="w-8 h-8 text-primary animate-pulse-soft" />
          </div>
        ) : activeTab === "herbs" ? (
          /* Herbs Grid */
          filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Search className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-thai text-foreground">ไม่พบสมุนไพรที่ค้นหา</p>
              <p className="text-sm text-muted-foreground">ลองค้นหาด้วยคำอื่น</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((herb, i) => (
                <motion.div
                  key={herb.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedHerb(herb)}
                  className="bg-card rounded-xl border border-border shadow-sm hover:shadow-herbal hover:border-primary/30 transition-all cursor-pointer group overflow-hidden"
                >
                  {herb.image_url && (
                    <div className="h-40 bg-muted/30 flex items-center justify-center p-4 overflow-hidden">
                      <img src={herb.image_url} alt={herb.name_thai} className="h-full w-auto object-contain group-hover:scale-105 transition-transform" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold font-thai text-foreground group-hover:text-primary transition-colors">{herb.name_thai}</h3>
                        <p className="text-xs text-muted-foreground italic">{herb.name_scientific}</p>
                      </div>
                      {herb.is_in_nlem && (
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full gradient-herbal text-primary-foreground font-medium">บัญชียาหลัก</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{herb.description}</p>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {herb.properties?.slice(0, 3).map((p, j) => (
                        <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{p}</span>
                      ))}
                      {(herb.properties?.length || 0) > 3 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">+{(herb.properties?.length || 0) - 3}</span>
                      )}
                    </div>
                    {herb.drug_interactions && herb.drug_interactions.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 text-[10px] text-herb-terracotta">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{herb.drug_interactions.length} drug interaction(s)</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : (
          /* Formulas Grid */
          filteredFormulas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Search className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-thai text-foreground">ไม่พบตำรับยาที่ค้นหา</p>
              <p className="text-sm text-muted-foreground">ลองค้นหาด้วยคำอื่น</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFormulas.map((formula, i) => (
                <motion.div
                  key={formula.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedFormula(formula)}
                  className="bg-card rounded-xl border border-border shadow-sm hover:shadow-herbal hover:border-primary/30 transition-all cursor-pointer group p-5"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Beaker className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold font-thai text-foreground group-hover:text-primary transition-colors text-sm">{formula.name_thai}</h3>
                        <p className="text-[10px] text-muted-foreground italic">{formula.name_english}</p>
                      </div>
                    </div>
                    {formula.is_in_nlem && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full gradient-herbal text-primary-foreground font-medium">บัญชียาหลัก</span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{formula.indication}</p>

                  <div className="text-[10px] text-muted-foreground mb-2">
                    <span className="font-medium text-foreground">ส่วนประกอบ:</span> {formula.ingredients?.slice(0, 4).join(", ")}
                    {(formula.ingredients?.length || 0) > 4 && ` +${(formula.ingredients?.length || 0) - 4} อย่าง`}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {formula.properties?.slice(0, 3).map((p, j) => (
                      <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{p}</span>
                    ))}
                  </div>

                  {formula.category && (
                    <div className="mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{formula.category}</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Herb Detail Modal */}
      <AnimatePresence>
        {selectedHerb && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-start justify-center p-4 pt-10 overflow-y-auto"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.97 }}
              className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-2xl mb-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                {selectedHerb.image_url && (
                  <div className="h-48 bg-muted/30 flex items-center justify-center rounded-t-2xl">
                    <img src={selectedHerb.image_url} alt={selectedHerb.name_thai} className="h-full w-auto object-contain" />
                  </div>
                )}
                <button onClick={handleCloseModal} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold font-thai text-foreground">{selectedHerb.name_thai}</h2>
                    {selectedHerb.is_in_nlem && <span className="text-xs px-2 py-0.5 rounded-full gradient-herbal text-primary-foreground font-medium">บัญชียาหลักแห่งชาติ</span>}
                  </div>
                  <p className="text-sm text-muted-foreground italic">{selectedHerb.name_scientific}</p>
                  {selectedHerb.name_english && <p className="text-sm text-muted-foreground">({selectedHerb.name_english})</p>}
                  {selectedHerb.local_names && selectedHerb.local_names.length > 0 && <p className="text-xs text-muted-foreground mt-1">ชื่อท้องถิ่น: {selectedHerb.local_names.join(", ")}</p>}
                  {selectedHerb.family && <p className="text-xs text-muted-foreground">วงศ์: {selectedHerb.family}</p>}
                </div>
                <p className="text-sm text-foreground leading-relaxed">{selectedHerb.description}</p>
                {selectedHerb.properties && selectedHerb.properties.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><Leaf className="w-4 h-4 text-primary" /> สรรพคุณ</h4>
                    <div className="flex flex-wrap gap-1.5">{selectedHerb.properties.map((p, i) => <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary">{p}</span>)}</div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedHerb.usage_instructions && <div className="bg-muted/50 rounded-lg p-3"><h4 className="text-xs font-semibold text-foreground mb-1">📋 วิธีใช้</h4><p className="text-xs text-muted-foreground">{selectedHerb.usage_instructions}</p></div>}
                  {selectedHerb.dosage && <div className="bg-muted/50 rounded-lg p-3"><h4 className="text-xs font-semibold text-foreground mb-1">⚖️ ขนาดยา</h4><p className="text-xs text-muted-foreground">{selectedHerb.dosage}</p></div>}
                </div>
                {selectedHerb.precautions && selectedHerb.precautions.length > 0 && (
                  <div className="bg-herb-gold/5 border border-herb-gold/20 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><Shield className="w-4 h-4 text-herb-gold" /> ข้อควรระวัง</h4>
                    <ul className="space-y-1">{selectedHerb.precautions.map((p, i) => <li key={i} className="text-xs text-muted-foreground flex items-start gap-2"><span className="text-herb-gold mt-0.5">•</span> {p}</li>)}</ul>
                  </div>
                )}
                {selectedHerb.contraindications && selectedHerb.contraindications.length > 0 && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-destructive" /> ข้อห้ามใช้</h4>
                    <ul className="space-y-1">{selectedHerb.contraindications.map((c, i) => <li key={i} className="text-xs text-muted-foreground flex items-start gap-2"><span className="text-destructive mt-0.5">✕</span> {c}</li>)}</ul>
                  </div>
                )}
                {selectedHerb.drug_interactions && selectedHerb.drug_interactions.length > 0 && (
                  <div className="bg-herb-terracotta/5 border border-herb-terracotta/20 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><Pill className="w-4 h-4 text-herb-terracotta" /> Drug Interactions</h4>
                    <ul className="space-y-1.5">{selectedHerb.drug_interactions.map((d, i) => <li key={i} className="text-xs text-muted-foreground flex items-start gap-2"><span className="text-herb-terracotta mt-0.5">💊</span><span>{d}</span></li>)}</ul>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground text-center border-t border-border pt-3">⚕️ ข้อมูลนี้เป็นข้อมูลทั่วไปเพื่อการศึกษา ไม่ใช่คำแนะนำทางการแพทย์ ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้ยาสมุนไพร</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Formula Detail Modal */}
      <AnimatePresence>
        {selectedFormula && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-start justify-center p-4 pt-10 overflow-y-auto"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.97 }}
              className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-2xl mb-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative p-6">
                <button onClick={handleCloseModal} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-muted/50 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>

                <div className="space-y-5">
                  {/* Title */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Beaker className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold font-thai text-foreground">{selectedFormula.name_thai}</h2>
                        {selectedFormula.is_in_nlem && <span className="text-xs px-2 py-0.5 rounded-full gradient-herbal text-primary-foreground font-medium">บัญชียาหลักแห่งชาติ</span>}
                      </div>
                      <p className="text-sm text-muted-foreground italic">{selectedFormula.name_english}</p>
                      {selectedFormula.formula_code && <p className="text-xs text-muted-foreground">รหัส: {selectedFormula.formula_code}</p>}
                      {selectedFormula.category && <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{selectedFormula.category}</span>}
                    </div>
                  </div>

                  {/* Indication */}
                  {selectedFormula.indication && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-foreground mb-1">🎯 สรรพคุณ / ข้อบ่งใช้</h4>
                      <p className="text-sm text-foreground">{selectedFormula.indication}</p>
                    </div>
                  )}

                  {/* Properties */}
                  {selectedFormula.properties && selectedFormula.properties.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedFormula.properties.map((p, i) => <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary">{p}</span>)}
                    </div>
                  )}

                  {/* Ingredients */}
                  {selectedFormula.ingredients && selectedFormula.ingredients.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><FlaskConical className="w-4 h-4 text-primary" /> ส่วนประกอบ ({selectedFormula.ingredients.length} ชนิด)</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedFormula.ingredients.map((ing, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-muted text-foreground">{ing}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preparation, Dosage, Usage */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedFormula.preparation && <div className="bg-muted/50 rounded-lg p-3"><h4 className="text-xs font-semibold text-foreground mb-1">🧪 วิธีปรุง</h4><p className="text-xs text-muted-foreground">{selectedFormula.preparation}</p></div>}
                    {selectedFormula.dosage && <div className="bg-muted/50 rounded-lg p-3"><h4 className="text-xs font-semibold text-foreground mb-1">⚖️ ขนาดยา</h4><p className="text-xs text-muted-foreground">{selectedFormula.dosage}</p></div>}
                    {selectedFormula.usage_instructions && <div className="bg-muted/50 rounded-lg p-3 sm:col-span-2"><h4 className="text-xs font-semibold text-foreground mb-1">📋 วิธีใช้</h4><p className="text-xs text-muted-foreground">{selectedFormula.usage_instructions}</p></div>}
                  </div>

                  {/* Precautions */}
                  {selectedFormula.precautions && selectedFormula.precautions.length > 0 && (
                    <div className="bg-herb-gold/5 border border-herb-gold/20 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><Shield className="w-4 h-4 text-herb-gold" /> ข้อควรระวัง</h4>
                      <ul className="space-y-1">{selectedFormula.precautions.map((p, i) => <li key={i} className="text-xs text-muted-foreground flex items-start gap-2"><span className="text-herb-gold mt-0.5">•</span> {p}</li>)}</ul>
                    </div>
                  )}

                  {/* Contraindications */}
                  {selectedFormula.contraindications && selectedFormula.contraindications.length > 0 && (
                    <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-destructive" /> ข้อห้ามใช้</h4>
                      <ul className="space-y-1">{selectedFormula.contraindications.map((c, i) => <li key={i} className="text-xs text-muted-foreground flex items-start gap-2"><span className="text-destructive mt-0.5">✕</span> {c}</li>)}</ul>
                    </div>
                  )}

                  {/* Drug Interactions */}
                  {selectedFormula.drug_interactions && selectedFormula.drug_interactions.length > 0 && (
                    <div className="bg-herb-terracotta/5 border border-herb-terracotta/20 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><Pill className="w-4 h-4 text-herb-terracotta" /> ปฏิกิริยากับยาแผนปัจจุบัน</h4>
                      <ul className="space-y-1.5">{selectedFormula.drug_interactions.map((d, i) => <li key={i} className="text-xs text-muted-foreground flex items-start gap-2"><span className="text-herb-terracotta mt-0.5">💊</span><span>{d}</span></li>)}</ul>
                    </div>
                  )}

                  {/* References */}
                  {selectedFormula.references && (
                    <div className="bg-muted/40 border border-border rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-foreground mb-1">🔗 แหล่งข้อมูลอ้างอิง</h4>
                      <div className="space-y-1">
                        {selectedFormula.references.split("\n").filter(Boolean).map((ref, idx) => (
                          <a
                            key={idx}
                            href={ref.trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline block break-all"
                          >
                            {ref.trim()}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground text-center border-t border-border pt-3">⚕️ ข้อมูลนี้เป็นข้อมูลทั่วไปเพื่อการศึกษา ไม่ใช่คำแนะนำทางการแพทย์ ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้ยาสมุนไพร</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HerbsPage;
