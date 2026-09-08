import { useState, useEffect } from "react";
import { Wrench, CheckCircle2, ChevronDown, ChevronUp, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useMaintenanceMode } from "@/lib/maintenance-service";
import { toast } from "sonner";

export const MaintenanceControlCard = () => {
  const { isMaintenance, message, setMaintenance, updatedAt } = useMaintenanceMode();
  const [active, setActive] = useState(isMaintenance);
  const [customMsg, setCustomMsg] = useState(message);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setActive(isMaintenance);
    setCustomMsg(message);
  }, [isMaintenance, message]);

  // สวิตช์ทำงานทันทีแบบ Instant Toggle
  const handleToggle = (val: boolean) => {
    setActive(val);
    try {
      setMaintenance(val, customMsg.trim());
      toast.success(
        val
          ? "เปิดโหมดปรับปรุงระบบแล้ว (บุคคลทั่วไปจะเห็นหน้าแจ้งเตือน)"
          : "ปิดโหมดปรับปรุงแล้ว (เปิดให้บุคคลทั่วไปใช้งานตามปกติ)"
      );
    } catch (e: any) {
      toast.error(e.message || "เปลี่ยนสถานะไม่สำเร็จ");
    }
  };

  const handleSaveMessage = () => {
    setSaving(true);
    try {
      setMaintenance(active, customMsg.trim());
      toast.success("บันทึกข้อความแจ้งเตือนเรียบร้อย");
      setExpanded(false);
    } catch (e: any) {
      toast.error(e.message || "บันทึกข้อความไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const PRESETS = [
    "ขณะนี้ระบบ HerbBot PLK อยู่ระหว่างการปรับปรุงและอัปเดตฐานข้อมูลสมุนไพร 97 รายการ ขออภัยในความไม่สะดวกครับ",
    "ขณะนี้ระบบอยู่ระหว่างการบำรุงรักษาประจำสัปดาห์ โปรดกลับมาใช้งานใหม่ในภายหลังครับ",
    "ระบบกำลังอัปเกรดระบบประมวลผล AI คาดว่าจะแล้วเสร็จในเร็วๆ นี้ครับ",
  ];

  return (
    <Card
      className={`border transition-all duration-200 overflow-hidden ${
        active
          ? "border-amber-500/40 bg-amber-500/5 shadow-xs"
          : "border-border/80 bg-card/60 hover:bg-card"
      }`}
    >
      {/* Top Compact Bar */}
      <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              active
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-bold font-thai text-foreground">
              โหมดปิดปรับปรุงระบบ
            </span>

            {active ? (
              <Badge
                variant="destructive"
                className="text-[10px] py-0 px-2 h-5 bg-amber-500 hover:bg-amber-600 border-none inline-flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                กำลังปิดปรับปรุง
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] py-0 px-2 h-5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 inline-flex items-center gap-1"
              >
                <CheckCircle2 className="w-2.5 h-2.5" />
                เปิดใช้งานปกติ (Online)
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/70 transition-colors flex items-center gap-1 cursor-pointer"
            title="ตั้งค่าข้อความแจ้งเตือนผู้ใช้งาน"
          >
            <span>ข้อความแจ้งเตือน</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <div className="h-4 w-[1px] bg-border hidden sm:block" />

          <div className="flex items-center gap-2 bg-background/80 px-2.5 py-1 rounded-lg border border-border/80">
            <Label
              htmlFor="maintenance-switch"
              className="text-[11px] font-medium cursor-pointer select-none"
            >
              {active ? "ปิดระบบชั่วคราว" : "เปิดระบบ"}
            </Label>
            <Switch
              id="maintenance-switch"
              checked={active}
              onCheckedChange={handleToggle}
              className="scale-90"
            />
          </div>
        </div>
      </div>

      {/* Collapsible Message Editor */}
      {expanded && (
        <div className="px-3.5 pb-3 pt-1 border-t border-border/50 bg-muted/20 space-y-2.5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-muted-foreground text-[11px]">
            <span>ข้อความที่ผู้ใช้ทั่วไปจะเห็นเมื่อระบบปิดปรับปรุง:</span>
            {updatedAt && (
              <span className="text-[10px]">
                อัปเดตล่าสุด: {new Date(updatedAt).toLocaleString("th-TH")}
              </span>
            )}
          </div>

          <Textarea
            value={customMsg}
            onChange={(e) => setCustomMsg(e.target.value)}
            rows={2}
            placeholder="พิมพ์ข้อความแจ้งผู้ใช้งาน..."
            className="text-xs font-thai leading-relaxed resize-none bg-background"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">ข้อความตัวอย่าง:</span>
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCustomMsg(p)}
                  className="text-[10px] px-2 py-0.5 rounded border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer line-clamp-1 max-w-[200px]"
                  title={p}
                >
                  ตัวอย่าง {idx + 1}
                </button>
              ))}
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleSaveMessage}
              disabled={saving}
              className="h-7 text-[11px] px-2.5 gradient-herbal text-primary-foreground shadow-xs gap-1 ml-auto cursor-pointer"
            >
              <Save className="w-3 h-3" />
              <span>{saving ? "กำลังบันทึก..." : "บันทึกข้อความ"}</span>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default MaintenanceControlCard;
