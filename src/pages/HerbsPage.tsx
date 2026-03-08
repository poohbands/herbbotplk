import { useState, useEffect } from "react";
import { Search, Leaf, ArrowLeft, AlertTriangle, Pill, ChevronDown, ChevronUp, X, BookOpen, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

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

const CATEGORIES = ["ทั้งหมด", "สมุนไพรในบัญชียาหลัก", "สมุนไพรเครื่องเทศ", "สมุนไพรลดน้ำตาล"];

const HerbsPage = () => {
  const [herbs, setHerbs] = useState<Herb[]>([]);
  const [filtered, setFiltered] = useState<Herb[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ทั้งหมด");
  const [selectedHerb, setSelectedHerb] = useState<Herb | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHerbs();
  }, []);

  useEffect(() => {
    let result = herbs;
    if (category !== "ทั้งหมด") {
      result = result.filter((h) => h.category === category);
    }
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
  }, [herbs, search, category]);

  const loadHerbs = async () => {
    const { data, error } = await supabase
      .from("herbs")
      .select("*")
      .order("name_thai");
    if (!error && data) {
      setHerbs(data as Herb[]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="container max-w-6xl mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full gradient-herbal flex items-center justify-center shadow-herbal">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-thai text-foreground">สารานุกรมสมุนไพรไทย</h1>
              <p className="text-xs text-muted-foreground">ฐานข้อมูลสมุนไพร สรรพคุณ และข้อควรระวัง</p>
            </div>
          </div>
          <a href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-muted">
            <ArrowLeft className="w-4 h-4" /> กลับหน้าแชท
          </a>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto px-4 py-6">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาสมุนไพร ชื่อไทย ชื่อวิทยาศาสตร์ สรรพคุณ..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
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

        {/* Results count */}
        <p className="text-sm text-muted-foreground mb-4">
          พบ {filtered.length} รายการ {search && `สำหรับ "${search}"`}
        </p>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Leaf className="w-8 h-8 text-primary animate-pulse-soft" />
          </div>
        ) : filtered.length === 0 ? (
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
                    <img
                      src={herb.image_url}
                      alt={herb.name_thai}
                      className="h-full w-auto object-contain group-hover:scale-105 transition-transform"
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold font-thai text-foreground group-hover:text-primary transition-colors">
                        {herb.name_thai}
                      </h3>
                      <p className="text-xs text-muted-foreground italic">{herb.name_scientific}</p>
                    </div>
                    {herb.is_in_nlem && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full gradient-herbal text-primary-foreground font-medium">
                        บัญชียาหลัก
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{herb.description}</p>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {herb.properties?.slice(0, 3).map((p, j) => (
                      <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {p}
                      </span>
                    ))}
                    {(herb.properties?.length || 0) > 3 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        +{(herb.properties?.length || 0) - 3}
                      </span>
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
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedHerb && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-start justify-center p-4 pt-10 overflow-y-auto"
            onClick={() => setSelectedHerb(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.97 }}
              className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-2xl mb-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="relative">
                {selectedHerb.image_url && (
                  <div className="h-48 bg-muted/30 flex items-center justify-center rounded-t-2xl">
                    <img src={selectedHerb.image_url} alt={selectedHerb.name_thai} className="h-full w-auto object-contain" />
                  </div>
                )}
                <button
                  onClick={() => setSelectedHerb(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Title */}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold font-thai text-foreground">{selectedHerb.name_thai}</h2>
                    {selectedHerb.is_in_nlem && (
                      <span className="text-xs px-2 py-0.5 rounded-full gradient-herbal text-primary-foreground font-medium">
                        บัญชียาหลักแห่งชาติ
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground italic">{selectedHerb.name_scientific}</p>
                  {selectedHerb.name_english && <p className="text-sm text-muted-foreground">({selectedHerb.name_english})</p>}
                  {selectedHerb.local_names && selectedHerb.local_names.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">ชื่อท้องถิ่น: {selectedHerb.local_names.join(", ")}</p>
                  )}
                  {selectedHerb.family && <p className="text-xs text-muted-foreground">วงศ์: {selectedHerb.family}</p>}
                </div>

                {/* Description */}
                <div>
                  <p className="text-sm text-foreground leading-relaxed">{selectedHerb.description}</p>
                </div>

                {/* Properties */}
                {selectedHerb.properties && selectedHerb.properties.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <Leaf className="w-4 h-4 text-primary" /> สรรพคุณ
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedHerb.properties.map((p, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary">{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dosage & Usage */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedHerb.usage_instructions && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-foreground mb-1">📋 วิธีใช้</h4>
                      <p className="text-xs text-muted-foreground">{selectedHerb.usage_instructions}</p>
                    </div>
                  )}
                  {selectedHerb.dosage && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-foreground mb-1">⚖️ ขนาดยา</h4>
                      <p className="text-xs text-muted-foreground">{selectedHerb.dosage}</p>
                    </div>
                  )}
                </div>

                {/* Precautions */}
                {selectedHerb.precautions && selectedHerb.precautions.length > 0 && (
                  <div className="bg-herb-gold/5 border border-herb-gold/20 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-herb-gold" /> ข้อควรระวัง
                    </h4>
                    <ul className="space-y-1">
                      {selectedHerb.precautions.map((p, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-herb-gold mt-0.5">•</span> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Contraindications */}
                {selectedHerb.contraindications && selectedHerb.contraindications.length > 0 && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-destructive" /> ข้อห้ามใช้
                    </h4>
                    <ul className="space-y-1">
                      {selectedHerb.contraindications.map((c, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-destructive mt-0.5">✕</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Drug Interactions */}
                {selectedHerb.drug_interactions && selectedHerb.drug_interactions.length > 0 && (
                  <div className="bg-herb-terracotta/5 border border-herb-terracotta/20 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <Pill className="w-4 h-4 text-herb-terracotta" /> Drug Interactions
                    </h4>
                    <ul className="space-y-1.5">
                      {selectedHerb.drug_interactions.map((d, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-herb-terracotta mt-0.5">💊</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Disclaimer */}
                <p className="text-[10px] text-muted-foreground text-center border-t border-border pt-3">
                  ⚕️ ข้อมูลนี้เป็นข้อมูลทั่วไปเพื่อการศึกษา ไม่ใช่คำแนะนำทางการแพทย์ ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้ยาสมุนไพร
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HerbsPage;
