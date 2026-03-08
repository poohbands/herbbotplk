import { useState, useEffect } from "react";
import { Leaf, BarChart3, MessageCircle, AlertTriangle, TrendingUp, Users, ArrowLeft, Pill } from "lucide-react";
import AdminLogin from "@/components/AdminLogin";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

const categoryData = [
  { name: "ข้อมูลสมุนไพร", value: 342, fill: "hsl(145, 45%, 28%)" },
  { name: "Drug Interaction", value: 256, fill: "hsl(15, 50%, 45%)" },
  { name: "วิธีใช้/ขนาดยา", value: 189, fill: "hsl(38, 70%, 50%)" },
  { name: "ผลข้างเคียง", value: 134, fill: "hsl(145, 35%, 45%)" },
  { name: "อื่นๆ", value: 79, fill: "hsl(25, 30%, 35%)" },
];

const dailyData = [
  { date: "จ.", questions: 45, interactions: 12 },
  { date: "อ.", questions: 52, interactions: 18 },
  { date: "พ.", questions: 48, interactions: 15 },
  { date: "พฤ.", questions: 61, interactions: 22 },
  { date: "ศ.", questions: 55, interactions: 19 },
  { date: "ส.", questions: 38, interactions: 8 },
  { date: "อา.", questions: 32, interactions: 6 },
];

const topHerbs = [
  { name: "ขมิ้นชัน", count: 89 },
  { name: "ฟ้าทะลายโจร", count: 76 },
  { name: "กระชายขาว", count: 65 },
  { name: "มะระขี้นก", count: 52 },
  { name: "ใบบัวบก", count: 43 },
  { name: "ว่านหางจระเข้", count: 38 },
];

const topDrugs = [
  { name: "Warfarin", count: 45 },
  { name: "Metformin", count: 38 },
  { name: "Aspirin", count: 32 },
  { name: "Atorvastatin", count: 28 },
  { name: "Amlodipine", count: 22 },
];

const COLORS = ["hsl(145, 45%, 28%)", "hsl(15, 50%, 45%)", "hsl(38, 70%, 50%)", "hsl(145, 35%, 45%)", "hsl(25, 30%, 35%)"];

const StatCard = ({ icon: Icon, label, value, trend, color }: { icon: any; label: string; value: string; trend?: string; color: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-herbal transition-shadow"
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold font-thai text-foreground mt-1">{value}</p>
        {trend && (
          <p className="text-xs text-primary flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" /> {trend}
          </p>
        )}
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </motion.div>
);

const AdminPage = () => {
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem("admin_auth") === "true"
  );

  if (!authenticated) {
    return <AdminLogin onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full gradient-herbal flex items-center justify-center shadow-herbal">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-thai text-foreground">แดชบอร์ดผู้ดูแล</h1>
              <p className="text-xs text-muted-foreground">สถิติการใช้งาน สมุนไพรAI</p>
            </div>
          </div>
          <a href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-muted">
            <ArrowLeft className="w-4 h-4" />
            กลับหน้าแชท
          </a>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={MessageCircle} label="คำถามทั้งหมด" value="1,000" trend="+12% จากสัปดาห์ก่อน" color="gradient-herbal text-primary-foreground" />
          <StatCard icon={AlertTriangle} label="Drug Interaction" value="256" trend="+8%" color="bg-herb-terracotta/10 text-herb-terracotta" />
          <StatCard icon={Users} label="ผู้ใช้งาน" value="432" trend="+15%" color="gradient-gold text-accent-foreground" />
          <StatCard icon={Leaf} label="สมุนไพรที่ถูกถาม" value="48 ชนิด" color="bg-primary/10 text-primary" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Pie */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl border border-border p-5 shadow-sm"
          >
            <h3 className="text-base font-semibold font-thai text-foreground mb-4">
              📊 ประเภทคำถาม
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(40, 20%, 85%)",
                    fontFamily: "Sarabun",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontFamily: "Sarabun", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Daily Line Chart */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl border border-border p-5 shadow-sm"
          >
            <h3 className="text-base font-semibold font-thai text-foreground mb-4">
              📈 คำถามรายวัน
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 20%, 85%)" />
                <XAxis dataKey="date" style={{ fontFamily: "Sarabun", fontSize: 12 }} />
                <YAxis style={{ fontFamily: "Sarabun", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(40, 20%, 85%)",
                    fontFamily: "Sarabun",
                  }}
                />
                <Line type="monotone" dataKey="questions" stroke="hsl(145, 45%, 28%)" strokeWidth={2} name="คำถามทั้งหมด" dot={{ fill: "hsl(145, 45%, 28%)" }} />
                <Line type="monotone" dataKey="interactions" stroke="hsl(15, 50%, 45%)" strokeWidth={2} name="Drug Interaction" dot={{ fill: "hsl(15, 50%, 45%)" }} />
                <Legend wrapperStyle={{ fontFamily: "Sarabun", fontSize: "12px" }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Top Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Herbs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-xl border border-border p-5 shadow-sm"
          >
            <h3 className="text-base font-semibold font-thai text-foreground mb-4 flex items-center gap-2">
              <Leaf className="w-4 h-4 text-primary" /> สมุนไพรที่ถูกถามมากที่สุด
            </h3>
            <div className="space-y-3">
              {topHerbs.map((herb, i) => (
                <div key={herb.name} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground w-5">{i + 1}.</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{herb.name}</span>
                      <span className="text-xs text-muted-foreground">{herb.count} ครั้ง</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(herb.count / topHerbs[0].count) * 100}%` }}
                        transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                        className="h-full gradient-herbal rounded-full"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Top Drugs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card rounded-xl border border-border p-5 shadow-sm"
          >
            <h3 className="text-base font-semibold font-thai text-foreground mb-4 flex items-center gap-2">
              <Pill className="w-4 h-4 text-herb-terracotta" /> ยาแผนปัจจุบันที่ถูกถามมากที่สุด
            </h3>
            <div className="space-y-3">
              {topDrugs.map((drug, i) => (
                <div key={drug.name} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground w-5">{i + 1}.</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{drug.name}</span>
                      <span className="text-xs text-muted-foreground">{drug.count} ครั้ง</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(drug.count / topDrugs[0].count) * 100}%` }}
                        transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                        className="h-full bg-herb-terracotta rounded-full"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
