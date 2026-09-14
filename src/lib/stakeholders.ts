import { supabase } from "@/lib/supabase-external";

export type StakeholderCategory =
  | "Kampus"
  | "Sponsor"
  | "Alumni_Institusi"
  | "Media"
  | "Komunitas"
  | "Pemerintah"
  | "Vendor"
  | "Organisasi_Sejenis"
  | "Lainnya";

export type IndividualRole =
  | "Dosen"
  | "Staf_Kampus"
  | "Alumni"
  | "Praktisi"
  | "Tokoh_Publik"
  | "Mentor"
  | "Pemerintah"
  | "Kolega_Organisasi"
  | "Korporat"
  | "Lainnya";

export const STAKEHOLDER_CATEGORIES: StakeholderCategory[] = [
  "Kampus",
  "Sponsor",
  "Alumni_Institusi",
  "Media",
  "Komunitas",
  "Pemerintah",
  "Vendor",
  "Organisasi_Sejenis",
  "Lainnya",
];

export const INDIVIDUAL_ROLES: IndividualRole[] = [
  "Dosen",
  "Staf_Kampus",
  "Alumni",
  "Praktisi",
  "Tokoh_Publik",
  "Mentor",
  "Pemerintah",
  "Kolega_Organisasi",
  "Korporat",
  "Lainnya",
];

export const CATEGORY_META: Record<
  string,
  { label: string; badge: string; accent: string }
> = {
  Kampus: {
    label: "Kampus",
    badge: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    accent: "border-l-blue-500",
  },
  Sponsor: {
    label: "Sponsor",
    badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    accent: "border-l-emerald-500",
  },
  Alumni_Institusi: {
    label: "Alumni Institusi",
    badge: "bg-violet-500/10 text-violet-600 border-violet-500/30",
    accent: "border-l-violet-500",
  },
  Media: {
    label: "Media",
    badge: "bg-pink-500/10 text-pink-600 border-pink-500/30",
    accent: "border-l-pink-500",
  },
  Komunitas: {
    label: "Komunitas",
    badge: "bg-orange-500/10 text-orange-600 border-orange-500/30",
    accent: "border-l-orange-500",
  },
  Pemerintah: {
    label: "Pemerintah",
    badge: "bg-slate-500/10 text-slate-500 border-slate-500/30",
    accent: "border-l-slate-600",
  },
  Vendor: {
    label: "Vendor",
    badge: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
    accent: "border-l-yellow-500",
  },
  Organisasi_Sejenis: {
    label: "Organisasi Sejenis",
    badge: "bg-teal-500/10 text-teal-600 border-teal-500/30",
    accent: "border-l-teal-500",
  },
  Lainnya: {
    label: "Lainnya",
    badge: "bg-muted text-muted-foreground border-border",
    accent: "border-l-muted-foreground/40",
  },
};

export const ROLE_META: Record<string, { label: string; badge: string; accent: string }> = {
  Dosen: {
    label: "Dosen",
    badge: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    accent: "border-l-blue-500",
  },
  Staf_Kampus: {
    label: "Staf Kampus",
    badge: "bg-sky-500/10 text-sky-600 border-sky-500/30",
    accent: "border-l-sky-500",
  },
  Alumni: {
    label: "Alumni",
    badge: "bg-violet-500/10 text-violet-600 border-violet-500/30",
    accent: "border-l-violet-500",
  },
  Praktisi: {
    label: "Praktisi",
    badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    accent: "border-l-emerald-500",
  },
  Tokoh_Publik: {
    label: "Tokoh Publik",
    badge: "bg-pink-500/10 text-pink-600 border-pink-500/30",
    accent: "border-l-pink-500",
  },
  Mentor: {
    label: "Mentor",
    badge: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    accent: "border-l-amber-500",
  },
  Pemerintah: {
    label: "Pemerintah",
    badge: "bg-slate-500/10 text-slate-500 border-slate-500/30",
    accent: "border-l-slate-600",
  },
  Kolega_Organisasi: {
    label: "Kolega Organisasi",
    badge: "bg-teal-500/10 text-teal-600 border-teal-500/30",
    accent: "border-l-teal-500",
  },
  Korporat: {
    label: "Korporat",
    badge: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
    accent: "border-l-indigo-500",
  },
  Lainnya: {
    label: "Lainnya",
    badge: "bg-muted text-muted-foreground border-border",
    accent: "border-l-muted-foreground/40",
  },
};

export type Individual = {
  id: string;
  full_name: string;
  nickname: string | null;
  title: string | null;
  primary_role: IndividualRole;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  instagram_handle: string | null;
  whatsapp_number: string | null;
  photo_url: string | null;
  business_card_url: string | null;
  first_met_date: string | null;
  first_met_context: string | null;
  introduced_by: string | null;
  strategic_notes: string | null;
  areas_of_expertise: string | null;
  tags: string[] | null;
  owner_division: string | null;
  owner_person_id: string | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
};

export type Affiliation = {
  id: string;
  individual_id: string;
  company_id: string;
  role_at_company: string | null;
  is_primary: boolean;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  company?: { id: string; name: string } | null;
};

export type SimilarIndividual = {
  id: string;
  full_name: string;
  primary_role: IndividualRole | null;
  email: string | null;
  phone: string | null;
  similarity_score: number;
};

export async function fetchIndividuals(includeArchived = false): Promise<Individual[]> {
  let q = supabase.from("individuals").select("*");
  if (!includeArchived) q = q.eq("is_archived", false);
  const { data, error } = await q.order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Individual[];
}

export async function fetchIndividual(id: string): Promise<Individual | null> {
  const { data, error } = await supabase
    .from("individuals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Individual | null;
}

export async function fetchAffiliations(individualId: string): Promise<Affiliation[]> {
  const { data, error } = await supabase
    .from("individual_affiliations")
    .select("*, company:companies(id,name)")
    .eq("individual_id", individualId)
    .order("is_primary", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Affiliation[];
}

/** Afiliasi primer untuk banyak individual sekaligus (dipakai di grid & tabel). */
export async function fetchPrimaryAffiliations(): Promise<Affiliation[]> {
  const { data, error } = await supabase
    .from("individual_affiliations")
    .select("*, company:companies(id,name)")
    .eq("is_primary", true);
  if (error) throw error;
  return (data ?? []) as Affiliation[];
}

export type IndividualInput = {
  full_name: string;
  nickname: string | null;
  title: string | null;
  primary_role: IndividualRole;
  email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  linkedin_url: string | null;
  instagram_handle: string | null;
  business_card_url?: string | null;
  photo_url?: string | null;
  first_met_date: string | null;
  first_met_context: string | null;
  introduced_by: string | null;
  strategic_notes: string | null;
  areas_of_expertise: string | null;
  tags: string[] | null;
  owner_division: string | null;
  owner_person_id: string | null;
};

export async function createIndividual(input: IndividualInput): Promise<{ id: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("individuals")
    .insert({ ...input, created_by: userData.user?.id ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: string };
}

export async function updateIndividual(id: string, input: Partial<IndividualInput>) {
  const { error } = await supabase
    .from("individuals")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function setIndividualArchived(id: string, archived: boolean) {
  const { error } = await supabase
    .from("individuals")
    .update({ is_archived: archived, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function addAffiliation(input: {
  individual_id: string;
  company_id: string;
  role_at_company: string | null;
  is_primary: boolean;
  start_date?: string | null;
  end_date?: string | null;
}) {
  const { error } = await supabase.from("individual_affiliations").insert(input);
  if (error) throw error;
}

export async function deleteAffiliation(id: string) {
  const { error } = await supabase.from("individual_affiliations").delete().eq("id", id);
  if (error) throw error;
}

export async function findSimilarIndividuals(
  name: string,
  email?: string | null,
  phone?: string | null,
): Promise<SimilarIndividual[]> {
  const { data, error } = await supabase.rpc("find_similar_individuals", {
    p_name: name,
    p_email: email || null,
    p_phone: phone || null,
  });
  if (error) throw error;
  return (data ?? []) as SimilarIndividual[];
}

export async function uploadBusinessCard(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("business-cards").upload(path, file, {
    upsert: false,
    ...(file.type ? { contentType: file.type } : {}),
  });
  if (error) throw error;
  const { data } = supabase.storage.from("business-cards").getPublicUrl(path);
  return data.publicUrl;
}

/** Ubah nomor Indonesia jadi tautan wa.me. */
export function waLink(numberRaw?: string | null): string | null {
  if (!numberRaw) return null;
  const digits = numberRaw.replace(/\D/g, "");
  if (!digits) return null;
  let normalized = digits;
  if (normalized.startsWith("0")) normalized = "62" + normalized.slice(1);
  else if (normalized.startsWith("8")) normalized = "62" + normalized;
  return `https://wa.me/${normalized}`;
}

export function instagramLink(handle?: string | null): string | null {
  if (!handle) return null;
  const clean = handle.trim().replace(/^@/, "");
  if (!clean) return null;
  if (clean.startsWith("http")) return clean;
  return `https://instagram.com/${clean}`;
}

const AVATAR_COLORS = [
  "bg-blue-500/20 text-blue-600",
  "bg-emerald-500/20 text-emerald-600",
  "bg-violet-500/20 text-violet-600",
  "bg-pink-500/20 text-pink-600",
  "bg-amber-500/20 text-amber-600",
  "bg-teal-500/20 text-teal-600",
  "bg-indigo-500/20 text-indigo-600",
];

export function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] as string;
}

export function nameInitials(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function expertiseChips(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Companies sebagai pemangku kepentingan
// ---------------------------------------------------------------------------

export type StakeholderCompany = {
  id: string;
  name: string;
  stakeholder_category: StakeholderCategory | null;
  city: string | null;
  industry: string | null;
  first_met_date: string | null;
  is_archived: boolean;
  created_at: string;
};

/** Companies yang punya stakeholder_category (lapisan strategis di atas CRM). */
export async function fetchStakeholderCompanies(): Promise<StakeholderCompany[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("id,name,stakeholder_category,city,industry,first_met_date,is_archived,created_at")
    .not("stakeholder_category", "is", null)
    .eq("is_archived", false)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as StakeholderCompany[];
}

const CATEGORY_TO_COMPANY_TYPE: Record<StakeholderCategory, string> = {
  Kampus: "Institutional",
  Sponsor: "Sponsor",
  Alumni_Institusi: "Institutional",
  Media: "Media",
  Komunitas: "Institutional",
  Pemerintah: "Institutional",
  Vendor: "Vendor",
  Organisasi_Sejenis: "Institutional",
  Lainnya: "Institutional",
};

/** Tambah cepat perusahaan/institusi dari wizard. */
export async function createStakeholderCompany(input: {
  name: string;
  stakeholder_category: StakeholderCategory;
  city?: string | null;
}): Promise<{ id: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("companies")
    .insert({
      name: input.name,
      stakeholder_category: input.stakeholder_category,
      type: CATEGORY_TO_COMPANY_TYPE[input.stakeholder_category],
      city: input.city ?? null,
      created_by: userData.user?.id ?? null,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return data as unknown as { id: string };
}

// ---------------------------------------------------------------------------
// Statistik dashboard
// ---------------------------------------------------------------------------

export async function countStakeholdersAddedSince(days: number): Promise<number> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const sinceDate = since.slice(0, 10);
  const [ind, comp] = await Promise.all([
    supabase
      .from("individuals")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .not("stakeholder_category", "is", null)
      .gte("first_met_date", sinceDate),
  ]);
  if (ind.error) throw ind.error;
  if (comp.error) throw comp.error;
  return (ind.count ?? 0) + (comp.count ?? 0);
}

export async function countIndividualsWithoutPic(): Promise<number> {
  const { count, error } = await supabase
    .from("individuals")
    .select("id", { count: "exact", head: true })
    .is("owner_person_id", null)
    .eq("is_archived", false);
  if (error) throw error;
  return count ?? 0;
}
