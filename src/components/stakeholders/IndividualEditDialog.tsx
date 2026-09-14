import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDivisions, useProfiles } from "@/hooks/useProfile";
import {
  INDIVIDUAL_ROLES,
  ROLE_META,
  updateIndividual,
  type Individual,
  type IndividualRole,
} from "@/lib/stakeholders";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  individual: Individual;
};

export function IndividualEditDialog({ open, onOpenChange, individual }: Props) {
  const queryClient = useQueryClient();
  const { data: profiles = [] } = useProfiles();
  const { data: divisions = [] } = useDivisions();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    nickname: "",
    title: "",
    primary_role: "Lainnya" as IndividualRole,
    email: "",
    phone: "",
    whatsapp_number: "",
    linkedin_url: "",
    instagram_handle: "",
    first_met_date: "",
    first_met_context: "",
    introduced_by: "",
    strategic_notes: "",
    areas_of_expertise: "",
    tags: "",
    owner_division: "",
    owner_person_id: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        full_name: individual.full_name ?? "",
        nickname: individual.nickname ?? "",
        title: individual.title ?? "",
        primary_role: individual.primary_role ?? "Lainnya",
        email: individual.email ?? "",
        phone: individual.phone ?? "",
        whatsapp_number: individual.whatsapp_number ?? "",
        linkedin_url: individual.linkedin_url ?? "",
        instagram_handle: individual.instagram_handle ?? "",
        first_met_date: individual.first_met_date ?? "",
        first_met_context: individual.first_met_context ?? "",
        introduced_by: individual.introduced_by ?? "",
        strategic_notes: individual.strategic_notes ?? "",
        areas_of_expertise: individual.areas_of_expertise ?? "",
        tags: (individual.tags ?? []).join(", "),
        owner_division: individual.owner_division ?? "",
        owner_person_id: individual.owner_person_id ?? "",
      });
    }
  }, [open, individual]);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!form.full_name.trim()) {
      toast.error("Nama wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      await updateIndividual(individual.id, {
        full_name: form.full_name.trim(),
        nickname: form.nickname.trim() || null,
        title: form.title.trim() || null,
        primary_role: form.primary_role,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp_number: form.whatsapp_number.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        instagram_handle: form.instagram_handle.trim() || null,
        first_met_date: form.first_met_date || null,
        first_met_context: form.first_met_context.trim() || null,
        introduced_by: form.introduced_by || null,
        strategic_notes: form.strategic_notes.trim() || null,
        areas_of_expertise: form.areas_of_expertise.trim() || null,
        tags: form.tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        owner_division: form.owner_division || null,
        owner_person_id: form.owner_person_id || null,
      });
      queryClient.invalidateQueries({ queryKey: ["individuals"] });
      queryClient.invalidateQueries({ queryKey: ["individual", individual.id] });
      toast.success("Data individual diperbarui.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Individual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nama Lengkap (wajib)</Label>
              <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nickname</Label>
              <Input value={form.nickname} onChange={(e) => set("nickname", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Title / Peran</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Primary Role</Label>
              <Select value={form.primary_role} onValueChange={(v) => set("primary_role", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INDIVIDUAL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_META[r]?.label ?? r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tanggal Kenal</Label>
              <Input type="date" value={form.first_met_date} onChange={(e) => set("first_met_date", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Telepon</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>LinkedIn URL</Label>
              <Input value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Instagram</Label>
              <Input value={form.instagram_handle} onChange={(e) => set("instagram_handle", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Konteks Pengenalan</Label>
              <Textarea value={form.first_met_context} onChange={(e) => set("first_met_context", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Diperkenalkan oleh</Label>
              <Select value={form.introduced_by} onValueChange={(v) => set("introduced_by", v)}>
                <SelectTrigger><SelectValue placeholder="Pilih anggota" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bidang Keahlian (pisah koma)</Label>
              <Input value={form.areas_of_expertise} onChange={(e) => set("areas_of_expertise", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Catatan Strategis</Label>
              <Textarea value={form.strategic_notes} onChange={(e) => set("strategic_notes", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tag (pisah koma)</Label>
              <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Owner Divisi</Label>
              <Select value={form.owner_division} onValueChange={(v) => set("owner_division", v)}>
                <SelectTrigger><SelectValue placeholder="Pilih divisi" /></SelectTrigger>
                <SelectContent>
                  {divisions.map((d) => (
                    <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>PIC</Label>
              <Select value={form.owner_person_id} onValueChange={(v) => set("owner_person_id", v)}>
                <SelectTrigger><SelectValue placeholder="Pilih anggota" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Simpan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
