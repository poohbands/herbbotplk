import { useState, useEffect } from "react";
import {
  ArrowLeft, RefreshCw, Save, ShieldCheck, Key, Globe, Cpu,
  CheckCircle2, AlertCircle, Eye, EyeOff, ArrowUp, ArrowDown,
  Sparkles, Bot, Trash2, Info, Laptop
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AdminLogin from "@/components/AdminLogin";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  getLocalProviders,
  saveLocalProviders,
  testProviderDirectly,
  type ProviderItem,
} from "@/lib/ai-providers-storage";

const ADMIN_PASS = "sakura4923";

const DEFAULT_RECOMMENDATIONS: Record<string, { desc: string; guideUrl?: string }> = {
  gemini: {
    desc: "Google AI Studio (แนะนำอันดับ 1) — มีโควตาฟรี ใช้งานผ่าน OpenAI compatible endpoint",
    guideUrl: "https://aistudio.google.com/app/apikey",
  },
  deepseek: {
    desc: "DeepSeek API — ราคาประหยัดและเก่งภาษาไทย (deepseek-chat)",
    guideUrl: "https://platform.deepseek.com/api_keys",
  },
  openrouter: {
    desc: "OpenRouter — รวมโมเดลทุกค่ายไว้ที่เดียว สลับใช้ได้ยืดหยุ่น",
    guideUrl: "https://openrouter.ai/keys",
  },
  qwen: {
    desc: "Alibaba DashScope (Qwen Plus/Turbo) — รองรับภาษาไทยได้ดีมาก",
    guideUrl: "https://www.alibabacloud.com",
  },
};

const AiSettingsPage = () => {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem("admin_auth") === "true");
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!authenticated) return;
    loadProviders();
  }, [authenticated]);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-providers-admin", {
        body: { action: "list", password: ADMIN_PASS },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const items = (data?.providers || []) as ProviderItem[];
      items.sort((a, b) => a.priority - b.priority);

      // ผสานคีย์จาก local storage ถ้ามี
      const local = getLocalProviders();
      items.forEach((it) => {
        const loc = local.find((l) => l.provider_key === it.provider_key);
        if (loc?.api_key && !it.has_key) {
          it.api_key = loc.api_key;
          it.has_key = true;
        }
      });

      setProviders(items);
      setIsLocalMode(false);
    } catch (e: any) {
      console.warn("Backend Edge Function ไม่พร้อมใช้งาน — สลับสู่โหมดเครื่องอิสระ (Local Mode):", e);
      // โหลดข้อมูลจาก localStorage ในเครื่องทันที
      const local = getLocalProviders();
      local.sort((a, b) => a.priority - b.priority);
      setProviders(local);
      setIsLocalMode(true);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = (id: string, checked: boolean) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_active: checked } : p))
    );
  };

  const handleFieldChange = (id: string, field: "base_url" | "model_name" | "api_key", value: string) => {
    let cleanVal = value;
    if (field === "api_key") {
      if (/[^\x20-\x7E]/.test(value)) {
        toast.warning("API Key ต้องเป็นภาษาอังกฤษ/ตัวเลขเท่านั้น (ระบบตัดภาษาไทยออกให้อัตโนมัติ)");
      }
      cleanVal = value.replace(/[^\x20-\x7E]/g, "").trim();
    }
    setProviders((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              [field]: cleanVal,
              has_key: field === "api_key" ? Boolean(cleanVal) : p.has_key,
            }
          : p
      )
    );
  };

  const handleMovePriority = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= providers.length) return;

    const newProviders = [...providers];
    const temp = newProviders[index];
    newProviders[index] = newProviders[targetIndex];
    newProviders[targetIndex] = temp;

    newProviders.forEach((p, idx) => {
      p.priority = idx + 1;
    });

    setProviders(newProviders);
  };

  const handleClearKey = (id: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, api_key: "", has_key: false } : p))
    );
    toast.info("ล้างกุญแจเดิมแล้ว คุณสามารถวาง API Key ใหม่ได้ทันที");
  };

  const handleTest = async (item: ProviderItem) => {
    setProviders((prev) =>
      prev.map((p) =>
        p.id === item.id ? { ...p, test_status: "testing", test_message: "กำลังทดสอบ..." } : p
      )
    );

    try {
      const result = await testProviderDirectly({
        api_key: item.api_key,
        base_url: item.base_url,
        model_name: item.model_name,
      });

      if (result.success) {
        setProviders((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? {
                  ...p,
                  test_status: "success",
                  test_message: result.message,
                  model_name: result.suggestedModel || p.model_name,
                }
              : p
          )
        );
        toast.success(`${item.name}: ${result.message}`);
      } else {
        setProviders((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, test_status: "error", test_message: result.message } : p
          )
        );
        toast.error(`${item.name}: ${result.message}`);
      }
    } catch (e: any) {
      const msg = e.message || "เกิดข้อผิดพลาดในการทดสอบ";
      setProviders((prev) =>
        prev.map((p) =>
          p.id === item.id ? { ...p, test_status: "error", test_message: msg } : p
        )
      );
      toast.error(`${item.name}: ${msg}`);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // 1. บันทึกลงในเครื่อง (localStorage) ทันที
      saveLocalProviders(providers);

      // 2. พยายามซิงค์ขึ้น Supabase Edge Function ถ้าเซิร์ฟเวอร์เปิดอยู่
      try {
        const payload = providers.map((p) => ({
          id: p.id,
          base_url: p.base_url,
          model_name: p.model_name,
          is_active: p.is_active,
          priority: p.priority,
          api_key: p.api_key,
        }));
        await supabase.functions.invoke("ai-providers-admin", {
          body: { action: "save", password: ADMIN_PASS, providers: payload },
        });
      } catch {
        // edge function sync optional
      }

      toast.success("บันทึกการตั้งค่าผู้ให้บริการ AI สำเร็จเรียบร้อย (พร้อมใช้งานทันที!)");
      await loadProviders();
    } catch (e: any) {
      console.error("Failed to save providers:", e);
      toast.error(e.message || "บันทึกการตั้งค่าไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (!authenticated) return <AdminLogin onLogin={() => setAuthenticated(true)} />;

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container max-w-5xl mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full gradient-herbal flex items-center justify-center shadow-herbal">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-thai text-foreground flex items-center gap-2">
                ตั้งค่าผู้ให้บริการ AI (AI Providers & Routing)
              </h1>
              <p className="text-xs text-muted-foreground">
                สลับโมเดล AI อัตโนมัติเมื่อเกิดข้อผิดพลาดหรือโควตาเต็ม (Auto-Failover)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadProviders}
              disabled={loading || saving}
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </Button>

            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={loading || saving}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}</span>
            </Button>

            <a
              href="/admin"
              className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-muted"
            >
              <ArrowLeft className="w-4 h-4" /> แดชบอร์ด
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Info Banner */}
        <Card className="border-primary/20 bg-primary/5 shadow-sm">
          <CardContent className="pt-4 pb-4 flex items-start gap-3 text-sm">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                กลไกการทำงานของระบบสลับโมเดลอัจฉริยะ (Failover Architecture)
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                ระบบจะเรียกผู้ให้บริการ AI ที่เปิดสวิตช์ใช้งาน (Active) โดยเริ่มจากอันดับความสำคัญที่ 1 ก่อน หากผู้ให้บริการนั้นตอบกลับช้า (Timeout), คีย์มีปัญหา หรือติด Rate Limit (429/5xx) ระบบจะข้ามไปเรียกผู้ให้บริการอันดับถัดไปทันทีโดยที่ผู้ใช้งานหน้าแชทไม่รู้สึกถึงความขัดข้อง
              </p>
            </div>
          </CardContent>
        </Card>

        {isLocalMode && (
          <Card className="border-blue-500/30 bg-blue-500/5 shadow-sm">
            <CardContent className="pt-3 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Laptop className="w-5 h-5 shrink-0" />
                <span className="text-xs sm:text-sm font-medium">
                  ทำงานในโหมดเครื่องส่วนตัว (Local Standalone Mode) — API Key จะถูกบันทึกในเบราว์เซอร์ของคุณ และส่งคำสั่งตรงไปยัง AI โดยไม่ต้องพึ่งพา Lovable หรือ Cloud Edge Functions
                </span>
              </div>
              <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50 shrink-0">
                Local Mode
              </Badge>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-3">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">กำลังโหลดรายชื่อผู้ให้บริการ AI...</p>
          </div>
        ) : providers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-destructive" />
              <p>ไม่พบรายการผู้ให้บริการในฐานข้อมูล</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {providers.map((item, index) => {
              const rec = DEFAULT_RECOMMENDATIONS[item.provider_key];
              const isShowingKey = showKeys[item.id] || false;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <Card className={`transition-all border ${item.is_active ? "border-primary/30 shadow-sm" : "border-border opacity-85"}`}>
                    <CardHeader className="pb-3 pt-4 px-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          {/* Priority controls */}
                          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 border border-border">
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-background text-foreground shadow-xs">
                              ลำดับ {item.priority}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleMovePriority(index, "up")}
                              disabled={index === 0}
                              title="เลื่อนขึ้น"
                              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded hover:bg-background/80 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMovePriority(index, "down")}
                              disabled={index === providers.length - 1}
                              title="เลื่อนลง"
                              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded hover:bg-background/80 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base font-bold font-thai">
                              {item.name}
                            </CardTitle>
                            <Badge variant="outline" className="text-[11px] font-mono">
                              {item.provider_key}
                            </Badge>
                            {item.has_key ? (
                              <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-none flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> มีกุญแจแล้ว
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">
                                ยังไม่มีกุญแจ
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Active Switch */}
                        <div className="flex items-center gap-2.5">
                          <Label htmlFor={`switch-${item.id}`} className="text-xs cursor-pointer text-muted-foreground">
                            {item.is_active ? "เปิดใช้งาน" : "ปิดชั่วคราว"}
                          </Label>
                          <Switch
                            id={`switch-${item.id}`}
                            checked={item.is_active}
                            onCheckedChange={(checked) => handleToggleActive(item.id, checked)}
                          />
                        </div>
                      </div>

                      {rec?.desc && (
                        <CardDescription className="text-xs text-muted-foreground mt-1">
                          {rec.desc}
                          {rec.guideUrl && (
                            <a
                              href={rec.guideUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 text-primary hover:underline inline-flex items-center"
                            >
                              รับ API Key ↗
                            </a>
                          )}
                        </CardDescription>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-3.5 pt-0 px-5 pb-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {/* Base URL */}
                        <div className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1.5 text-foreground">
                            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                            ที่อยู่ปลายทาง (Base URL / Endpoint)
                          </Label>
                          <Input
                            type="text"
                            value={item.base_url || ""}
                            onChange={(e) => handleFieldChange(item.id, "base_url", e.target.value)}
                            placeholder="https://api.example.com/v1"
                            className="font-mono text-xs"
                          />
                        </div>

                        {/* Model Name */}
                        <div className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1.5 text-foreground">
                            <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
                            ชื่อโมเดล (Model Name)
                          </Label>
                          <Input
                            type="text"
                            value={item.model_name || ""}
                            onChange={(e) => handleFieldChange(item.id, "model_name", e.target.value)}
                            placeholder="gemini-2.5-flash"
                            className="font-mono text-xs"
                          />
                          {item.provider_key === "gemini" && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                              <span className="text-muted-foreground text-[10px]">เลือกรวดเร็ว:</span>
                              {[
                                { id: "gemini-2.5-flash", label: "2.5 Flash (แนะนำ ⚡ ล่าสุด)" },
                                { id: "gemini-1.5-flash", label: "1.5 Flash" },
                                { id: "gemini-1.5-flash-8b", label: "1.5-8B (ประหยัด)" },
                              ].map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => handleFieldChange(item.id, "model_name", m.id)}
                                  className={`px-1.5 py-0.5 rounded border text-[10px] font-mono cursor-pointer transition-colors ${
                                    item.model_name === m.id
                                      ? "border-primary bg-primary/10 text-primary font-bold"
                                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                  }`}
                                >
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* API Key */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs flex items-center gap-1.5 text-foreground">
                            <Key className="w-3.5 h-3.5 text-muted-foreground" />
                            กุญแจเชื่อมต่อ (API Key)
                          </Label>
                          {item.has_key && item.api_key !== "__CLEAR__" && (
                            <button
                              type="button"
                              onClick={() => handleClearKey(item.id)}
                              className="text-[11px] text-destructive hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" /> ลบกุญแจเดิม
                            </button>
                          )}
                        </div>

                        <div className="relative">
                          <Input
                            type={isShowingKey ? "text" : "password"}
                            value={item.api_key === "__CLEAR__" ? "" : item.api_key || ""}
                            onChange={(e) => handleFieldChange(item.id, "api_key", e.target.value)}
                            placeholder={
                              item.api_key === "__CLEAR__"
                                ? "(กำลังจะลบกุญแจเมื่อกดบันทึก)"
                                : item.has_key
                                ? "•••••••••••••••••••••••• (มีกุญแจแล้ว — พิมพ์ใหม่เพื่อเปลี่ยน)"
                                : "วาง API Key ที่นี่..."
                            }
                            className="pr-10 font-mono text-xs"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowKeys((prev) => ({ ...prev, [item.id]: !isShowingKey }))
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {isShowingKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Test Connection Button & Status */}
                      <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-border/50">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={item.test_status === "testing"}
                          onClick={() => handleTest(item)}
                          className="text-xs gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-primary" />
                          {item.test_status === "testing" ? "กำลังทดสอบ..." : "ทดสอบการเชื่อมต่อ"}
                        </Button>

                        {/* Status Message */}
                        {item.test_status === "success" && (
                          <div className="text-xs text-primary flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-md">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{item.test_message}</span>
                          </div>
                        )}
                        {item.test_status === "error" && (
                          <div className="text-xs text-destructive flex items-center gap-1 bg-destructive/10 px-2.5 py-1 rounded-md">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{item.test_message}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}

            {/* Bottom Actions */}
            <div className="flex justify-end pt-4 gap-2">
              <Button
                variant="outline"
                onClick={loadProviders}
                disabled={loading || saving}
              >
                ยกเลิกการแก้ไข
              </Button>
              <Button
                onClick={handleSaveAll}
                disabled={loading || saving}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Save className="w-4 h-4" />
                {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่าทั้งหมด"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AiSettingsPage;
