import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useDivisions } from "@/hooks/useProfile";
import {
  ASSET_CATEGORIES,
  RESOURCE_SCOPES,
  USER_ROLES,
  createResource,
  rLabel,
  updateResource,
  type AssetCategory,
  type Resource,
  type ResourceKind,
  type ResourceScope,
} from "@/lib/resources";
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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";
const NEW_FOLDER = "__new__";

/**
 * Modal tambah / ubah resource (Alat Kerja atau Aset).
 * Termasuk pembuatan folder baru inline dari dropdown folder.
 */
export function ResourceFormDialog({
  open,
  onOpenChange,
  folders,
  allTags,
  defaultKind = "Alat_Kerja",
  defaultFolderId = null,
  editing = null,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folders: Resource[];
  allTags: string[];
  defaultKind?: ResourceKind;
  defaultFolderId?: string | null;
  editing?: Resource | null;
}) {
  const queryClient = useQueryClient();
  const { data: divisions = [] } = useDivisions();

  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<ResourceKind>(defaultKind);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [category, setCategory] = useState<AssetCategory>("Lainnya");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [folderId, setFolderId] = useState<string>(defaultFolderId ?? NONE);
  const [scope, setScope] = useState<ResourceScope>("Semua_Organisasi");
  const [targetDivision, setTargetDivision] = useState<string>("");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [pinned, setPinned] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(editing ? 2 : 1);
    setKind(editing?.kind ?? defaultKind);
    setTitle(editing?.title ?? "");
    setUrl(editing?.url ?? "");
    setDescription(editing?.description ?? "");
    setIconUrl(editing?.icon_url ?? "");
    setCategory((editing?.asset_category as AssetCategory) ?? "Lainnya");
    setTags(editing?.tags ?? []);
    setTagInput("");
    setFolderId(editing?.folder_id ?? defaultFolderId ?? NONE);
    setScope(editing?.scope ?? "Semua_Organisasi");
    setTargetDivision(editing?.target_division ?? "");
    setTargetRoles(editing?.target_roles ?? []);
    setPinned(editing?.is_pinned ?? false);
  }, [open, editing, defaultKind, defaultFolderId]);

  const folderOptions = useMemo(
    () => folders.filter((f) => f.kind === kind),
    [folders, kind],
  );

  const tagSuggestions = useMemo(
    () =>
      allTags
        .filter((t) => !tags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase()))
        .slice(0, 6),
    [allTags, tags, tagInput],
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["resources"] });

  const createFolder = useMutation({
    mutationFn: () =>
      createResource({
        kind,
        title: newFolderName.trim(),
        description: newFolderDesc.trim() || null,
        url: "",
        is_folder: true,
        scope: "Semua_Organisasi",
        sort_order: 999,
      }),
    onSuccess: (folder) => {
      invalidate();
      setFolderId(folder.id);
      setNewFolderOpen(false);
      setNewFolderName("");
      setNewFolderDesc("");
      toast.success("Folder baru dibuat.");
    },
    onError: (e: Error) => toast.error("Gagal membuat folder: " + e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: Partial<Resource> = {
        kind,
        title: title.trim(),
        url: url.trim(),
        description: description.trim() || null,
        icon_url: iconUrl.trim() || null,
        asset_category: kind === "Aset" ? category : null,
        tags: kind === "Aset" ? tags : null,
        folder_id: folderId === NONE ? null : folderId,
        scope,
        target_division: scope === "Divisi" ? targetDivision || null : null,
        target_roles: scope === "Peran" ? targetRoles : null,
        is_pinned: pinned,
        is_folder: false,
      };
      if (editing) return updateResource(editing.id, payload);
      await createResource(payload);
    },
    onSuccess: () => {
      invalidate();
      toast.success(editing ? "Perubahan disimpan." : "Berhasil ditambahkan.");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Gagal menyimpan: " + e.message),
  });

  function addTag(value: string) {
    const t = value.trim().replace(/^#/, "");
    if (!t || tags.includes(t)) return;
    setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  const canSubmit =
    title.trim().length > 0 &&
    url.trim().length > 0 &&
    (kind === "Alat_Kerja" || !!category) &&
    (scope !== "Divisi" || !!targetDivision) &&
    (scope !== "Peran" || targetRoles.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Ubah Resource" : "Tambah Alat / Aset"}</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <Label>Jenis</Label>
            <RadioGroup value={kind} onValueChange={(v) => setKind(v as ResourceKind)}>
              <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
                <RadioGroupItem value="Alat_Kerja" className="mt-0.5" />
                <span>
                  <b>Alat Kerja</b>
                  <span className="block text-xs text-muted-foreground">
                    Link ke tool yang dipakai tim (Canva, Figma, Drive, dll).
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
                <RadioGroupItem value="Aset" className="mt-0.5" />
                <span>
                  <b>Aset</b>
                  <span className="block text-xs text-muted-foreground">
                    File atau link aset milik organisasi (logo, template, foto).
                  </span>
                </span>
              </label>
            </RadioGroup>
            <DialogFooter>
              <Button onClick={() => setStep(2)}>Lanjut</Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nama *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>URL *</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Deskripsi</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {kind === "Aset" && (
              <>
                <div className="space-y-1.5">
                  <Label>Kategori *</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as AssetCategory)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ASSET_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{rLabel(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tag</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[11px]"
                      >
                        {t}
                        <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}>
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag(tagInput);
                      }
                    }}
                    placeholder="Ketik tag lalu Enter"
                  />
                  {tagSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tagSuggestions.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => addTag(t)}
                          className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
                        >
                          + {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {kind === "Alat_Kerja" && (
              <div className="space-y-1.5">
                <Label>Ikon (opsional)</Label>
                <Input
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  placeholder="Kosongkan untuk pakai favicon otomatis"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Folder</Label>
              <Select
                value={folderId}
                onValueChange={(v) => {
                  if (v === NEW_FOLDER) setNewFolderOpen(true);
                  else setFolderId(v);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Tanpa folder</SelectItem>
                  {folderOptions.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                  ))}
                  <SelectItem value={NEW_FOLDER}>+ Buat folder baru</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              {!editing && (
                <Button variant="ghost" onClick={() => setStep(1)}>Kembali</Button>
              )}
              <Button onClick={() => setStep(3)} disabled={!title.trim() || !url.trim()}>
                Lanjut: Akses
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label>Siapa yang bisa melihat?</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as ResourceScope)}>
              {RESOURCE_SCOPES.map((s) => (
                <label key={s} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                  <RadioGroupItem value={s} />
                  {s === "Semua_Organisasi"
                    ? "Semua Organisasi"
                    : s === "Divisi"
                      ? "Divisi tertentu"
                      : "Peran tertentu"}
                </label>
              ))}
            </RadioGroup>

            {scope === "Divisi" && (
              <Select value={targetDivision} onValueChange={setTargetDivision}>
                <SelectTrigger><SelectValue placeholder="Pilih divisi" /></SelectTrigger>
                <SelectContent>
                  {divisions.map((d) => (
                    <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {scope === "Peran" && (
              <div className="grid grid-cols-2 gap-2">
                {USER_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={targetRoles.includes(r)}
                      onCheckedChange={(c) =>
                        setTargetRoles((prev) =>
                          c ? [...prev, r] : prev.filter((x) => x !== r),
                        )
                      }
                    />
                    {r}
                  </label>
                ))}
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={pinned} onCheckedChange={(c) => setPinned(!!c)} />
              Pin ke atas
            </label>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(2)}>Kembali</Button>
              <Button onClick={() => save.mutate()} disabled={!canSubmit || save.isPending}>
                {save.isPending ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Buat Folder Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nama folder *</Label>
              <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Deskripsi</Label>
              <Textarea
                value={newFolderDesc}
                onChange={(e) => setNewFolderDesc(e.target.value)}
                rows={2}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Jenis folder mengikuti pilihan: {kind === "Aset" ? "Aset" : "Alat Kerja"}.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createFolder.mutate()}
              disabled={!newFolderName.trim() || createFolder.isPending}
            >
              Buat Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
