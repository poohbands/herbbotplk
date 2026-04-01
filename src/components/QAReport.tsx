import { useState, useEffect, useMemo } from "react";
import { FileDown, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type QAItem = {
  date: string;
  time: string;
  question: string;
  answer: string;
};

const ITEMS_PER_PAGE = 20;

const MONTHS = [
  { value: "all", label: "ทุกเดือน" },
  { value: "1", label: "มกราคม" },
  { value: "2", label: "กุมภาพันธ์" },
  { value: "3", label: "มีนาคม" },
  { value: "4", label: "เมษายน" },
  { value: "5", label: "พฤษภาคม" },
  { value: "6", label: "มิถุนายน" },
  { value: "7", label: "กรกฎาคม" },
  { value: "8", label: "สิงหาคม" },
  { value: "9", label: "กันยายน" },
  { value: "10", label: "ตุลาคม" },
  { value: "11", label: "พฤศจิกายน" },
  { value: "12", label: "ธันวาคม" },
];

const QAReport = () => {
  const [qaData, setQaData] = useState<QAItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");

  useEffect(() => {
    loadQAData();
  }, []);

  const loadQAData = async () => {
    setLoading(true);
    try {
      // Fetch all user messages
      const { data: userMessages, error: userErr } = await supabase
        .from("chat_messages")
        .select("session_id, content, created_at")
        .eq("role", "user")
        .order("created_at", { ascending: false });

      if (userErr) throw userErr;

      // Fetch all assistant messages
      const { data: assistantMessages, error: assistErr } = await supabase
        .from("chat_messages")
        .select("session_id, content, created_at")
        .eq("role", "assistant")
        .order("created_at", { ascending: true });

      if (assistErr) throw assistErr;

      // Pair questions with answers by session and time proximity
      const pairs: QAItem[] = [];
      const assistantBySession = new Map<string, typeof assistantMessages>();
      
      for (const msg of assistantMessages || []) {
        if (!assistantBySession.has(msg.session_id)) {
          assistantBySession.set(msg.session_id, []);
        }
        assistantBySession.get(msg.session_id)!.push(msg);
      }

      for (const userMsg of userMessages || []) {
        const sessionAssistants = assistantBySession.get(userMsg.session_id) || [];
        const userTime = new Date(userMsg.created_at).getTime();
        
        // Find the closest assistant reply after this user message
        const answer = sessionAssistants.find(
          (a) => new Date(a.created_at).getTime() > userTime
        );

        const dt = new Date(userMsg.created_at);
        pairs.push({
          date: dt.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" }),
          time: dt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          question: userMsg.content,
          answer: answer?.content || "-",
        });

        // Remove used answer so it's not matched again
        if (answer) {
          const idx = sessionAssistants.indexOf(answer);
          sessionAssistants.splice(idx, 1);
        }
      }

      setQaData(pairs);
    } catch (e) {
      console.error("Failed to load Q&A data:", e);
    } finally {
      setLoading(false);
    }
  };

  // Get available years from data
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    qaData.forEach((item) => {
      const parts = item.date.split("/");
      if (parts.length === 3) years.add(parts[2]);
    });
    return Array.from(years).sort().reverse();
  }, [qaData]);

  // Filter data
  const filteredData = useMemo(() => {
    return qaData.filter((item) => {
      const parts = item.date.split("/");
      if (parts.length !== 3) return true;
      const [day, month, year] = parts;
      const monthNum = parseInt(month, 10).toString();

      if (selectedMonth !== "all" && monthNum !== selectedMonth) return false;
      if (selectedYear !== "all" && year !== selectedYear) return false;
      return true;
    });
  }, [qaData, selectedMonth, selectedYear]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [selectedMonth, selectedYear]);

  const exportCSV = () => {
    const header = "วันที่,เวลา,คำถาม,คำตอบ\n";
    const rows = filteredData.map((item) =>
      `"${item.date}","${item.time}","${item.question.replace(/"/g, '""')}","${item.answer.replace(/"/g, '""')}"`
    ).join("\n");
    
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + header + rows], { type: "text/csv;charset=utf-8;" });
    downloadFile(blob, "qa-report.csv");
  };

  const exportExcel = () => {
    // Generate a simple HTML table that Excel can open
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>QA Report</x:Name></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>`;
    html += `<tr><th>วันที่</th><th>เวลา</th><th>คำถาม</th><th>คำตอบ</th></tr>`;
    filteredData.forEach((item) => {
      html += `<tr><td>${item.date}</td><td>${item.time}</td><td>${escapeHtml(item.question)}</td><td>${escapeHtml(item.answer)}</td></tr>`;
    });
    html += `</table></body></html>`;
    
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    downloadFile(blob, "qa-report.xls");
  };

  const escapeHtml = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-card rounded-xl border border-border p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold font-thai text-foreground flex items-center gap-2">
            📋 รายงานคำถาม-คำตอบทั้งหมด
          </h3>
          <p className="text-xs text-muted-foreground">{filteredData.length} รายการ</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="เดือน" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue placeholder="ปี" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกปี</SelectItem>
              {availableYears.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV} className="h-8 text-xs gap-1">
            <FileDown className="w-3.5 h-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} className="h-8 text-xs gap-1">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-sm text-muted-foreground animate-pulse">กำลังโหลดข้อมูล...</p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-sm text-muted-foreground">ไม่พบข้อมูล</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[100px] text-xs font-semibold">วันที่</TableHead>
                  <TableHead className="w-[70px] text-xs font-semibold">เวลา</TableHead>
                  <TableHead className="text-xs font-semibold">คำถาม</TableHead>
                  <TableHead className="text-xs font-semibold">คำตอบ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((item, i) => (
                  <TableRow key={`${item.date}-${item.time}-${i}`}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{item.date}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</TableCell>
                    <TableCell className="text-xs max-w-[300px]">
                      <p className="line-clamp-2">{item.question}</p>
                    </TableCell>
                    <TableCell className="text-xs max-w-[400px]">
                      <p className="line-clamp-3">{item.answer}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">
              หน้า {currentPage} / {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                    className="h-8 w-8 p-0 text-xs"
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default QAReport;
