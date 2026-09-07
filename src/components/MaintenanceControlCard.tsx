import { useState, useEffect } from "react";
import { Wrench, Shield, CheckCircle2, AlertTriangle, Save, RefreshCw, Eye } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useMaintenanceMode } from "@/lib/maintenance-service";
import { toast } from "sonner";

export const MaintenanceControlCard = () => {
  const { isMaintenance, message, setMaintenance, updatedAt } = useMaintenanceMode();
  const [active, setActive] = useState(isMaintenance);
  const [customMsg, setCustomMsg] = useState(message);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setActive(isMaintenance);
    setCustomMsg(message);
  }, [isMaintenance, message]);

  const handleSave = () => {
    setSaving(true);
    try {
      setMaintenance(active, customMsg.trim());
      toast.success(
        active
          ? "เปิดโหมดปิดปรับปรุงระบบเรียบร้อย (ผู้ใช้ทั่วไปจะเห็นหน้าแจ้งเตือน)"
          : "ปิดโหมดปรับปรุงแล้ว (เปิดให้ทุกคนใช้งานตามปกติ)"
      );
    } catch (e: any) {
      toast.error(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const PRESETS = [
    "ขณะนี้ระบบ HerbBot PLK อยู่ระหว่างการปรับปรุงและอัปเดตฐานข้อมูลสมุนไพรและตำรับยา 97 รายการ เพื่อความถูกต้องของข้อมูล ขออภัยในความไม่สะดวกครับ",
    "ขณะนี้ระบบกำลังอยู่ระหว่างการบำรุงรักษาและปรับปรุงประสิทธิภาพประจำสัปดาห์ โปรดกลับมาใช้งานใหม่อีกครั้งในภายหลังครับ",
    "ระบบกำลังอัปเกรดระบบประมวลผล AI และ Drug-Herb Interaction คาดว่าจะแล้วเสร็จในเร็วๆ นี้ครับ",
  ];

  return (
    <Card className={`border transition-all ${active ? "border-amber-500/50 bg-amber-500/5 shadow-md" : "border-border"}`}>
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? "bg-amber-500 text-white shadow-md" : "bg-muted text-muted-foreground"}`}>
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold font-thai">
                  โหมดปิดปรับปรุงระบบ (Maintenance Mode)
                </CardTitle>
                {active ? (
                  <Badge variant="destructive" className="text-[11px] bg-amber-500 hover:bg-amber-600 border-none flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    กำลังปิดปรับปรุง
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px] text-primary border-primary/30 bg-primary/5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    ระบบเปิดใช้งานตามปกติ (Online)
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                เมื่อเปิดโหมดนี้ บุคคลทั่วไปจะไม่สามารถส่งคำถามหรือเข้าดูข้อมูลได้ แต่ผู้ดูแลระบบ (Admin) ยังคงสามารถเข้าใช้งานและทดสอบระบบได้ตามปกติ
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-background/80 px-3 py-1.5 rounded-xl border border-border">
            <Label htmlFor="maintenance-switch" className="text-xs font-medium cursor-pointer text-foreground">
              {active ? "เปิดปรับปรุง (ปิดระบบชั่วคราว)" : "ระบบเปิดปกติ"}
            </Label>
            <Switch
              id="maintenance-switch"
              checked={active}
              onCheckedChange={(val) => {
                setActive(val);
              }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5 pt-1">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground flex items-center justify-between">
            <span>ข้อความแจ้งเตือนผู้ใช้งานเมื่อปิดปรับปรุง</span>
            <span className="text-[10px] text-muted-foreground">จะแสดงให้ผู้ใช้ทั่วไปเห็นในหน้าแจ้งเตือน</span>
          </Label>
          <Textarea
            value={customMsg}
            onChange={(e) => setCustomMsg(e.target.value)}
            rows={3}
            placeholder="พิมพ์ข้อความที่ต้องการแจ้งผู้ใช้งาน..."
            className="text-xs font-thai leading-relaxed resize-none"
          />
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5">
          <div className="text-[11px] text-muted-foreground">ข้อความตัวอย่างด่วน:</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCustomMsg(p)}
                className="text-[10px] px-2 py-1 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-left line-clamp-1 max-w-xs"
                title={p}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex items-center justify-between gap-3 border-t border-border/50">
          <div className="text-[10px] text-muted-foreground">
            {updatedAt && `อัปเดตล่าสุด: ${new Date(updatedAt).toLocaleString("th-TH")}`}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gradient-herbal text-primary-foreground text-xs shadow-herbal"
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            {saving ? "กำลังบันทึก..." : "บันทึกสถานะโหมดปรับปรุง"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MaintenanceControlCard;
