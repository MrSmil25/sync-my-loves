import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { fetchCompanies } from "@/lib/companies";
import {
  CATEGORY_META,
  STAKEHOLDER_CATEGORIES,
  addAffiliation,
  createStakeholderCompany,
  type StakeholderCategory,
} from "@/lib/stakeholders";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  individualId: string;
};

export function AffiliationFormDialog({ open, onOpenChange, individualId }: Props) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleAt, setRoleAt] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<StakeholderCategory | "">("");

  useEffect(() => {
    if (open) {
      setSearch("");
      setCompanyId("");
      setCompanyName("");
      setRoleAt("");
      setStartDate("");
      setEndDate("");
      setIsPrimary(false);
      setShowNew(false);
      setNewName("");
      setNewCategory("");
      fetchCompanies()
        .then((cs) => setCompanies(cs.map((c) => ({ id: c.id, name: c.name }))))
        .catch(() => {});
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => !q || c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [companies, search]);

  async function createNew() {
    if (!newName.trim() || !newCategory) {
      toast.error("Isi nama dan kategori perusahaan baru.");
      return;
    }
    try {
      const { id } = await createStakeholderCompany({
        name: newName.trim(),
        stakeholder_category: newCategory,
      });
      setCompanies((prev) => [...prev, { id, name: newName.trim() }]);
      setCompanyId(id);
      setCompanyName(newName.trim());
      setShowNew(false);
      toast.success("Perusahaan dibuat dan dipilih.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat perusahaan.");
    }
  }

  async function save() {
    if (!companyId) {
      toast.error("Pilih perusahaan dulu.");
      return;
    }
    setSaving(true);
    try {
      await addAffiliation({
        individual_id: individualId,
        company_id: companyId,
        role_at_company: roleAt.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        is_primary: isPrimary,
      });
      queryClient.invalidateQueries({ queryKey: ["affiliations", individualId] });
      queryClient.invalidateQueries({ queryKey: ["individuals"] });
      toast.success("Afiliasi ditambahkan.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan afiliasi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Afiliasi</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Perusahaan / Institusi</Label>
            {companyId ? (
              <div className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <span className="font-medium">{companyName}</span>
                <Button variant="ghost" size="sm" onClick={() => { setCompanyId(""); setCompanyName(""); }}>
                  Ganti
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-dashed p-3">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari perusahaan…" />
                {filtered.length > 0 && (
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {filtered.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => { setCompanyId(c.id); setCompanyName(c.name); }}
                      >
                        <Plus className="size-3.5" /> {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {!showNew ? (
                  <Button variant="ghost" size="sm" onClick={() => setShowNew(true)}>
                    Perusahaan belum ada? Buat baru
                  </Button>
                ) : (
                  <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama perusahaan baru" />
                    <Select value={newCategory} onValueChange={(v) => setNewCategory(v as StakeholderCategory)}>
                      <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
                      <SelectContent>
                        {STAKEHOLDER_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{CATEGORY_META[c]?.label ?? c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={createNew}>Buat & pilih</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Batal</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Peran di perusahaan</Label>
            <Input value={roleAt} onChange={(e) => setRoleAt(e.target.value)} placeholder="Contoh: Dosen, Manajer HR" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Mulai (opsional)</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Selesai (opsional)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isPrimary} onCheckedChange={(v) => setIsPrimary(v === true)} />
            Jadikan afiliasi primer
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button onClick={save} disabled={saving || !companyId}>
              {saving && <Loader2 className="size-4 animate-spin" />} Simpan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
