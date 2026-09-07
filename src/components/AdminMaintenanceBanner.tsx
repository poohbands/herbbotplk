import { Wrench, Power, LayoutDashboard, LogOut } from "lucide-react";
import { useMaintenanceMode, setAdminAuthenticated } from "@/lib/maintenance-service";
import { toast } from "sonner";

export const AdminMaintenanceBanner = () => {
  const { isMaintenance, setMaintenance, isAdmin } = useMaintenanceMode();

  if (!isMaintenance || !isAdmin) return null;

  const handleTurnOff = () => {
    setMaintenance(false);
    toast.success("ปิดโหมดปรับปรุงระบบแล้ว (เปิดให้บุคคลทั่วไปใช้งานตามปกติ)");
  };

  const handleLogoutAdmin = () => {
    setAdminAuthenticated(false);
    toast.info("ออกจากระบบผู้ดูแลแล้ว (กำลังแสดงมุมมองผู้ใช้ทั่วไป)");
  };

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs px-3 py-2 sticky top-0 z-40 backdrop-blur-md shadow-xs">
      <div className="container max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
          <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-medium">
            <strong>โหมดปิดปรับปรุงระบบทำงานอยู่:</strong> บุคคลทั่วไปจะไม่สามารถใช้งานได้ (คุณกำลังดูด้วยสิทธิ์ผู้ดูแลระบบ Admin)
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleTurnOff}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium text-[11px] transition-colors shadow-xs cursor-pointer"
            title="คลิกเพื่อปิดโหมดปรับปรุง และเปิดให้บุคคลทั่วไปใช้งานตามปกติ"
          >
            <Power className="w-3 h-3" />
            <span>ปิดโหมดปรับปรุง (เปิดระบบ)</span>
          </button>

          <a
            href="/admin"
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 text-[11px] font-medium transition-colors"
          >
            <LayoutDashboard className="w-3 h-3" />
            <span>แดชบอร์ด</span>
          </a>

          <button
            type="button"
            onClick={handleLogoutAdmin}
            className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] transition-colors cursor-pointer"
            title="ออกจากระบบแอดมิน เพื่อตรวจสอบมุมมองที่ผู้ใช้ทั่วไปเห็น"
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden sm:inline">สลับเป็นมุมมองผู้ใช้</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminMaintenanceBanner;
