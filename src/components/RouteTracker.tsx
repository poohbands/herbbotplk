import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView, updatePageDuration } from "@/lib/analytics-service";

export const RouteTracker = () => {
  const location = useLocation();
  const currentEventIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // 1. ถ้ามีหน้าก่อนหน้า ให้คำนวณและอัปเดตเวลาที่อยู่ (duration)
    if (currentEventIdRef.current) {
      const durationSec = (Date.now() - startTimeRef.current) / 1000;
      updatePageDuration(currentEventIdRef.current, durationSec);
    }

    // 2. บันทึก Pageview ของหน้าที่เข้ามาใหม่
    const event = trackPageView(location.pathname + location.search);
    currentEventIdRef.current = event.id;
    startTimeRef.current = Date.now();

    // 3. จัดการกรณีปิดแท็บหรือรีเฟรชหน้าเว็บ
    const handleBeforeUnload = () => {
      if (currentEventIdRef.current) {
        const durationSec = (Date.now() - startTimeRef.current) / 1000;
        updatePageDuration(currentEventIdRef.current, durationSec);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (currentEventIdRef.current) {
        const durationSec = (Date.now() - startTimeRef.current) / 1000;
        updatePageDuration(currentEventIdRef.current, durationSec);
      }
    };
  }, [location.pathname, location.search]);

  return null;
};
