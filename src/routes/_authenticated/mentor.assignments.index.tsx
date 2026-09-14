import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ClipboardList, Download, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/lib/supabase-external";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDivisions, useMyProfile, useProfiles, isSupervisor } from "@/hooks/useProfile";
import { exportAllAssignments } from "@/lib/assignments-export";

export const Route = createFileRoute("/_authenticated/mentor/assignments/")({
  head: () => ({
    meta: [
      { title: "Kelola Tugas dari Pembina — OrgTool" },
      {
        name: "description",
        content: "Buat, pantau, dan verifikasi tugas Pembina untuk anggota organisasi.",
      },
      { property: "og:title", content: "Kelola Tugas dari Pembina — OrgTool" },
      {
        property: "og:description",
        content: "Buat, pantau, dan verifikasi tugas Pembina untuk anggota organisasi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManageAssignmentsPage,
});

/* ------------------------------- tipe data ------------------------------- */

type AssignmentRow = {
  id: string;
  title: string | null;
  instructions: string | null;
  category: string | null;
  scope: string | null;
  target_division: string | null;
  visibility: string | null;
  allow_text: boolean | null;
  allow_file: boolean | null;
  due_date: string | null;
  created_by: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

type ProgressRow = {
  assignment_id: string | null;
  total_target: number | null;
  total_submitted: number | null;
};

type TargetCount = Record<string, number>;

/* --------------------------------- utils --------------------------------- */

function fmtDate(value: string | null | undefined): string {
  if (!value) return "Tanpa tenggat";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Tanpa tenggat";
  try {
    return format(d, "d MMM yyyy, HH:mm", { locale: idLocale });
  } catch {
    return "Tanpa tenggat";
  }
}

function lower(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

/* -------------------------------- queries -------------------------------- */

async function fetchAssignments(): Promise<AssignmentRow[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message ?? "Gagal memuat daftar tugas.");
  return (data ?? []) as AssignmentRow[];
}

async function fetchProgress(): Promise<ProgressRow[]> {
  const { data, error } = await supabase
    .from("assignment_progress")
    .select("assignment_id, total_target, total_submitted");
  if (error) throw new Error(error.message ?? "Gagal memuat rekap pengumpulan.");
  return (data ?? []) as ProgressRow[];
}

async function fetchTargetCounts(): Promise<TargetCount> {
  const { data, error } = await supabase.from("assignment_targets").select("assignment_id");
  if (error) return {};
  const counts: TargetCount = {};
  (data ?? []).forEach((row) => {
    const key = (row as { assignment_id?: string | null })?.assignment_id;
    if (key) counts[key] = (counts[key] ?? 0) + 1;
  });
  return counts;
}

/* ------------------------------- komponen -------------------------------- */

function ManageAssignmentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useMyProfile();
  const { data: divisions = [] } = useDivisions();

  const [status, setStatus] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentRow | null>(null);

  const assignmentsQuery = useQuery({
    queryKey: ["mentor-assignments-list"],
    queryFn: fetchAssignments,
  });
  const progressQuery = useQuery({
    queryKey: ["mentor-assignments-progress"],
    queryFn: fetchProgress,
  });
  const targetsQuery = useQuery({
    queryKey: ["mentor-assignments-target-counts"],
    queryFn: fetchTargetCounts,
  });

  const assignments = useMemo(() => assignmentsQuery.data ?? [], [assignmentsQuery.data]);
  const progressMap = useMemo(() => {
    const map = new Map<string, ProgressRow>();
    (progressQuery.data ?? []).forEach((row) => {
      if (row?.assignment_id) map.set(row.assignment_id, row);
    });
    return map;
  }, [progressQuery.data]);
  const targetCounts = targetsQuery.data ?? {};

  const categories = useMemo(() => {
    const set = new Set<string>();
    assignments.forEach((a) => {
      const c = (a?.category ?? "").trim();
      if (c) set.add(c);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [assignments]);

  const filtered = useMemo(() => {
    const q = lower(search).trim();
    return assignments.filter((a) => {
      if (status === "active" && a?.is_active !== true) return false;
      if (status === "inactive" && a?.is_active === true) return false;
      if (category !== "all" && (a?.category ?? "") !== category) return false;
      if (q && !lower(a?.title).includes(q)) return false;
      return true;
    });
  }, [assignments, status, category, search]);

  const toggleActive = useMutation({
    mutationFn: async (row: AssignmentRow) => {
      const { error } = await supabase
        .from("assignments")
        .update({ is_active: !(row?.is_active === true), updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw new Error(error.message ?? "Gagal memperbarui status tugas.");
    },
    onSuccess: () => {
      toast.success("Status tugas diperbarui.");
      queryClient.invalidateQueries({ queryKey: ["mentor-assignments-list"] });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Terjadi kesalahan."),
  });

  const removeAssignment = useMutation({
    mutationFn: async (row: AssignmentRow) => {
      const { error } = await supabase.from("assignments").delete().eq("id", row.id);
      if (error) throw new Error(error.message ?? "Gagal menghapus tugas.");
    },
    onSuccess: () => {
      toast.success("Tugas dihapus.");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["mentor-assignments-list"] });
      queryClient.invalidateQueries({ queryKey: ["mentor-assignments-progress"] });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Terjadi kesalahan."),
  });

  const exporting = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("Profil belum siap.");
      await exportAllAssignments(profile.id);
    },
    onSuccess: () => toast.success("File berhasil diunduh."),
    onError: (e: Error) => toast.error(e?.message ?? "Gagal membuat file."),
  });

  if (profile && !isSupervisor(profile?.role)) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-10 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">Halaman ini hanya untuk Pembina.</p>
      </div>
    );
  }

  const loading = assignmentsQuery.isLoading || progressQuery.isLoading;
  const queryError = assignmentsQuery.error ?? progressQuery.error;

  function sasaranLabel(a: AssignmentRow): string {
    if (a?.scope === "Semua") return "Seluruh Organisasi";
    if (a?.scope === "Divisi") {
      const name = divisions.find((d) => d?.code === a?.target_division)?.name;
      return `Divisi ${name ?? a?.target_division ?? "-"}`;
    }
    return `${targetCounts?.[a?.id] ?? 0} anggota terpilih`;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardList className="size-6 text-primary" /> Kelola Tugas dari Pembina
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Buat, pantau, dan verifikasi tugas untuk anggota.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={exporting.isPending}
            onClick={() => exporting.mutate()}
          >
            {exporting.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {exporting.isPending ? "Menyiapkan file…" : "Export ke Excel"}
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" /> Buat Tugas Baru
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="inactive">Nonaktif</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kategori</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Cari judul tugas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {queryError ? (
        <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto size-6 text-destructive" />
          <p className="mt-2 text-sm font-medium">Data tugas gagal dimuat.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {(queryError as Error)?.message ?? "Terjadi kesalahan."}
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => {
              assignmentsQuery.refetch();
              progressQuery.refetch();
            }}
          >
            Coba lagi
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            {assignments.length === 0
              ? "Belum ada tugas yang dibuat. Klik 'Buat Tugas Baru' untuk mulai."
              : "Tidak ada tugas yang cocok dengan filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const prog = progressMap.get(a?.id);
            const total = Number(prog?.total_target ?? 0) || 0;
            const submitted = Number(prog?.total_submitted ?? 0) || 0;
            const percent = total > 0 ? Math.round((submitted / total) * 100) : 0;
            const cat = (a?.category ?? "").trim();
            return (
              <div key={a?.id} className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{a?.title ?? "Tanpa judul"}</h3>
                  {cat && (
                    <span className="rounded-full border bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                      {cat}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      a?.is_active === true
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {a?.is_active === true ? "Aktif" : "Nonaktif"}
                  </span>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  {sasaranLabel(a)} · Tenggat: {fmtDate(a?.due_date)}
                </p>

                <div className="mt-3 space-y-1">
                  {total > 0 ? (
                    <>
                      <Progress value={percent} />
                      <p className="text-xs text-muted-foreground">
                        {submitted} dari {total} terkumpul ({percent}%)
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">0 target</p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      navigate({ to: "/mentor/assignments/$id", params: { id: a.id } })
                    }
                  >
                    Detail
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={toggleActive.isPending}
                    onClick={() => toggleActive.mutate(a)}
                  >
                    {a?.is_active === true ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(a)}>
                    <Trash2 className="size-4" /> Hapus
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateAssignmentDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        createdBy={profile?.id ?? null}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["mentor-assignments-list"] });
          queryClient.invalidateQueries({ queryKey: ["mentor-assignments-progress"] });
          queryClient.invalidateQueries({ queryKey: ["mentor-assignments-target-counts"] });
        }}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus tugas ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Tugas &quot;{deleteTarget?.title ?? "-"}&quot; beserta datanya akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) removeAssignment.mutate(deleteTarget);
              }}
            >
              {removeAssignment.isPending ? "Menghapus…" : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------------------------- dialog buat tugas --------------------------- */

function CreateAssignmentDialog({
  open,
  onOpenChange,
  createdBy,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createdBy: string | null;
  onCreated: () => void;
}) {
  const { data: divisions = [] } = useDivisions();
  const { data: profiles = [] } = useProfiles();

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [category, setCategory] = useState("");
  const [scope, setScope] = useState("Semua");
  const [targetDivision, setTargetDivision] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [visibility, setVisibility] = useState("Supervisor_Saja");
  const [allowText, setAllowText] = useState(true);
  const [allowFile, setAllowFile] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle("");
    setInstructions("");
    setCategory("");
    setScope("Semua");
    setTargetDivision("");
    setMemberIds([]);
    setVisibility("Supervisor_Saja");
    setAllowText(true);
    setAllowFile(false);
    setDueDate("");
  }

  const valid =
    title.trim().length > 0 &&
    instructions.trim().length > 0 &&
    (allowText || allowFile) &&
    (scope !== "Divisi" || !!targetDivision) &&
    (scope !== "Individu" || memberIds.length > 0);

  async function submit() {
    if (!valid || saving) return;
    if (!createdBy) {
      toast.error("Profil belum siap, coba lagi sebentar.");
      return;
    }
    setSaving(true);
    try {
      let due: string | null = null;
      if (dueDate) {
        const d = new Date(dueDate);
        due = Number.isNaN(d.getTime()) ? null : d.toISOString();
      }
      const { data, error } = await supabase
        .from("assignments")
        .insert({
          title: title.trim(),
          instructions: instructions.trim(),
          category: category.trim() || null,
          scope,
          target_division: scope === "Divisi" ? targetDivision || null : null,
          visibility,
          allow_text: allowText,
          allow_file: allowFile,
          due_date: due,
          created_by: createdBy,
          is_active: true,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message ?? "Gagal membuat tugas.");

      if (scope === "Individu" && memberIds.length > 0 && data?.id) {
        const { error: tErr } = await supabase
          .from("assignment_targets")
          .insert(memberIds.map((m) => ({ assignment_id: data.id, member_id: m })));
        if (tErr) throw new Error(tErr.message ?? "Gagal menyimpan anggota sasaran.");
      }

      toast.success("Tugas berhasil dibuat.");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buat Tugas Baru</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Judul</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Instruksi</Label>
            <Textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Kategori</Label>
            <Input
              list="assignment-category-suggestions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Refleksi, Materi, Laporan…"
            />
            <datalist id="assignment-category-suggestions">
              <option value="Refleksi" />
              <option value="Materi" />
              <option value="Laporan" />
              <option value="Lainnya" />
            </datalist>
          </div>

          <div className="space-y-2">
            <Label>Sasaran</Label>
            <RadioGroup value={scope} onValueChange={setScope}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="Semua" id="scope-semua" />
                <Label htmlFor="scope-semua" className="font-normal">
                  Seluruh Organisasi
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="Divisi" id="scope-divisi" />
                <Label htmlFor="scope-divisi" className="font-normal">
                  Divisi tertentu
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="Individu" id="scope-individu" />
                <Label htmlFor="scope-individu" className="font-normal">
                  Anggota tertentu
                </Label>
              </div>
            </RadioGroup>
          </div>

          {scope === "Divisi" && (
            <Select value={targetDivision} onValueChange={setTargetDivision}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih divisi" />
              </SelectTrigger>
              <SelectContent>
                {(divisions ?? []).map((d) => (
                  <SelectItem key={d?.code} value={d?.code}>
                    {d?.name ?? d?.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {scope === "Individu" && (
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border p-3">
              {(profiles ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada anggota.</p>
              ) : (
                (profiles ?? []).map((p) => (
                  <label key={p?.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={memberIds.includes(p?.id)}
                      onCheckedChange={(c) =>
                        setMemberIds((prev) =>
                          c ? [...prev, p.id] : prev.filter((x) => x !== p.id),
                        )
                      }
                    />
                    {p?.full_name ?? "Tanpa nama"}
                  </label>
                ))
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Visibilitas kumpulan</Label>
            <RadioGroup value={visibility} onValueChange={setVisibility}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="Supervisor_Saja" id="vis-1" />
                <Label htmlFor="vis-1" className="font-normal">
                  Hanya Pembina lihat
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="Supervisor_Ketua_Kadiv" id="vis-2" />
                <Label htmlFor="vis-2" className="font-normal">
                  Pembina + Ketua + Kadiv divisi terkait lihat
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Bentuk jawaban</Label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={allowText} onCheckedChange={(c) => setAllowText(!!c)} />
              Boleh isi teks
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={allowFile} onCheckedChange={(c) => setAllowFile(!!c)} />
              Boleh unggah file
            </label>
          </div>

          <div className="space-y-2">
            <Label>Tenggat (opsional)</Label>
            <Input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={submit} disabled={!valid || saving}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
