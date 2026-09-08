import { useState, useEffect } from "react";
import {
  Users,
  Eye,
  Clock,
  Smartphone,
  Laptop,
  Tablet,
  Globe,
  Monitor,
  RefreshCw,
  Trash2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  computeAnalyticsSummary,
  clearStoredAnalytics,
  type AnalyticsSummary,
} from "@/lib/analytics-service";

const DEVICE_COLORS = ["#10b981", "#3b82f6", "#f59e0b"];
const BROWSER_COLORS = ["#10b981", "#06b6d4", "#f97316", "#8b5cf6", "#ec4899", "#64748b"];

export const VisitorAnalyticsDashboard = () => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const loadData = () => {
    const data = computeAnalyticsSummary();
    setSummary(data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClear = () => {
    if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการล้างประวัติสถิติการเข้าชมทั้งหมดบนเครื่องนี้?")) {
      clearStoredAnalytics();
      loadData();
      toast.success("ล้างประวัติสถิติเรียบร้อยแล้ว");
    }
  };

  if (!summary) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-5">
      {/* Header with Collapsible & Refresh Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold font-thai text-foreground">
                สถิติผู้เข้าชมและข้อมูลทางเทคนิค (Visitor & Technical Metrics)
              </h3>
              <Badge variant="outline" className="text-[11px] font-normal border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                PDPA Compliant (No PII)
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              ติดตามพฤติกรรมการใช้งาน, หน้าที่นิยม, ระยะเวลาเฉลี่ย, และสัดส่วนอุปกรณ์/เบราว์เซอร์
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="text-xs h-8 gap-1.5 cursor-pointer hover:bg-muted"
            title="รีเฟรชสถิติ"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>อัปเดต</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs h-8 gap-1 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>ย่อ</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>ขยาย</span>
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
            className="space-y-6 overflow-hidden"
          >
            {/* KPI Cards: 4 Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-muted/40 rounded-xl p-4 border border-border/60">
                <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                  <span>ยอดเข้าชมทั้งหมด (Pageviews)</span>
                  <Eye className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold font-thai text-foreground">
                  {summary.totalPageviews.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">จำนวนครั้งที่มีการเปิดหน้าเว็บ</div>
              </div>

              <div className="bg-muted/40 rounded-xl p-4 border border-border/60">
                <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                  <span>ผู้เข้าชมที่ไม่ซ้ำ (Unique Visitors)</span>
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold font-thai text-foreground">
                  {summary.uniqueVisitors.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">นับตาม Anonymous Device ID</div>
              </div>

              <div className="bg-muted/40 rounded-xl p-4 border border-border/60">
                <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                  <span>จำนวนเซสชัน (Total Sessions)</span>
                  <TrendingUp className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold font-thai text-foreground">
                  {summary.totalSessions.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">เฉลี่ย {(summary.totalPageviews / Math.max(summary.totalSessions, 1)).toFixed(1)} หน้า / เซสชัน</div>
              </div>

              <div className="bg-muted/40 rounded-xl p-4 border border-border/60">
                <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                  <span>ระยะเวลาใช้งานเฉลี่ย (Avg Duration)</span>
                  <Clock className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl font-bold font-thai text-foreground">
                  {summary.avgDurationSeconds >= 60
                    ? `${Math.floor(summary.avgDurationSeconds / 60)} นาที ${summary.avgDurationSeconds % 60} วิ`
                    : `${summary.avgDurationSeconds} วินาที`}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">ระยะเวลาที่ผู้ใช้อยู่ในระบบ</div>
              </div>
            </div>

            {/* Charts Row 1: Daily Visitors Trend + Device Type Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Visitors Chart */}
              <div className="lg:col-span-2 bg-muted/20 rounded-xl p-4 border border-border/60">
                <h4 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" /> สถิติผู้เข้าชมรายวัน (7 วันล่าสุด)
                </h4>
                <p className="text-xs text-muted-foreground mb-4">จำนวนผู้เข้าชม (Visitors) และยอดเปิดหน้า (Pageviews)</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.dailyVisitors}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="date" style={{ fontFamily: "Sarabun", fontSize: 11 }} />
                      <YAxis allowDecimals={false} style={{ fontFamily: "Sarabun", fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", fontFamily: "Sarabun" }} />
                      <Bar dataKey="visitors" name="ผู้เข้าชม (คน)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pageviews" name="ยอดเปิดหน้า (ครั้ง)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Legend wrapperStyle={{ fontFamily: "Sarabun", fontSize: "11px" }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Device Breakdown Pie */}
              <div className="bg-muted/20 rounded-xl p-4 border border-border/60 flex flex-col">
                <h4 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-amber-500" /> สัดส่วนอุปกรณ์ (Device Types)
                </h4>
                <p className="text-xs text-muted-foreground mb-2">มือถือ แท็บเล็ต และคอมพิวเตอร์</p>
                <div className="h-44 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.deviceBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {summary.deviceBreakdown.map((_, i) => (
                          <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", fontFamily: "Sarabun" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 text-xs mt-1">
                  {summary.deviceBreakdown.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DEVICE_COLORS[i % DEVICE_COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Top Visited Pages + Technical Metrics (Browser & OS) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Pages */}
              <div className="bg-muted/20 rounded-xl p-4 border border-border/60">
                <h4 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-blue-500" /> หน้าหรือฟีเจอร์ที่เข้าชมมากที่สุด (Top Pages)
                </h4>
                <p className="text-xs text-muted-foreground mb-3">หน้าที่ผู้ใช้ใช้เวลาและเข้าถึงบ่อยที่สุด</p>
                <div className="space-y-2.5">
                  {summary.topPages.length > 0 ? (
                    summary.topPages.slice(0, 5).map((page, i) => {
                      const pct = summary.totalPageviews > 0 ? Math.round((page.count / summary.totalPageviews) * 100) : 0;
                      return (
                        <div key={page.path} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold text-muted-foreground w-4">{i + 1}.</span>
                              <span className="font-medium text-foreground truncate">{page.path}</span>
                              <span className="text-muted-foreground truncate text-[11px]">({page.title})</span>
                            </div>
                            <span className="text-muted-foreground font-mono shrink-0">{page.count} ครั้ง ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">ยังไม่มีประวัติการเข้าชม</p>
                  )}
                </div>
              </div>

              {/* Technical Metrics: Browser & OS Breakdown */}
              <div className="bg-muted/20 rounded-xl p-4 border border-border/60 space-y-4">
                <h4 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-purple-500" /> ข้อมูลทางเทคนิค (Browsers & Operating Systems)
                </h4>
                <p className="text-xs text-muted-foreground mb-3">ช่วยปรับแต่งประสิทธิภาพและแก้ไขปัญหา UI ตามอุปกรณ์</p>

                <div className="grid grid-cols-2 gap-4">
                  {/* Browser List */}
                  <div className="bg-background/60 rounded-lg p-3 border border-border/40 space-y-2">
                    <span className="text-xs font-semibold text-foreground block">🌐 เบราว์เซอร์</span>
                    {summary.browserBreakdown.slice(0, 4).map((b) => (
                      <div key={b.name} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{b.name}</span>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">{b.value}</Badge>
                      </div>
                    ))}
                  </div>

                  {/* OS List */}
                  <div className="bg-background/60 rounded-lg p-3 border border-border/40 space-y-2">
                    <span className="text-xs font-semibold text-foreground block">💻 ระบบปฏิบัติการ</span>
                    {summary.osBreakdown.slice(0, 4).map((o) => (
                      <div key={o.name} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{o.name}</span>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">{o.value}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="text-xs text-muted-foreground hover:text-destructive h-7 gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ล้างสถิติเครื่องนี้</span>
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
