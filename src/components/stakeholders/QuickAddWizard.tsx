import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, ContactRound, Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase-external";
import { useDivisions, useMyProfile, useProfiles } from "@/hooks/useProfile";
import { fetchCompanies } from "@/lib/companies";
import {
  CATEGORY_META,
  INDIVIDUAL_ROLES,
  ROLE_META,
  STAKEHOLDER_CATEGORIES,
  addAffiliation,
  createIndividual,
  createStakeholderCompany,
  findSimilarIndividuals,
  uploadBusinessCard,
  type IndividualRole,
  type SimilarIndividual,
  type StakeholderCategory,
} from "@/lib/stakeholders";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type WizardProps = { open: boolean; onOpenChange: (v: boolean) => void };

type AffiliationDraft = { company_id: string; company_name: string; role_at_company: string };

const EMPTY = {
  full_name: "",
  nickname: "",
  title: "",
  primary_role: "" as IndividualRole | "",
  email: "",
  phone: "",
  whatsapp: "",
  linkedin: "",
  instagram: "",
  first_met_date: new Date().toISOString().slice(0, 10),
  first_met_context: "",
  introduced_by: "",
  expertise: [] as string[],
  strategic_notes: "",
  tags: [] as string[],
  owner_division: "",
  owner_person_id: "",
};

export function QuickAddWizard({ open, onOpenChange }: WizardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useMyProfile();
  const { data: profiles = [] } = useProfiles();
  const { data: divisions = [] } = useDivisions();

  // step: 0 jenis | company: "company" | individual: 1..7
  const [step, setStep] = useState<number | "company">(0);
  const [saving, setSaving] = useState(false);

  // company quick form
  const [companyName, setCompanyName] = useState("");
  const [companyCategory, setCompanyCategory] = useState<StakeholderCategory | "">("");
  const [companyCity, setCompanyCity] = useState("");

  // individual state
  const [form, setForm] = useState({ ...EMPTY });
  const [hasCard, setHasCard] = useState<"" | "yes" | "no">("");
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [cardPreview, setCardPreview] = useState<string | null>(null);
  const [affiliations, setAffiliations] = useState<AffiliationDraft[]>([]);
  const [hasAffiliation, setHasAffiliation] = useState<"" | "yes" | "no">("");

  // duplikat
  const [similar, setSimilar] = useState<SimilarIndividual[]>([]);
  const [checkingSimilar, setCheckingSimilar] = useState(false);
  const [similarDismissed, setSimilarDismissed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // company picker untuk afiliasi
  const [companyOptions, setCompanyOptions] = useState<{ id: string; name: string }[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyCategory, setNewCompanyCategory] = useState<StakeholderCategory | "">("");
  const [showNewCompany, setShowNewCompany] = useState(false);

  // chip inputs
  const [expertiseInput, setExpertiseInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  function reset() {
    setStep(0);
    setSaving(false);
    setCompanyName("");
    setCompanyCategory("");
    setCompanyCity("");
    setForm({ ...EMPTY });
    setHasCard("");
    setCardFile(null);
    setCardPreview(null);
    setAffiliations([]);
    setHasAffiliation("");
    setSimilar([]);
    setSimilarDismissed(false);
    setCompanySearch("");
    setNewCompanyName("");
    setNewCompanyCategory("");
    setShowNewCompany(false);
    setExpertiseInput("");
    setTagInput("");
  }

  useEffect(() => {
    if (open) {
      reset();
      setForm((f) => ({
        ...f,
        owner_division: profile?.division ?? "",
        owner_person_id: profile?.id ?? "",
      }));
      fetchCompanies()
        .then((cs) => setCompanyOptions(cs.map((c) => ({ id: c.id, name: c.name }))))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounce cari duplikat saat nama diketik
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const name = form.full_name.trim();
    if (step !== 2 || name.length <= 3 || similarDismissed) {
      if (similarDismissed) return;
      setSimilar([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setCheckingSimilar(true);
      try {
        const results = await findSimilarIndividuals(name, form.email || null, form.phone || null);
        setSimilar(results.filter((r) => r.similarity_score >= 40));
      } catch {
        setSimilar([]);
      } finally {
        setCheckingSimilar(false);
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.full_name, form.email, form.phone, step, similarDismissed]);

  const filteredCompanyOptions = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    return companyOptions
      .filter((c) => !affiliations.some((a) => a.company_id === c.id))
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [companyOptions, companySearch, affiliations]);

  function set<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addChip(key: "expertise" | "tags", raw: string) {
    const v = raw.trim().replace(/,$/, "");
    if (!v) return;
    if (!form[key].includes(v)) set(key, [...form[key], v]);
  }

  function removeChip(key: "expertise" | "tags", v: string) {
    set(key, form[key].filter((x) => x !== v));
  }

  function onCardSelected(file: File | null) {
    setCardFile(file);
    if (cardPreview) URL.revokeObjectURL(cardPreview);
    setCardPreview(file ? URL.createObjectURL(file) : null);
  }

  async function saveCompany() {
    if (!companyName.trim() || !companyCategory) {
      toast.error("Nama dan kategori wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const { id } = await createStakeholderCompany({
        name: companyName.trim(),
        stakeholder_category: companyCategory,
        city: companyCity.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
      toast.success("Perusahaan/institusi berhasil dibuat.");
      onOpenChange(false);
      navigate({ to: "/companies/$id", params: { id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function saveIndividual() {
    if (!form.full_name.trim() || !form.primary_role) {
      toast.error("Nama lengkap dan peran utama wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      let business_card_url: string | null = null;
      if (cardFile) business_card_url = await uploadBusinessCard(cardFile);
      const { id } = await createIndividual({
        full_name: form.full_name.trim(),
        nickname: form.nickname.trim() || null,
        title: form.title.trim() || null,
        primary_role: form.primary_role,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp_number: form.whatsapp.trim() || null,
        linkedin_url: form.linkedin.trim() || null,
        instagram_handle: form.instagram.trim() || null,
        business_card_url,
        first_met_date: form.first_met_date || null,
        first_met_context: form.first_met_context.trim() || null,
        introduced_by: form.introduced_by || null,
        strategic_notes: form.strategic_notes.trim() || null,
        areas_of_expertise: form.expertise.join(", ") || null,
        tags: form.tags.length ? form.tags : null,
        owner_division: form.owner_division || null,
        owner_person_id: form.owner_person_id || null,
      });
      for (let i = 0; i < affiliations.length; i++) {
        const a = affiliations[i]!;
        await addAffiliation({
          individual_id: id,
          company_id: a.company_id,
          role_at_company: a.role_at_company.trim() || null,
          is_primary: i === 0,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["individuals"] });
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
      toast.success("Individual berhasil ditambahkan.");
      onOpenChange(false);
      navigate({ to: "/stakeholders/individuals/$id", params: { id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function createInlineCompany() {
    if (!newCompanyName.trim() || !newCompanyCategory) {
      toast.error("Isi nama dan kategori perusahaan baru.");
      return;
    }
    try {
      const { id } = await createStakeholderCompany({
        name: newCompanyName.trim(),
        stakeholder_category: newCompanyCategory,
      });
      setCompanyOptions((prev) => [...prev, { id, name: newCompanyName.trim() }]);
      setAffiliations((prev) => [
        ...prev,
        { company_id: id, company_name: newCompanyName.trim(), role_at_company: "" },
      ]);
      setShowNewCompany(false);
      setNewCompanyName("");
      setNewCompanyCategory("");
      toast.success("Perusahaan dibuat dan dipilih.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat perusahaan.");
    }
  }

  const canSaveIndividual = form.full_name.trim() && form.primary_role;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 0 && "Tambah Cepat"}
            {step === "company" && "Perusahaan / Institusi Baru"}
            {typeof step === "number" && step >= 1 && "Individual Baru"}
          </DialogTitle>
        </DialogHeader>

        {step === 0 && (
          <RadioGroup
            className="grid gap-3 sm:grid-cols-2"
            value=""
            onValueChange={(v) => setStep(v === "company" ? "company" : 1)}
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-5 transition-colors hover:border-primary has-checked:border-primary has-checked:bg-primary/5">
              <RadioGroupItem value="company" className="mt-1" />
              <span>
                <Building2 className="mb-2 size-6 text-primary" />
                <span className="block font-semibold">Perusahaan / Institusi</span>
                <span className="block text-xs text-muted-foreground">
                  Sponsor, kampus, media, vendor, dan lainnya.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-5 transition-colors hover:border-primary has-checked:border-primary has-checked:bg-primary/5">
              <RadioGroupItem value="individual" className="mt-1" />
              <span>
                <ContactRound className="mb-2 size-6 text-primary" />
                <span className="block font-semibold">Individual (Orang)</span>
                <span className="block text-xs text-muted-foreground">
                  Dosen, alumni, praktisi, mentor, dan tokoh lainnya.
                </span>
              </span>
            </label>
          </RadioGroup>
        )}

        {step === "company" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama (wajib)</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Contoh: Universitas Indonesia"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori (wajib)</Label>
              <Select
                value={companyCategory}
                onValueChange={(v) => setCompanyCategory(v as StakeholderCategory)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {STAKEHOLDER_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_META[c]?.label ?? c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kota (opsional)</Label>
              <Input
                value={companyCity}
                onChange={(e) => setCompanyCity(e.target.value)}
                placeholder="Contoh: Jakarta"
              />
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(0)}>
                Kembali
              </Button>
              <Button onClick={saveCompany} disabled={saving || !companyName.trim() || !companyCategory}>
                {saving && <Loader2 className="size-4 animate-spin" />} Buat
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Punya kartu namanya?</p>
            <RadioGroup
              className="grid gap-3 sm:grid-cols-2"
              value={hasCard}
              onValueChange={(v) => setHasCard(v as "yes" | "no")}
            >
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 hover:border-primary has-checked:border-primary has-checked:bg-primary/5">
                <RadioGroupItem value="yes" />
                <span className="text-sm font-medium">Ya, gue punya kartu namanya</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 hover:border-primary has-checked:border-primary has-checked:bg-primary/5">
                <RadioGroupItem value="no" />
                <span className="text-sm font-medium">Nggak, tulis dari ingatan</span>
              </label>
            </RadioGroup>
            {hasCard === "yes" && (
              <div className="space-y-2">
                <Label htmlFor="wizard-card" className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
                  <Upload className="size-4" />
                  {cardFile ? cardFile.name : "Pilih foto kartu nama…"}
                </Label>
                <input
                  id="wizard-card"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onCardSelected(e.target.files?.[0] ?? null)}
                />
                {cardPreview && (
                  <img
                    src={cardPreview}
                    alt="Foto kartu nama"
                    className="max-h-48 rounded-xl border object-contain"
                  />
                )}
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(0)}>
                Kembali
              </Button>
              <Button onClick={() => setStep(2)} disabled={!hasCard || (hasCard === "yes" && !cardFile)}>
                Lanjut
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={cardPreview ? "grid gap-5 sm:grid-cols-[200px_1fr]" : "space-y-4"}>
            {cardPreview && (
              <img
                src={cardPreview}
                alt="Referensi kartu nama"
                className="w-full rounded-xl border object-contain"
              />
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Lengkap (wajib)</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => {
                    setSimilarDismissed(false);
                    set("full_name", e.target.value);
                  }}
                  placeholder="Contoh: Budi Santoso"
                  autoFocus
                />
                {checkingSimilar && (
                  <p className="text-xs text-muted-foreground">Memeriksa kemungkinan duplikat…</p>
                )}
                {similar.length > 0 && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
                    <p className="text-xs font-semibold">Mungkin kamu maksud orang ini?</p>
                    <div className="mt-2 space-y-2">
                      {similar.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2 text-xs">
                          <div>
                            <p className="font-semibold">{s.full_name}</p>
                            <p className="text-muted-foreground">
                              {ROLE_META[s.primary_role ?? ""]?.label ?? s.primary_role ?? "—"}
                              {s.email ? ` · ${s.email}` : ""}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onOpenChange(false);
                              navigate({ to: "/stakeholders/individuals/$id", params: { id: s.id } });
                            }}
                          >
                            Ini orang yang sama
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" variant="ghost" onClick={() => { setSimilar([]); setSimilarDismissed(true); }}>
                        Bukan, lanjut buat baru
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nickname</Label>
                  <Input value={form.nickname} onChange={(e) => set("nickname", e.target.value)} placeholder="Contoh: Pak Budi" />
                </div>
                <div className="space-y-2">
                  <Label>Primary Role (wajib)</Label>
                  <Select value={form.primary_role} onValueChange={(v) => set("primary_role", v as IndividualRole)}>
                    <SelectTrigger><SelectValue placeholder="Pilih peran" /></SelectTrigger>
                    <SelectContent>
                      {INDIVIDUAL_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_META[r]?.label ?? r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Title / Peran</Label>
                <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Contoh: Dosen Manajemen FEB UI" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Telepon</Label>
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="08xx" />
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn URL</Label>
                  <Input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Instagram</Label>
                  <Input value={form.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@username" />
                </div>
              </div>
              <WizardNav
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
                onSkip={() => setStep(7)}
                nextDisabled={!form.full_name.trim() || !form.primary_role}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tanggal Ketemu</Label>
              <Input type="date" value={form.first_met_date} onChange={(e) => set("first_met_date", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Konteks (di mana ketemu? dalam rangka apa?)</Label>
              <Textarea
                value={form.first_met_context}
                onChange={(e) => set("first_met_context", e.target.value)}
                placeholder="Contoh: ketemu di seminar HRD 2026 sebagai pembicara"
              />
            </div>
            <div className="space-y-2">
              <Label>Diperkenalkan oleh (opsional)</Label>
              <Select value={form.introduced_by} onValueChange={(v) => set("introduced_by", v)}>
                <SelectTrigger><SelectValue placeholder="Ada anggota kita yang memperkenalkan?" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <WizardNav onBack={() => setStep(2)} onNext={() => setStep(4)} onSkip={() => setStep(7)} />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <ChipInput
              label="Bidang Keahlian"
              hint="Contoh: Marketing digital, Personal branding, Copywriting — tekan Enter untuk menambah."
              values={form.expertise}
              input={expertiseInput}
              setInput={setExpertiseInput}
              onAdd={(v) => addChip("expertise", v)}
              onRemove={(v) => removeChip("expertise", v)}
            />
            <div className="space-y-2">
              <Label>Kenapa penting buat organisasi?</Label>
              <Textarea
                value={form.strategic_notes}
                onChange={(e) => set("strategic_notes", e.target.value)}
                placeholder="Contoh: bisa jadi pembicara masa depan untuk seminar career development, atau mentor untuk divisi HR."
              />
            </div>
            <ChipInput
              label="Tag"
              values={form.tags}
              input={tagInput}
              setInput={setTagInput}
              onAdd={(v) => addChip("tags", v)}
              onRemove={(v) => removeChip("tags", v)}
            />
            <WizardNav onBack={() => setStep(3)} onNext={() => setStep(5)} onSkip={() => setStep(7)} />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Orang ini berafiliasi dengan perusahaan/institusi tertentu?</p>
            <RadioGroup
              className="grid gap-3 sm:grid-cols-2"
              value={hasAffiliation}
              onValueChange={(v) => setHasAffiliation(v as "yes" | "no")}
            >
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 hover:border-primary has-checked:border-primary has-checked:bg-primary/5">
                <RadioGroupItem value="yes" />
                <span className="text-sm font-medium">Ya, satu atau lebih</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 hover:border-primary has-checked:border-primary has-checked:bg-primary/5">
                <RadioGroupItem value="no" />
                <span className="text-sm font-medium">Tidak</span>
              </label>
            </RadioGroup>

            {hasAffiliation === "yes" && (
              <div className="space-y-3">
                {affiliations.map((a, i) => (
                  <div key={a.company_id} className="flex items-center gap-2 rounded-xl border p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {a.company_name}
                        {i === 0 && (
                          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Primer
                          </span>
                        )}
                      </p>
                    </div>
                    <Input
                      value={a.role_at_company}
                      onChange={(e) =>
                        setAffiliations((prev) =>
                          prev.map((x, xi) => (xi === i ? { ...x, role_at_company: e.target.value } : x)),
                        )
                      }
                      placeholder="Peran di sana"
                      className="w-40"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setAffiliations((prev) => prev.filter((_, xi) => xi !== i))}
                      aria-label="Hapus afiliasi"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <div className="space-y-2 rounded-xl border border-dashed p-3">
                  <Input
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    placeholder="Cari perusahaan…"
                  />
                  {filteredCompanyOptions.length > 0 && (
                    <div className="max-h-40 space-y-1 overflow-y-auto">
                      {filteredCompanyOptions.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            setAffiliations((prev) => [
                              ...prev,
                              { company_id: c.id, company_name: c.name, role_at_company: "" },
                            ]);
                            setCompanySearch("");
                          }}
                        >
                          <Plus className="size-3.5" /> {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {!showNewCompany ? (
                    <Button variant="ghost" size="sm" onClick={() => setShowNewCompany(true)}>
                      Perusahaan belum ada? Buat baru
                    </Button>
                  ) : (
                    <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                      <Input
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        placeholder="Nama perusahaan baru"
                      />
                      <Select
                        value={newCompanyCategory}
                        onValueChange={(v) => setNewCompanyCategory(v as StakeholderCategory)}
                      >
                        <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
                        <SelectContent>
                          {STAKEHOLDER_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>{CATEGORY_META[c]?.label ?? c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={createInlineCompany}>Buat & pilih</Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowNewCompany(false)}>Batal</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <WizardNav
              onBack={() => setStep(4)}
              onNext={() => setStep(6)}
              onSkip={() => setStep(7)}
              nextDisabled={hasAffiliation === ""}
            />
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
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
              <Label>PIC (anggota penanggung jawab)</Label>
              <Select value={form.owner_person_id} onValueChange={(v) => set("owner_person_id", v)}>
                <SelectTrigger><SelectValue placeholder="Pilih anggota" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <WizardNav onBack={() => setStep(5)} onNext={() => setStep(7)} onSkip={() => setStep(7)} hideSkip />
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4">
            <div className="rounded-2xl border p-4">
              <div className="flex gap-4">
                {cardPreview && (
                  <img src={cardPreview} alt="Kartu nama" className="h-24 w-36 rounded-lg border object-cover" />
                )}
                <div className="text-sm">
                  <p className="text-base font-bold">
                    {form.full_name || "—"}
                    {form.nickname && <span className="ml-1 text-sm font-normal text-muted-foreground">({form.nickname})</span>}
                  </p>
                  <p className="text-muted-foreground">{form.title || ROLE_META[form.primary_role]?.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ROLE_META[form.primary_role]?.label ?? "—"}
                    {form.first_met_date ? ` · Kenal ${form.first_met_date}` : ""}
                  </p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {form.email && <><dt className="text-muted-foreground">Email</dt><dd>{form.email}</dd></>}
                {form.phone && <><dt className="text-muted-foreground">Telepon</dt><dd>{form.phone}</dd></>}
                {form.whatsapp && <><dt className="text-muted-foreground">WhatsApp</dt><dd>{form.whatsapp}</dd></>}
                {form.first_met_context && <><dt className="text-muted-foreground">Konteks</dt><dd>{form.first_met_context}</dd></>}
                {form.expertise.length > 0 && <><dt className="text-muted-foreground">Keahlian</dt><dd>{form.expertise.join(", ")}</dd></>}
                {affiliations.length > 0 && (
                  <><dt className="text-muted-foreground">Afiliasi</dt><dd>{affiliations.map((a) => a.company_name).join(", ")}</dd></>
                )}
              </dl>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(6)}>Kembali</Button>
              <Button onClick={saveIndividual} disabled={saving || !canSaveIndividual}>
                {saving && <Loader2 className="size-4 animate-spin" />} Simpan
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WizardNav({
  onBack,
  onNext,
  onSkip,
  nextDisabled,
  hideSkip,
}: {
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
  nextDisabled?: boolean;
  hideSkip?: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <Button variant="ghost" onClick={onBack}>Kembali</Button>
      <div className="flex gap-2">
        {!hideSkip && onSkip && (
          <Button variant="outline" onClick={onSkip}>Lewati</Button>
        )}
        <Button onClick={onNext} disabled={nextDisabled}>Lanjut</Button>
      </div>
    </div>
  );
}

function ChipInput({
  label,
  hint,
  values,
  input,
  setInput,
  onAdd,
  onRemove,
}: {
  label: string;
  hint?: string;
  values: string[];
  input: string;
  setInput: (v: string) => void;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2">
        {values.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
            {v}
            <button type="button" onClick={() => onRemove(v)} aria-label={`Hapus ${v}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              onAdd(input);
              setInput("");
            }
          }}
          onBlur={() => {
            if (input.trim()) {
              onAdd(input);
              setInput("");
            }
          }}
          placeholder={values.length === 0 ? "Ketik lalu Enter…" : ""}
          className="min-w-28 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

