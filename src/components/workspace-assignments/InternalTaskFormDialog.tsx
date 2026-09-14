import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info } from "lucide-react";
import { useDivisions, useProfiles, type Profile } from "@/hooks/useProfile";
import {
  CATEGORY_SUGGESTIONS,
  canAssignTo,
  roleTier,
  type CreateInternalAssignmentInput,
  type VisibilityFlags,
} from "@/lib/internal-assignments";

const VISIBILITY_OPTIONS: { key: keyof VisibilityFlags; label: string }[] = [
  { key: "atasan_langsung", label: "Atasan langsung saya" },
  { key: "semua_atasan", label: "Semua atasan di atas saya" },
  { key: "divisi_assigner", label: "Anggota divisi saya" },
  { key: "divisi_penerima", label: "Anggota divisi penerima" },
  { key: "supervisor", label: "Pembina (Supervisor)" },
];

export function InternalTaskFormDialog({
  open,
  onOpenChange,
  me,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me: Profile | null | undefined;
  saving?: boolean;
  onSubmit: (values: CreateInternalAssignmentInput) => void;
}) {
  const { data: profiles = [] } = useProfiles();
  const { data: divisions = [] } = useDivisions();

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [category, setCategory] = useState("");
  const [scope, setScope] = useState<"Semua" | "Divisi" | "Individu">("Individu");
  const [targetDivision, setTargetDivision] = useState<string>("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [allowText, setAllowText] = useState(true);
  const [allowFile, setAllowFile] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [flags, setFlags] = useState<VisibilityFlags>({});
  const [memberQuery, setMemberQuery] = useState("");

  const tier = roleTier(me?.role);

  const assignableMembers = useMemo(
    () =>
      (profiles ?? []).filter(
        (p) => (p?.status ?? "Active") === "Active" && canAssignTo(me ?? null, p),
      ),
    [profiles, me],
  );

  const filteredMembers = useMemo(() => {
    const q = (memberQuery ?? "").toLowerCase().trim();
    if (!q) return assignableMembers;
    return assignableMembers.filter((p) => (p?.full_name ?? "").toLowerCase().includes(q));
  }, [assignableMembers, memberQuery]);

  const crossDivision = useMemo(() => {
    if (scope === "Divisi") return !!targetDivision && targetDivision !== (me?.division ?? null);
    if (scope !== "Individu") return false;
    return (memberIds ?? []).some((id) => {
      const p = (profiles ?? []).find((x) => x?.id === id);
      return !!p && (p.division ?? null) !== (me?.division ?? null);
    });
  }, [scope, targetDivision, memberIds, profiles, me]);

  const errors: string[] = [];
  if ((title ?? "").trim().length === 0) errors.push("Judul wajib diisi.");
  if ((title ?? "").length > 200) errors.push("Judul maksimal 200 karakter.");
  if ((instructions ?? "").trim().length < 20) errors.push("Instruksi minimal 20 karakter.");
  if (!allowText && !allowFile) errors.push("Pilih minimal satu cara pengumpulan.");
  if (scope === "Divisi" && !targetDivision) errors.push("Pilih divisi sasaran.");
  if (scope === "Individu" && memberIds.length === 0) errors.push("Pilih minimal satu anggota.");

  function reset() {
    setTitle("");
    setInstructions("");
    setCategory("");
    setScope("Individu");
    setTargetDivision("");
    setMemberIds([]);
    setAllowText(true);
    setAllowFile(false);
    setDueDate("");
    setFlags({});
    setMemberQuery("");
  }

  function handleSubmit() {
    if (errors.length > 0) return;
    onSubmit({
      title: (title ?? "").trim(),
      instructions: (instructions ?? "").trim(),
      category: (category ?? "").trim() || null,
      scope,
      target_division: scope === "Divisi" ? targetDivision : null,
      memberIds: scope === "Individu" ? memberIds : [],
      allow_text: allowText,
      allow_file: allowFile,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      visibility_flags: flags,
    });
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buat Tugas Baru</DialogTitle>
          <DialogDescription>
            Tugas internal untuk anggota yang bisa kamu tugasi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="task-title">Judul</Label>
            <Input
              id="task-title"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Rekap kebutuhan konsumsi acara"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-instructions">Instruksi</Label>
            <Textarea
              id="task-instructions"
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Jelaskan apa yang harus dikerjakan (minimal 20 karakter)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-category">Kategori</Label>
            <Input
              id="task-category"
              list="internal-task-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Koordinasi, Laporan, …"
            />
            <datalist id="internal-task-categories">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <Label>Sasaran</Label>
            <RadioGroup
              value={scope}
              onValueChange={(v) => setScope(v as "Semua" | "Divisi" | "Individu")}
              className="space-y-2"
            >
              {tier >= 2 && (
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Semua" id="scope-semua" />
                  <Label htmlFor="scope-semua" className="font-normal">
                    Seluruh Organisasi
                  </Label>
                </div>
              )}
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

            {scope === "Divisi" && (
              <Select value={targetDivision} onValueChange={setTargetDivision}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Pilih divisi" />
                </SelectTrigger>
                <SelectContent>
                  {(divisions ?? []).map((d) => (
                    <SelectItem key={d.code} value={d.code}>
                      {d.name ?? d.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {scope === "Individu" && (
              <div className="mt-2 space-y-2">
                <Input
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder="Cari nama anggota…"
                />
                <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border p-2">
                  {filteredMembers.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">
                      Tidak ada anggota yang bisa kamu tugasi.
                    </p>
                  ) : (
                    filteredMembers.map((p) => {
                      const checked = memberIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              setMemberIds((prev) =>
                                v === true
                                  ? [...prev, p.id]
                                  : prev.filter((x) => x !== p.id),
                              )
                            }
                          />
                          <span className="text-sm">
                            {p.full_name ?? "Tanpa nama"}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {p.role ?? "-"}
                              {p.division ? ` · ${p.division}` : ""}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {memberIds.length} anggota terpilih
                </p>
              </div>
            )}
          </div>

          {crossDivision && (
            <div className="flex gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 p-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-blue-600" />
              <p>
                Ada anggota dari divisi lain. Notifikasi akan dikirim ke seluruh anggota divisi
                mereka biar bisa saling bantu.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Cara pengumpulan</Label>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox checked={allowText} onCheckedChange={(v) => setAllowText(v === true)} />
              Boleh isi teks
            </label>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox checked={allowFile} onCheckedChange={(v) => setAllowFile(v === true)} />
              Boleh unggah file
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-due">Tenggat</Label>
            <Input
              id="task-due"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Siapa boleh melihat kumpulan?</Label>
            {VISIBILITY_OPTIONS.map((opt) => (
              <label key={opt.key} className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={flags[opt.key] === true}
                  onCheckedChange={(v) =>
                    setFlags((prev) => ({ ...prev, [opt.key]: v === true }))
                  }
                />
                {opt.label}
              </label>
            ))}
            <p className="text-xs text-muted-foreground">
              Anda sebagai pembuat tugas selalu bisa melihat kumpulan.
            </p>
          </div>

          {errors.length > 0 && (
            <ul className="list-inside list-disc rounded-xl bg-muted p-3 text-xs text-muted-foreground">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button disabled={errors.length > 0 || saving} onClick={handleSubmit}>
            {saving ? "Menyimpan…" : "Buat Tugas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
