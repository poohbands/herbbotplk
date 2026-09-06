import { useState, useEffect } from "react";
import { Leaf, BarChart3, MessageCircle, AlertTriangle, TrendingUp, Users, ArrowLeft, Pill, Activity, Shield, RefreshCw, Bot } from "lucide-react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import AdminLogin from "@/components/AdminLogin";
import QAReport from "@/components/QAReport";
import KnowledgeManager from "@/components/KnowledgeManager";
import DataImporter from "@/components/DataImporter";

const COLORS = ["hsl(145, 45%, 28%)", "hsl(15, 50%, 45%)", "hsl(38, 70%, 50%)", "hsl(145, 35%, 45%)", "hsl(25, 30%, 35%)"];
const SEVERITY_COLORS: Record<string, string> = {
  major: "hsl(0, 72%, 51%)",
  moderate: "hsl(38, 70%, 50%)",
  minor: "hsl(145, 45%, 28%)",
};

const StatCard = ({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color: string }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-herbal transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold font-thai text-foreground mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </motion.div>
);

type StatsData = {
  totalQuestions: number;
  totalSessions: number;
  drugInteractionCount: number;
  dailyData: { date: string; questions: number; interactions: number }[];
  topHerbs: { name: string; count: number }[];
  topDrugs: { name: string; count: number }[];
  topInteractionPairs: { pair: string; count: number }[];
  severityBreakdown: { major: number; moderate: number; minor: number };
  monthlyData: { month: string; total: number; interaction: number; dosage: number; herbal: number; side_effects: number }[];
  categoryData: { name: string; value: number }[];
};

const AdminPage = () => {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem("admin_auth") === "true");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authenticated) return;
    loadStats();
  }, [authenticated]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-stats", { body: { action: "overview" } });
      if (error) throw error;
      setStats(data);
    } catch (e) {
      console.error("Failed to load stats:", e);
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) return <AdminLogin onLogin={() => setAuthenticated(true)} />;

  const hasData = stats && stats.totalQuestions > 0;
  const totalSeverity = (stats?.severityBreakdown?.major || 0) + (stats?.severityBreakdown?.moderate || 0) + (stats?.severityBreakdown?.minor || 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-7xl mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full gradient-herbal flex items-center justify-center shadow-herbal">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-thai text-foreground">KPI & Analytics Dashboard</h1>
              <p className="text-xs text-muted-foreground">สถิติเชิงนโยบายด้านสาธารณสุข — กลุ่มงานการแพทย์แผนไทยและสมุนไพร สสจ.พิษณุโลก</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/admin/ai-settings"
              className="text-sm font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/20 shadow-xs"
            >
              <Bot className="w-4 h-4" /> ตั้งค่า AI
            </a>
            <button onClick={loadStats} disabled={loading} className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-muted disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              รีเฟรช
            </button>
            <a href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-muted">
              <ArrowLeft className="w-4 h-4" /> กลับหน้าแชท
            </a>
          </div>
        </div>
      </header>

      <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Leaf className="w-8 h-8 text-primary animate-pulse-soft" />
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Leaf className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-thai text-foreground">ยังไม่มีข้อมูล</p>
            <p className="text-sm text-muted-foreground">เริ่มใช้งานแชทเพื่อสร้างข้อมูลสถิติ</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard icon={MessageCircle} label="คำถามทั้งหมด" value={stats.totalQuestions.toLocaleString()} color="gradient-herbal text-primary-foreground" />
              <StatCard icon={AlertTriangle} label="Drug Interaction" value={stats.drugInteractionCount.toLocaleString()} sub={`${stats.totalQuestions > 0 ? Math.round((stats.drugInteractionCount / stats.totalQuestions) * 100) : 0}% ของทั้งหมด`} color="bg-herb-terracotta/10 text-herb-terracotta" />
              <StatCard icon={Shield} label="Major Severity" value={(stats.severityBreakdown?.major || 0).toLocaleString()} sub="ต้องเฝ้าระวัง" color="bg-destructive/10 text-destructive" />
              <StatCard icon={Users} label="Sessions" value={stats.totalSessions.toLocaleString()} sub={`เฉลี่ย ${stats.totalSessions > 0 ? (stats.totalQuestions / stats.totalSessions).toFixed(1) : 0} คำถาม/session`} color="gradient-gold text-accent-foreground" />
              <StatCard icon={Leaf} label="สมุนไพรที่ถูกถาม" value={`${stats.topHerbs.length} ชนิด`} color="bg-primary/10 text-primary" />
            </div>

            {/* Row 1: Category Pie + Severity Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <h3 className="text-base font-semibold font-thai text-foreground mb-4">📊 ประเภทคำถาม</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={stats.categoryData.filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                      {stats.categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(40, 20%, 85%)", fontFamily: "Sarabun" }} />
                    <Legend wrapperStyle={{ fontFamily: "Sarabun", fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <h3 className="text-base font-semibold font-thai text-foreground mb-4">🛡️ ระดับความรุนแรง Drug Interaction</h3>
                {totalSeverity > 0 ? (
                  <div className="space-y-4 mt-6">
                    {(["major", "moderate", "minor"] as const).map((level) => {
                      const count = stats.severityBreakdown?.[level] || 0;
                      const pct = totalSeverity > 0 ? Math.round((count / totalSeverity) * 100) : 0;
                      const labels = { major: "⚠️ Major", moderate: "⚡ Moderate", minor: "ℹ️ Minor" };
                      return (
                        <div key={level}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">{labels[level]}</span>
                            <span className="text-xs text-muted-foreground">{count} ({pct}%)</span>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ delay: 0.5, duration: 0.6 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: SEVERITY_COLORS[level] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center mt-12">ยังไม่มีข้อมูล</p>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <h3 className="text-base font-semibold font-thai text-foreground mb-4">📈 คำถามรายวัน (7 วัน)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={stats.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 20%, 85%)" />
                    <XAxis dataKey="date" style={{ fontFamily: "Sarabun", fontSize: 11 }} />
                    <YAxis style={{ fontFamily: "Sarabun", fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(40, 20%, 85%)", fontFamily: "Sarabun" }} />
                    <Line type="monotone" dataKey="questions" stroke="hsl(145, 45%, 28%)" strokeWidth={2} name="ทั้งหมด" dot={{ fill: "hsl(145, 45%, 28%)" }} />
                    <Line type="monotone" dataKey="interactions" stroke="hsl(15, 50%, 45%)" strokeWidth={2} name="Interaction" dot={{ fill: "hsl(15, 50%, 45%)" }} />
                    <Legend wrapperStyle={{ fontFamily: "Sarabun", fontSize: "11px" }} />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            {/* Row 2: Monthly Trend + Top Interaction Pairs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <h3 className="text-base font-semibold font-thai text-foreground mb-1">📅 แนวโน้มรายเดือน</h3>
                <p className="text-xs text-muted-foreground mb-4">เพื่อวางแผนเชิงนโยบายด้านสาธารณสุข</p>
                {stats.monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={stats.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 20%, 85%)" />
                      <XAxis dataKey="month" style={{ fontFamily: "Sarabun", fontSize: 11 }} />
                      <YAxis style={{ fontFamily: "Sarabun", fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(40, 20%, 85%)", fontFamily: "Sarabun" }} />
                      <Bar dataKey="herbal" name="ข้อมูลสมุนไพร" fill="hsl(145, 45%, 28%)" stackId="a" />
                      <Bar dataKey="interaction" name="Drug Interaction" fill="hsl(15, 50%, 45%)" stackId="a" />
                      <Bar dataKey="dosage" name="ขนาดยา" fill="hsl(38, 70%, 50%)" stackId="a" />
                      <Bar dataKey="side_effects" name="ผลข้างเคียง" fill="hsl(145, 35%, 45%)" stackId="a" />
                      <Legend wrapperStyle={{ fontFamily: "Sarabun", fontSize: "11px" }} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center mt-12">ยังไม่มีข้อมูลรายเดือน</p>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <h3 className="text-base font-semibold font-thai text-foreground mb-1 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-herb-terracotta" /> คู่ยา Drug-Herb Interaction ที่ถูกถามมากที่สุด
                </h3>
                <p className="text-xs text-muted-foreground mb-4">ข้อมูลสำคัญสำหรับวางแผนเฝ้าระวัง</p>
                {stats.topInteractionPairs.length > 0 ? (
                  <div className="space-y-3">
                    {stats.topInteractionPairs.map((item, i) => (
                      <div key={item.pair} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">{item.pair}</span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-herb-terracotta/10 text-herb-terracotta">{item.count} ครั้ง</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(item.count / stats.topInteractionPairs[0].count) * 100}%` }}
                              transition={{ delay: 0.5 + i * 0.08, duration: 0.5 }}
                              className="h-full bg-herb-terracotta rounded-full"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center mt-12">ยังไม่มีข้อมูลคู่ยา</p>
                )}
              </motion.div>
            </div>

            {/* Row 3: Top Herbs + Top Drugs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <h3 className="text-base font-semibold font-thai text-foreground mb-1 flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-primary" /> สมุนไพรที่ถูกค้นหามากที่สุด (Top 10)
                </h3>
                <p className="text-xs text-muted-foreground mb-4">สมุนไพรที่ประชาชนสนใจมากที่สุด</p>
                {stats.topHerbs.length > 0 ? (
                  <div className="space-y-2.5">
                    {stats.topHerbs.map((herb, i) => (
                      <div key={herb.name} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">{herb.name}</span>
                            <span className="text-xs text-muted-foreground">{herb.count} ครั้ง</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(herb.count / stats.topHerbs[0].count) * 100}%` }}
                              transition={{ delay: 0.5 + i * 0.06, duration: 0.4 }}
                              className="h-full gradient-herbal rounded-full"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center mt-8">ยังไม่มีข้อมูล</p>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <h3 className="text-base font-semibold font-thai text-foreground mb-1 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-herb-terracotta" /> ยาแผนปัจจุบันที่ถูกถามมากที่สุด (Top 10)
                </h3>
                <p className="text-xs text-muted-foreground mb-4">ยาที่ผู้ใช้กังวลเรื่อง interaction มากที่สุด</p>
                {stats.topDrugs.length > 0 ? (
                  <div className="space-y-2.5">
                    {stats.topDrugs.map((drug, i) => (
                      <div key={drug.name} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">{drug.name}</span>
                            <span className="text-xs text-muted-foreground">{drug.count} ครั้ง</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(drug.count / stats.topDrugs[0].count) * 100}%` }}
                              transition={{ delay: 0.5 + i * 0.06, duration: 0.4 }}
                              className="h-full bg-herb-terracotta rounded-full"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center mt-8">ยังไม่มีข้อมูล</p>
                )}
              </motion.div>
            </div>

            {/* Q&A Report */}
            <QAReport />

            {/* Knowledge Base Manager */}
            <KnowledgeManager />

            {/* Data Importer */}
            <DataImporter />




            {/* Policy Insight */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="bg-card rounded-xl border border-primary/20 p-5 shadow-herbal">
              <h3 className="text-base font-semibold font-thai text-foreground mb-3 flex items-center gap-2">
                🏛️ ข้อมูลเชิงนโยบาย (Policy Insights)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">สมุนไพรยอดนิยมอันดับ 1</p>
                  <p className="font-semibold text-foreground">{stats.topHerbs[0]?.name || "-"}</p>
                  <p className="text-xs text-muted-foreground">{stats.topHerbs[0]?.count || 0} ครั้ง — ควรมีข้อมูลวิจัยรองรับเพียงพอ</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">คู่ยาที่ต้องเฝ้าระวัง</p>
                  <p className="font-semibold text-foreground">{stats.topInteractionPairs[0]?.pair || "-"}</p>
                  <p className="text-xs text-muted-foreground">{stats.topInteractionPairs[0]?.count || 0} ครั้ง — ควรมีแนวปฏิบัติทางคลินิก</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">สัดส่วน Major Interaction</p>
                  <p className="font-semibold text-foreground">
                    {totalSeverity > 0 ? `${Math.round(((stats.severityBreakdown?.major || 0) / totalSeverity) * 100)}%` : "0%"}
                  </p>
                  <p className="text-xs text-muted-foreground">ของ interaction ทั้งหมด — ต้องมีระบบเตือนชัดเจน</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
