import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  activateFramework,
  createCustomFramework,
  fetchAllFrameworkPillars,
  fetchFrameworks,
  type NewPillarInput,
} from "@/lib/frameworks";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["content-frameworks"] });
  queryClient.invalidateQueries({ queryKey: ["framework-pillars"] });
  queryClient.invalidateQueries({ queryKey: ["active-framework"] });
  queryClient.invalidateQueries({ queryKey: ["active-framework-pillars"] });
  queryClient.invalidateQueries({ queryKey: ["content-balance"] });
}

export function FrameworkPickerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: frameworks = [] } = useQuery({
    queryKey: ["content-frameworks"],
    queryFn: fetchFrameworks,
  });
  const { data: pillars = [] } = useQuery({
    queryKey: ["framework-pillars"],
    queryFn: fetchAllFrameworkPillars,
  });

  const activeId = frameworks.find((f) => f.is_active)?.id ?? "";
  const [selected, setSelected] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(activeId);
      setConfirming(false);
    }
  }, [open, activeId]);

  const mutation = useMutation({
    mutationFn: () => activateFramework(selected),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Kerangka aktif diganti.");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Gagal: " + e.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ganti Kerangka Konten</DialogTitle>
          </DialogHeader>

          <RadioGroup value={selected} onValueChange={setSelected} className="gap-3">
            {frameworks.map((f) => {
              const fp = pillars.filter((p) => p.framework_id === f.id);
              return (
                <label
                  key={f.id}
                  htmlFor={`fw-${f.id}`}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50 ${
                    selected === f.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <RadioGroupItem id={`fw-${f.id}`} value={f.id} className="mt-1" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {f.name}
                      {f.origin && (
                        <span className="rounded-full border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {f.origin}
                        </span>
                      )}
                      {f.is_active && (
                        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Sedang Dipakai
                        </span>
                      )}
                    </p>
                    {f.description && (
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {fp.map((p) => (
                        <span
                          key={p.id}
                          className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
                        >
                          <span
                            className="inline-block size-2 rounded-full"
                            style={{ backgroundColor: p.color_hex ?? "transparent" }}
                          />
                          {p.name} {p.ideal_percentage ?? 0}%
                        </span>
                      ))}
                    </div>
                  </div>
                </label>
              );
            })}
          </RadioGroup>

          {confirming && selected !== activeId && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
              Mengganti kerangka mengubah cara keseimbangan konten dihitung. Konten yang sudah
              ditandai pilar lama perlu ditandai ulang. Ganti kerangka?
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" size="sm" onClick={() => setCustomOpen(true)}>
              <Plus className="size-4" /> Buat Kerangka Sendiri
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button
                disabled={!selected || selected === activeId || mutation.isPending}
                onClick={() => {
                  if (!confirming) {
                    setConfirming(true);
                    return;
                  }
                  mutation.mutate();
                }}
              >
                {confirming ? "Ya, Ganti Kerangka" : "Ganti"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomFrameworkDialog open={customOpen} onOpenChange={setCustomOpen} />
    </>
  );
}

type DraftPillar = NewPillarInput;

const EMPTY_PILLAR: DraftPillar = {
  name: "",
  description: "",
  ideal_percentage: 0,
  color_hex: "#3B82F6",
  examples: "",
};

export function CustomFrameworkDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [description, setDescription] = useState("");
  const [draftPillars, setDraftPillars] = useState<DraftPillar[]>([{ ...EMPTY_PILLAR }]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setOrigin("");
    setDescription("");
    setDraftPillars([{ ...EMPTY_PILLAR }]);
  }, [open]);

  const total = draftPillars.reduce((s, p) => s + (Number(p.ideal_percentage) || 0), 0);

  const patch = (i: number, v: Partial<DraftPillar>) =>
    setDraftPillars((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...v } : p)));

  const mutation = useMutation({
    mutationFn: () =>
      createCustomFramework({
        name: name.trim(),
        origin: origin.trim() || null,
        description: description.trim() || null,
        pillars: draftPillars
          .filter((p) => p.name.trim())
          .map((p) => ({ ...p, name: p.name.trim(), ideal_percentage: Number(p.ideal_percentage) || 0 })),
      }),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Kerangka baru dibuat. Pilih untuk mengaktifkannya.");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Gagal: " + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buat Kerangka Sendiri</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cf-name">Nama Kerangka *</Label>
              <Input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-origin">Asal (opsional)</Label>
              <Input
                id="cf-origin"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Misal: Racikan internal KRD"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cf-desc">Deskripsi</Label>
              <Textarea
                id="cf-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Pilar</p>
              <p
                className={`text-xs ${total === 100 ? "text-emerald-600" : "text-orange-600"}`}
              >
                Total porsi: {total}%{total !== 100 ? " (sebaiknya 100%)" : ""}
              </p>
            </div>

            {draftPillars.map((p, i) => (
              <div key={i} className="space-y-2 rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={p.name}
                    onChange={(e) => patch(i, { name: e.target.value })}
                    placeholder="Nama pilar"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="w-20"
                    value={p.ideal_percentage}
                    onChange={(e) => patch(i, { ideal_percentage: Number(e.target.value) })}
                  />
                  <input
                    type="color"
                    aria-label="Warna pilar"
                    className="size-9 shrink-0 rounded border"
                    value={p.color_hex}
                    onChange={(e) => patch(i, { color_hex: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Hapus pilar"
                    onClick={() => setDraftPillars((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Input
                  value={p.description ?? ""}
                  onChange={(e) => patch(i, { description: e.target.value })}
                  placeholder="Deskripsi singkat"
                />
                <Input
                  value={p.examples ?? ""}
                  onChange={(e) => patch(i, { examples: e.target.value })}
                  placeholder="Contoh konten"
                />
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setDraftPillars((prev) => [...prev, { ...EMPTY_PILLAR }])}
            >
              <Plus className="size-4" /> Tambah Pilar
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            disabled={mutation.isPending}
            onClick={() => {
              if (!name.trim()) {
                toast.error("Nama kerangka wajib diisi.");
                return;
              }
              if (!draftPillars.some((p) => p.name.trim())) {
                toast.error("Tambahkan minimal satu pilar.");
                return;
              }
              mutation.mutate();
            }}
          >
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
