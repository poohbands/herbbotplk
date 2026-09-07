import { useState } from "react";
import { Wrench, Shield, Lock, Eye, EyeOff, Sparkles, AlertTriangle, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import herbalHero from "@/assets/herbal-hero.png";
import { setAdminAuthenticated } from "@/lib/maintenance-service";
import { toast } from "sonner";

interface MaintenanceOverlayProps {
  message?: string;
  onAdminLoginSuccess?: () => void;
}

const ADMIN_PASS = "sakura4923";

export const MaintenanceOverlay = ({ message, onAdminLoginSuccess }: MaintenanceOverlayProps) => {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState(false);

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASS) {
      setAdminAuthenticated(true);
      setShowAdminModal(false);
      toast.success("เข้าสู่ระบบผู้ดูแลระบบสำเร็จ (สิทธิ์ Admin บายพาสโหมดปรับปรุงแล้ว)");
      if (onAdminLoginSuccess) onAdminLoginSuccess();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2500);
    }
  };

  const displayMessage =
    message ||
    "ขณะนี้ระบบ HerbBot PLK (หมอยาพิษณุโลก) อยู่ระหว่างการปรับปรุงและอัปเดตข้อมูลระบบ เพื่อเพิ่มประสิทธิภาพในการให้บริการ ขออภัยในความไม่สะดวก โปรดกลับมาใหม่อีกครั้งในภายหลังครับ";

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="bg-card rounded-3xl border border-border shadow-2xl max-w-lg w-full p-6 sm:p-8 text-center relative overflow-hidden"
      >
        {/* Background glow decoration */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-herb-gold/15 blur-3xl pointer-events-none" />

        {/* Icon & Hero */}
        <div className="relative mb-5 inline-block">
          <img src={herbalHero} alt="HerbBot PLK" className="w-24 h-24 object-contain mx-auto drop-shadow-md" />
          <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg border-2 border-card">
            <Wrench className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-medium mb-3">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <span>ระบบอยู่ระหว่างการปิดปรับปรุงชั่วคราว</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold font-thai text-foreground mb-2">
          ขออภัยในความไม่สะดวก
        </h1>
        <p className="text-sm font-thai text-muted-foreground mb-6">
          HerbBot PLK กำลังปรับปรุงระบบ (Maintenance Mode)
        </p>

        {/* Message Box */}
        <div className="bg-muted/50 rounded-2xl p-4 border border-border/60 text-left mb-6 space-y-2">
          <div className="flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs sm:text-sm text-foreground leading-relaxed">
              {displayMessage}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
            🌿 ทีมงานกลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก สำนักงานสาธารณสุขจังหวัดพิษณุโลก กำลังดูแลและปรับปรุงข้อมูลให้ดียิ่งขึ้นครับ
          </p>
        </div>

        {/* Action Link for Admin */}
        <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            ต้องการแก้ไขระบบ?
          </span>
          <button
            type="button"
            onClick={() => setShowAdminModal(true)}
            className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>เข้าสู่ระบบผู้ดูแล (Admin Login)</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </motion.div>

      {/* Admin Password Modal */}
      <AnimatePresence>
        {showAdminModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowAdminModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-2xl border border-border p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="w-10 h-10 rounded-full gradient-herbal flex items-center justify-center mx-auto mb-3 shadow-herbal">
                <Lock className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="text-base font-bold font-thai text-center text-foreground mb-1">
                สิทธิ์ผู้ดูแลระบบ (Admin Access)
              </h3>
              <p className="text-xs text-muted-foreground text-center mb-4">
                กรอกรหัสผ่านเพื่อเข้าใช้งานและแก้ไขระบบในระหว่างปิดปรับปรุง
              </p>

              <form onSubmit={handleAdminSubmit} className="space-y-3.5">
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="รหัสผ่านผู้ดูแล"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-background text-foreground focus:outline-none focus:ring-2 transition-all ${
                      error ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"
                    }`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {error && (
                  <p className="text-xs text-destructive text-center">
                    รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdminModal(false)}
                    className="flex-1 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl gradient-herbal text-primary-foreground text-xs font-medium shadow-herbal hover:opacity-95 transition-opacity cursor-pointer"
                  >
                    เข้าสู่ระบบ
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MaintenanceOverlay;
