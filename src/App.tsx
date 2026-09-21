import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RouteTracker } from "./components/RouteTracker";
import ChatPage from "./pages/ChatPage";
import AdminPage from "./pages/AdminPage";
import AiSettingsPage from "./pages/AiSettingsPage";
import HerbsPage from "./pages/HerbsPage";
import NotFound from "./pages/NotFound";
import { fetchRemoteAiProviders } from "@/lib/ai-providers-storage";
import { fetchRemoteKnowledgeSettings } from "@/lib/knowledge-settings";
import { fetchRemoteMaintenanceState } from "@/lib/maintenance-service";

const queryClient = new QueryClient();

const GOOGLE_DRIVE_ACADEMIC_URL = "https://drive.google.com/drive/folders/1sz0qE0VMWiyp-4bqmp_0phJpwTfpf7Oi";

const KnowledgeRedirect = () => {
  useEffect(() => {
    window.location.replace(GOOGLE_DRIVE_ACADEMIC_URL);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 font-thai text-center bg-background">
      <div className="space-y-4">
        <p className="text-lg font-medium text-foreground">กำลังนำท่านไปยังคลังเอกสารวิชาการ...</p>
        <p className="text-sm text-muted-foreground">
          หากระบบไม่เปลี่ยนหน้าอัตโนมัติ{" "}
          <a
            href={GOOGLE_DRIVE_ACADEMIC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline font-medium hover:text-primary/80"
          >
            คลิกที่นี่เพื่อเปิด Google Drive เอกสารวิชาการ
          </a>
        </p>
      </div>
    </div>
  );
};

const App = () => {
  useEffect(() => {
    // ซิงค์การตั้งค่าส่วนกลางจาก Supabase เมื่อเปิดเว็บครั้งแรกบนทุกอุปกรณ์
    fetchRemoteAiProviders().catch(() => {});
    fetchRemoteKnowledgeSettings().catch(() => {});
    fetchRemoteMaintenanceState().catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <RouteTracker />
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/ai-settings" element={<AiSettingsPage />} />
            <Route path="/admin/knowledge" element={<KnowledgeRedirect />} />
            <Route path="/knowledge" element={<KnowledgeRedirect />} />
            <Route path="/herbs" element={<HerbsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
