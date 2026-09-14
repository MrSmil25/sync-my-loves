import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useMyProfile } from "@/hooks/useProfile";
import { CONTENT_FORMATS, CONTENT_PLATFORMS, label, type ContentFormat, type ContentPlatform } from "@/lib/marketing";
import { fetchAllFrameworkPillars } from "@/lib/frameworks";
import { fetchPendingPerformance, savePerformance, type PendingPerformance, type PerformanceRecord } from "@/lib/content-performance";
import { supabase } from "@/lib/supabase-external";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const NONE = "__none__";
type NumericField = "reach" | "impressions" | "likes" | "comments" | "shares" | "saves" | "link_clicks" | "profile_visits" | "new_followers";
const EMPTY_NUMBERS: Record<NumericField, string> = { reach: "", impressions: "", likes: "", comments: "", shares: "", saves: "", link_clicks: "", profile_visits: "", new_followers: "" };

function datePart(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function PerformanceFormDialog({
  open,
  onOpenChange,
  initialPending,
  editing,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  initialPending?: PendingPerformance | null;
  editing?: PerformanceRecord | null;
}) {
  const queryClient = useQueryClient();
  const { data: profile } = useMyProfile();
  const { data: pending = [] } = useQuery({ queryKey: ["content-needs-performance"], queryFn: fetchPendingPerformance });
  const { data: pillars = [] } = useQuery({ queryKey: ["framework-pillars"], queryFn: fetchAllFrameworkPillars });
  const [step, setStep] = useState(1);
  const [source, setSource] = useState<"calendar" | "other">("calendar");
  const [planId, setPlanId] = useState(NONE);
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<ContentPlatform>("Instagram");
  const [format, setFormat] = useState<ContentFormat>("Feed_Tunggal");
  const [pillarId, setPillarId] = useState(NONE);
  const [postedDate, setPostedDate] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [metrics, setMetrics] = useState<Record<NumericField, string>>(EMPTY_NUMBERS);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    const seed = initialPending ?? null;
    setStep(1);
    setSource(editing?.content_plan_id || seed ? "calendar" : "other");
    setPlanId(editing?.content_plan_id ?? seed?.content_plan_id ?? NONE);
    setTitle(editing?.standalone_title ?? seed?.title ?? "");
    setPlatform(editing?.platform ?? seed?.platform ?? "Instagram");
    setFormat(editing?.format ?? "Feed_Tunggal");
    setPillarId(editing?.framework_pillar_id ?? NONE);
    setPostedDate(editing?.posted_date ?? datePart(seed?.published_at));
    setPostUrl(editing?.post_url ?? "");
    setMetrics({
      reach: editing?.reach?.toString() ?? "",
      impressions: editing?.impressions?.toString() ?? "",
      likes: editing?.likes?.toString() ?? "",
      comments: editing?.comments?.toString() ?? "",
      shares: editing?.shares?.toString() ?? "",
      saves: editing?.saves?.toString() ?? "",
      link_clicks: editing?.link_clicks?.toString() ?? "",
      profile_visits: editing?.profile_visits?.toString() ?? "",
      new_followers: editing?.new_followers?.toString() ?? "",
    });
    setNotes(editing?.notes ?? "");
  }, [open, initialPending, editing]);

  const selected = useMemo(() => pending.find((item) => item.content_plan_id === planId), [pending, planId]);
  useEffect(() => {
    if (!selected || editing) return;
    setTitle(selected.title ?? "");
    if (selected.platform) setPlatform(selected.platform);
    setPostedDate(datePart(selected.published_at));
  }, [selected, editing]);

  const mutation = useMutation({
    mutationFn: async () => {
      const userId = profile?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error("Sesi tidak ditemukan.");
      const numeric = (key: NumericField) => metrics[key] === "" ? null : Math.max(0, Number(metrics[key]) || 0);
      return savePerformance({
        content_plan_id: source === "calendar" && planId !== NONE ? planId : null,
        standalone_title: source === "other" ? title.trim() : null,
        platform,
        format,
        framework_pillar_id: pillarId === NONE ? null : pillarId,
        posted_date: postedDate,
        post_url: postUrl.trim() || null,
        reach: numeric("reach"), impressions: numeric("impressions"), likes: numeric("likes"), comments: numeric("comments"), shares: numeric("shares"), saves: numeric("saves"), link_clicks: numeric("link_clicks"), profile_visits: numeric("profile_visits"), new_followers: numeric("new_followers"),
        notes: notes.trim() || null,
        recorded_by: editing?.recorded_by ?? userId,
      }, editing?.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-performance"] });
      queryClient.invalidateQueries({ queryKey: ["content-needs-performance"] });
      queryClient.invalidateQueries({ queryKey: ["performance-views"] });
      toast.success(editing ? "Catatan performa diperbarui." : "Performa konten dicatat.");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(`Gagal menyimpan: ${error.message}`),
  });

  const validStepOne = source === "calendar" ? planId !== NONE : Boolean(title.trim());
  const metricInput = (key: NumericField, caption: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`metric-${key}`}>{caption}</Label>
      <Input id={`metric-${key}`} type="number" min={0} value={metrics[key]} onChange={(event) => setMetrics((current) => ({ ...current, [key]: event.target.value }))} placeholder="0" />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Performa" : "Catat Performa"}</DialogTitle>
          <div className="flex gap-1 pt-2" aria-label={`Langkah ${step} dari 4`}>
            {[1, 2, 3, 4].map((number) => <span key={number} className={`h-1.5 flex-1 rounded-full ${number <= step ? "bg-primary" : "bg-muted"}`} />)}
          </div>
        </DialogHeader>

        {step === 1 && <div className="space-y-4">
          <div><h3 className="font-semibold">Konten apa?</h3><p className="text-xs text-muted-foreground">Pilih konten dari kalender atau catat konten lain.</p></div>
          <RadioGroup value={source} onValueChange={(value) => setSource(value as "calendar" | "other")} className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer gap-2 rounded-lg border p-3"><RadioGroupItem value="calendar" /><span className="text-sm font-medium">Dari Kalender Konten</span></label>
            <label className="flex cursor-pointer gap-2 rounded-lg border p-3"><RadioGroupItem value="other" /><span className="text-sm font-medium">Konten Lain</span></label>
          </RadioGroup>
          {source === "calendar" ? <div className="space-y-1.5"><Label>Konten tayang *</Label><Select value={planId} onValueChange={setPlanId}><SelectTrigger><SelectValue placeholder="Pilih konten" /></SelectTrigger><SelectContent><SelectItem value={NONE}>Pilih konten</SelectItem>{pending.map((item) => item.content_plan_id && <SelectItem key={item.content_plan_id} value={item.content_plan_id}>{item.title ?? "Tanpa judul"} · {item.platform}</SelectItem>)}</SelectContent></Select></div> : <div className="space-y-1.5"><Label htmlFor="performance-title">Judul *</Label><Input id="performance-title" value={title} onChange={(event) => setTitle(event.target.value)} /></div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Platform</Label><Select value={platform} onValueChange={(value) => setPlatform(value as ContentPlatform)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CONTENT_PLATFORMS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Format</Label><Select value={format} onValueChange={(value) => setFormat(value as ContentFormat)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CONTENT_FORMATS.map((item) => <SelectItem key={item} value={item}>{label(item)}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Pilar Strategis</Label><Select value={pillarId} onValueChange={setPillarId}><SelectTrigger><SelectValue placeholder="Pilih pilar" /></SelectTrigger><SelectContent><SelectItem value={NONE}>Tanpa pilar</SelectItem>{pillars.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
        </div>}

        {step === 2 && <div className="space-y-4"><div><h3 className="font-semibold">Waktu & Link</h3><p className="text-xs text-muted-foreground">Kapan konten tayang dan di mana bisa dibuka.</p></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="posted-date">Tanggal Posting *</Label><Input id="posted-date" type="date" value={postedDate} onChange={(event) => setPostedDate(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="post-url">URL Postingan</Label><Input id="post-url" type="url" value={postUrl} onChange={(event) => setPostUrl(event.target.value)} placeholder="https://..." /></div></div></div>}

        {step === 3 && <div className="space-y-5"><div><h3 className="font-semibold">Metrik</h3><p className="text-xs text-muted-foreground">Isi yang kamu punya. Tidak semua platform kasih semua angka. Yang paling penting: Reach dan Saves.</p></div><section className="space-y-3"><h4 className="text-sm font-semibold">Jangkauan</h4><div className="grid gap-3 sm:grid-cols-2">{metricInput("reach", "Reach")}{metricInput("impressions", "Impressions")}</div></section><section className="space-y-3"><h4 className="text-sm font-semibold">Interaksi</h4><div className="grid gap-3 sm:grid-cols-2">{metricInput("likes", "Likes")}{metricInput("comments", "Comments")}{metricInput("shares", "Shares")}{metricInput("saves", "Saves")}</div></section><section className="space-y-3"><h4 className="text-sm font-semibold">Pertumbuhan</h4><div className="grid gap-3 sm:grid-cols-3">{metricInput("link_clicks", "Link Clicks")}{metricInput("profile_visits", "Profile Visits")}{metricInput("new_followers", "Follower Baru")}</div></section></div>}

        {step === 4 && <div className="space-y-3"><div><h3 className="font-semibold">Catatan</h3><p className="text-xs text-muted-foreground">Tambahkan konteks supaya angka lebih bermakna saat dipelajari nanti.</p></div><div className="space-y-1.5"><Label htmlFor="performance-notes">Catatan (opsional)</Label><Textarea id="performance-notes" rows={6} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ada yang khusus? (pakai tren audio tertentu, kolaborasi, jam posting, dll)" /></div></div>}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => step === 1 ? onOpenChange(false) : setStep((current) => current - 1)}><ArrowLeft className="size-4" /> {step === 1 ? "Batal" : "Kembali"}</Button>
          {step < 4 ? <Button disabled={(step === 1 && !validStepOne) || (step === 2 && !postedDate)} onClick={() => setStep((current) => current + 1)}>Lanjut <ArrowRight className="size-4" /></Button> : <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}><Check className="size-4" /> {mutation.isPending ? "Menyimpan…" : "Simpan"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
