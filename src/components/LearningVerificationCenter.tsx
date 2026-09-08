import { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  Trash2,
  BookOpen,
  Search,
  Save,
  Sparkles,
  RefreshCw,
  Plus,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getLearningQueue,
  approveAndLearnKnowledge,
  rejectLearningItem,
  removeLearningItem,
  addToLearningQueue,
  type VerificationItem,
  type ReviewStatus,
  LEARNING_EVENT,
} from "@/lib/learning-verification-service";

export const LearningVerificationCenter = () => {
  const [queue, setQueue] = useState<VerificationItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<VerificationItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states for Review & Edit
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editCategory, setEditCategory] = useState("faq");
  const [editReferences, setEditReferences] = useState("");
  const [editVerifier, setEditVerifier] = useState("กลุ่มงานการแพทย์แผนไทย สสจ.พิษณุโลก");

  // Form states for New Item
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");

  const loadQueue = () => {
    setQueue(getLearningQueue());
  };

  useEffect(() => {
    loadQueue();
    const handleChanged = () => loadQueue();
    window.addEventListener(LEARNING_EVENT, handleChanged);
    window.addEventListener("storage", handleChanged);
    return () => {
      window.removeEventListener(LEARNING_EVENT, handleChanged);
      window.removeEventListener("storage", handleChanged);
    };
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const total = queue.length;
    const pending = queue.filter((q) => q.status === "pending").length;
    const verified = queue.filter((q) => q.status === "verified").length;
    const rejected = queue.filter((q) => q.status === "rejected").length;
    const withFeedback = queue.filter((q) => !!q.userFeedback).length;
    return { total, pending, verified, rejected, withFeedback };
  }, [queue]);

  // Filtered list
  const filteredList = useMemo(() => {
    return queue.filter((item) => {
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.question.toLowerCase().includes(q) ||
          item.verifiedAnswer.toLowerCase().includes(q) ||
          item.originalAnswer.toLowerCase().includes(q) ||
          item.feedbackComment?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [queue, filterStatus, search]);

  const openReviewModal = (item: VerificationItem) => {
    setSelectedItem(item);
    setEditQuestion(item.question);
    setEditAnswer(item.verifiedAnswer || item.originalAnswer);
    setEditCategory(item.category || "faq");
    setEditReferences(item.references || "");
    setEditVerifier(item.verifiedBy || "กลุ่มงานการแพทย์แผนไทย สสจ.พิษณุโลก");
    setIsEditOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedItem) return;
    if (!editAnswer.trim()) {
      toast.error("กรุณากรอกคำตอบที่ผ่านการตรวจทาน");
      return;
    }

    setSaving(true);
    try {
      const res = await approveAndLearnKnowledge(
        {
          ...selectedItem,
          question: editQuestion.trim(),
          verifiedAnswer: editAnswer.trim(),
          category: editCategory,
          references: editReferences.trim() || undefined,
        },
        editVerifier.trim()
      );

      if (res.success) {
        toast.success("อนุมัติเข้าคลังความรู้สำเร็จ! AI จะใช้ข้อมูลนี้เป็นคำตอบหลักในอนาคต");
        setIsEditOpen(false);
        loadQueue();
      } else {
        toast.error(res.error || "เกิดข้อผิดพลาดในการอนุมัติ");
      }
    } catch (e: any) {
      toast.error(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = (item: VerificationItem) => {
    rejectLearningItem(item.id, "ข้อมูลไม่สอดคล้องตามแนวทางเวชปฏิบัติหรือต้องการปรับปรุง");
    toast.info("บันทึกสถานะปฏิเสธแล้ว");
    loadQueue();
  };

  const handleDelete = (item: VerificationItem) => {
    removeLearningItem(item.id);
    toast.success("ลบรายการออกจากคิวเรียบร้อย");
    loadQueue();
  };

  const handleAddNew = () => {
    if (!newQuestion.trim() || !newAnswer.trim()) {
      toast.error("กรุณากรอกทั้งคำถามและคำตอบ");
      return;
    }

    addToLearningQueue(newQuestion.trim(), newAnswer.trim());
    toast.success("เพิ่มคำถาม-คำตอบเข้าคิวตรวจทานเรียบร้อย");
    setNewQuestion("");
    setNewAnswer("");
    setIsAddOpen(false);
    loadQueue();
  };

  return (
    <div className="space-y-4">
      {/* Header & Stats Card */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-herbal flex items-center justify-center text-primary-foreground shadow-herbal">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-thai text-foreground flex items-center gap-2">
                ศูนย์เรียนรู้และตรวจสอบความรู้ (AI Learning & Verification Center)
              </h2>
              <p className="text-xs text-muted-foreground">
                ระบบตรวจสอบความถูกต้องโดยผู้เชี่ยวชาญ (Human-in-the-loop) ก่อนนำมาใช้ตอบปัญหาในอนาคต
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadQueue}
              className="text-xs gap-1 h-8"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>รีเฟรช</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setIsAddOpen(true)}
              className="text-xs gap-1 h-8 gradient-herbal text-primary-foreground shadow-herbal"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่ม Q&A ตรวจทาน</span>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
          <div className="bg-muted/40 rounded-xl p-3 border border-border/50">
            <span className="text-[11px] text-muted-foreground block">ทั้งหมดในระบบ</span>
            <span className="text-xl font-bold font-thai text-foreground mt-0.5 block">
              {stats.total}
            </span>
          </div>

          <div
            onClick={() => setFilterStatus("pending")}
            className={`cursor-pointer rounded-xl p-3 border transition-colors ${
              filterStatus === "pending"
                ? "bg-amber-500/15 border-amber-500/40"
                : "bg-muted/40 border-border/50 hover:bg-muted/60"
            }`}
          >
            <span className="text-[11px] text-amber-700 dark:text-amber-400 block flex items-center gap-1">
              <Clock className="w-3 h-3" /> รอตรวจสอบ
            </span>
            <span className="text-xl font-bold font-thai text-amber-700 dark:text-amber-300 mt-0.5 block">
              {stats.pending}
            </span>
          </div>

          <div
            onClick={() => setFilterStatus("verified")}
            className={`cursor-pointer rounded-xl p-3 border transition-colors ${
              filterStatus === "verified"
                ? "bg-emerald-500/15 border-emerald-500/40"
                : "bg-muted/40 border-border/50 hover:bg-muted/60"
            }`}
          >
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> รับรองความรู้แล้ว
            </span>
            <span className="text-xl font-bold font-thai text-emerald-700 dark:text-emerald-300 mt-0.5 block">
              {stats.verified}
            </span>
          </div>

          <div
            onClick={() => setFilterStatus("rejected")}
            className={`cursor-pointer rounded-xl p-3 border transition-colors ${
              filterStatus === "rejected"
                ? "bg-rose-500/15 border-rose-500/40"
                : "bg-muted/40 border-border/50 hover:bg-muted/60"
            }`}
          >
            <span className="text-[11px] text-rose-700 dark:text-rose-400 block flex items-center gap-1">
              <XCircle className="w-3 h-3" /> ปฏิเสธ/ไม่ถูกต้อง
            </span>
            <span className="text-xl font-bold font-thai text-rose-700 dark:text-rose-300 mt-0.5 block">
              {stats.rejected}
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 border-t border-border/50">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาคำถาม คำตอบ หรือข้อคิดเห็นผู้ใช้..."
              className="pl-8 text-xs h-9 bg-background"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="text-xs h-9 w-[140px] bg-background">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="pending">รอตรวจทาน</SelectItem>
                <SelectItem value="verified">รับรองแล้ว</SelectItem>
                <SelectItem value="rejected">ปฏิเสธ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Queue List */}
      <div className="space-y-2.5">
        {filteredList.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground space-y-2">
            <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/60" />
            <p className="text-sm font-medium font-thai">ไม่พบรายการคำถามที่ตรงกับเงื่อนไข</p>
            <p className="text-xs">
              เมื่อมีผู้ใช้พิมพ์ถามในแชท คำถาม-คำตอบจะปรากฏในศูนย์เรียนรู้นี้โดยอัตโนมัติ
            </p>
          </div>
        ) : (
          filteredList.map((item) => {
            const isVerified = item.status === "verified";
            const isRejected = item.status === "rejected";
            const isPending = item.status === "pending";

            return (
              <div
                key={item.id}
                className={`bg-card rounded-xl border p-4 transition-all space-y-3 ${
                  isVerified
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : isRejected
                    ? "border-rose-500/30 bg-rose-500/5 opacity-70"
                    : "border-border hover:border-border/80"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm font-thai text-foreground">
                        ❓ {item.question}
                      </span>
                      {isVerified && (
                        <Badge className="bg-emerald-600 text-white text-[10px] py-0 h-4 border-none gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> รับรองแล้ว
                        </Badge>
                      )}
                      {isPending && (
                        <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-500/40 text-[10px] py-0 h-4 gap-0.5">
                          <Clock className="w-2.5 h-2.5" /> รอตรวจทาน
                        </Badge>
                      )}
                      {isRejected && (
                        <Badge variant="destructive" className="text-[10px] py-0 h-4 gap-0.5">
                          <XCircle className="w-2.5 h-2.5" /> ปฏิเสธ
                        </Badge>
                      )}
                      {item.userFeedback === "helpful" && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          <ThumbsUp className="w-2.5 h-2.5" /> ผู้ใช้แจ้งว่ามีประโยชน์
                        </span>
                      )}
                      {item.userFeedback === "unhelpful" && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded">
                          <ThumbsDown className="w-2.5 h-2.5" /> ผู้ใช้แจ้งว่าไม่ถูกต้อง
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => openReviewModal(item)}
                      className={`text-xs h-7 px-2.5 gap-1 cursor-pointer ${
                        isVerified
                          ? "bg-muted hover:bg-muted/80 text-foreground"
                          : "gradient-herbal text-primary-foreground shadow-xs"
                      }`}
                    >
                      <Pencil className="w-3 h-3" />
                      <span>{isVerified ? "ดู/แก้ไขคำตอบ" : "ตรวจทานและอนุมัติ"}</span>
                    </Button>

                    {!isRejected && !isVerified && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReject(item)}
                        className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-500/10"
                        title="ปฏิเสธ ไม่นำไปใช้"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item)}
                      className="text-xs h-7 px-2 text-muted-foreground hover:text-destructive"
                      title="ลบรายการ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Answer Snippet */}
                <div className="bg-muted/30 rounded-lg p-3 text-xs text-foreground/90 font-thai leading-relaxed border border-border/40">
                  <div className="text-[10px] text-muted-foreground mb-1 font-medium flex items-center justify-between">
                    <span>
                      {isVerified ? "💡 คำตอบที่ผ่านการรับรองความถูกต้อง:" : "🤖 คำตอบที่ AI สร้างขึ้นเดิม:"}
                    </span>
                    {item.verifiedBy && (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        ผู้รับรอง: {item.verifiedBy}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-3 whitespace-pre-line">
                    {item.verifiedAnswer || item.originalAnswer}
                  </p>
                </div>

                {/* Feedback Comment if user left one */}
                {item.feedbackComment && (
                  <div className="text-[11px] p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
                    <strong>ข้อเสนอแนะจากผู้ใช้:</strong> {item.feedbackComment}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Review & Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-border bg-card">
          <DialogHeader className="p-5 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2 text-xs text-primary font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>ตรวจทานและรับรองความถูกต้องทางวิชาการ (Human-in-the-loop Verification)</span>
            </div>
            <DialogTitle className="text-base font-bold text-foreground mt-1">
              {selectedItem?.question}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              คำตอบที่ท่านอนุมัติจะถูกบันทึกเข้าคลังความรู้ และนำไปใช้ตอบผู้ใช้ที่มีคำถามเดียวกันในอนาคตทันที
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-thai">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">คำถาม (ปรับแต่งให้กระชับ ครอบคลุม)</Label>
              <Input
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  คำตอบที่ถูกต้องตามหลักวิชาการ (Verified Answer)
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  แก้ไข ปรับปรุง หรือเพิ่มข้อควรระวังให้ครบถ้วน 100%
                </span>
              </div>
              <Textarea
                value={editAnswer}
                onChange={(e) => setEditAnswer(e.target.value)}
                rows={8}
                className="text-xs font-thai leading-relaxed resize-none"
                placeholder="พิมพ์คำตอบที่ถูกต้องตามหลักวิชาการและการแพทย์แผนไทย..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">หมวดหมู่</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faq">คำถามพบบ่อย (FAQ)</SelectItem>
                    <SelectItem value="cannabis">ตำรับยากัญชาทางการแพทย์</SelectItem>
                    <SelectItem value="drug_interaction">Drug-Herb Interaction</SelectItem>
                    <SelectItem value="dosage">วิธีใช้และขนาดยา</SelectItem>
                    <SelectItem value="guideline">แนวทางเวชปฏิบัติ สสจ.พิษณุโลก</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">หน่วยงาน/ผู้รับรองความถูกต้อง</Label>
                <Input
                  value={editVerifier}
                  onChange={(e) => setEditVerifier(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">เอกสารอ้างอิงทางวิชาการ (ถ้ามี)</Label>
              <Input
                value={editReferences}
                onChange={(e) => setEditReferences(e.target.value)}
                placeholder="เช่น บัญชียาหลักแห่งชาติด้านสมุนไพร 2568, คู่มือการสั่งใช้ยากัญชา กรมการแพทย์แผนไทย"
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border bg-muted/20 flex flex-row items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(false)}
              className="text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApprove}
              disabled={saving}
              className="text-xs gradient-herbal text-primary-foreground shadow-herbal gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "กำลังบันทึก..." : "อนุมัติเข้าคลังความรู้ (Approve & Learn)"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Q&A Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              เพิ่มคำถาม-คำตอบเพื่อตรวจทานความรู้ใหม่
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              เพิ่มคำถามที่พบบ่อยเพื่อให้แอดมินหรือแพทย์แผนไทยตรวจทานและบรรจุเข้าคลังความรู้
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">คำถาม</Label>
              <Input
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="เช่น ยาศุขไสยาศน์กินอย่างไร มีข้อห้ามอะไร"
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">คำตอบร่างหรือเนื้อหาที่ต้องการให้ AI เรียนรู้</Label>
              <Textarea
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                rows={5}
                placeholder="พิมพ์คำตอบ..."
                className="text-xs font-thai"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddOpen(false)}
              className="text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddNew}
              className="text-xs gradient-herbal text-primary-foreground shadow-herbal"
            >
              เพิ่มเข้าคิวตรวจทาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LearningVerificationCenter;
