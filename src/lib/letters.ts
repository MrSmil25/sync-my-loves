import { supabase } from "@/lib/supabase-external";

export type LetterTemplate =
  | "Aktif_Organisasi"
  | "Rekomendasi"
  | "Peminjaman_Tempat"
  | "Undangan_Formal"
  | "Surat_Tugas"
  | "Pengantar"
  | "Kerjasama"
  | "Custom";

export type LetterStatus = "Draft" | "Pending_Review" | "Approved" | "Rejected";

export type Letter = {
  id: string;
  letter_number: string | null;
  template_type: LetterTemplate;
  requester_id: string | null;
  requester_division: string | null;
  purpose: string;
  recipient_name: string | null;
  recipient_organization: string | null;
  output_type: string | null;
  approval_status: LetterStatus;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  requester?: { full_name: string | null; division: string | null } | null;
  approver?: { full_name: string | null } | null;
};

export const LETTER_TEMPLATES: Array<{
  value: LetterTemplate;
  label: string;
  description: string;
  hint?: string;
}> = [
  {
    value: "Aktif_Organisasi",
    label: "Surat Keterangan Aktif Organisasi",
    description: "Untuk beasiswa atau keperluan pribadi anggota.",
    hint: "Template repetitif, langsung disetujui otomatis",
  },
  { value: "Rekomendasi", label: "Surat Rekomendasi", description: "Rekomendasi resmi dari organisasi." },
  { value: "Peminjaman_Tempat", label: "Peminjaman Tempat", description: "Permohonan pemakaian ruang atau tempat." },
  { value: "Undangan_Formal", label: "Undangan Formal", description: "Undangan resmi ke pihak internal atau eksternal." },
  { value: "Surat_Tugas", label: "Surat Tugas", description: "Penugasan anggota untuk kegiatan tertentu." },
  { value: "Pengantar", label: "Surat Pengantar", description: "Pengantar untuk keperluan administratif." },
  { value: "Kerjasama", label: "Kerjasama / MoU", description: "Penawaran atau tindak lanjut kerja sama." },
  {
    value: "Custom",
    label: "Custom",
    description: "Kebutuhan khusus di luar template baku.",
    hint: "Butuh review Sekretaris, estimasi 1-3 hari kerja",
  },
];

export function templateLabel(value: string | null | undefined): string {
  return LETTER_TEMPLATES.find((t) => t.value === value)?.label ?? (value ?? "-").replaceAll("_", " ");
}

export function templateBadgeClass(value: string | null | undefined): string {
  switch (value) {
    case "Aktif_Organisasi":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "Rekomendasi":
      return "bg-violet-100 text-violet-800 border-violet-200";
    case "Peminjaman_Tempat":
      return "bg-teal-100 text-teal-800 border-teal-200";
    case "Undangan_Formal":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "Surat_Tugas":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "Pengantar":
      return "bg-lime-100 text-lime-800 border-lime-200";
    case "Kerjasama":
      return "bg-rose-100 text-rose-800 border-rose-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

export function statusLabel(value: string | null | undefined): string {
  switch (value) {
    case "Pending_Review":
      return "Menunggu Review";
    case "Approved":
      return "Disetujui";
    case "Rejected":
      return "Ditolak";
    default:
      return "Draft";
  }
}

export function statusBadgeClass(value: string | null | undefined): string {
  switch (value) {
    case "Pending_Review":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "Approved":
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    case "Rejected":
      return "bg-red-100 text-red-900 border-red-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

const REVIEWER_ROLES = ["Sekretaris", "Ketua", "Waketu", "Supervisor"];

export function canReviewLetters(role?: string | null) {
  return REVIEWER_ROLES.includes(role ?? "");
}

export function canSeeAllLetters(role?: string | null) {
  return REVIEWER_ROLES.includes(role ?? "");
}

/** Batas permintaan per user per hari, per template. null = tanpa batas. */
export function dailyLimitFor(template: LetterTemplate): number | null {
  if (template === "Aktif_Organisasi") return null;
  if (template === "Custom") return 1;
  return 3;
}

const SELECT =
  "*, requester:profiles!requester_id(full_name,division), approver:profiles!approved_by(full_name)";

async function runSelect(build: (q: ReturnType<typeof baseQuery>) => unknown): Promise<Letter[]> {
  const query = build(baseQuery()) as {
    order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Letter[];
}

function baseQuery() {
  return supabase.from("letters").select(SELECT);
}

export async function fetchMyLetters(userId: string): Promise<Letter[]> {
  return runSelect((q) => q.eq("requester_id", userId));
}

export async function fetchPendingLetters(): Promise<Letter[]> {
  return runSelect((q) => q.eq("approval_status", "Pending_Review"));
}

export async function fetchAllLetters(): Promise<Letter[]> {
  return runSelect((q) => q);
}

export async function countPendingLetters(): Promise<number> {
  const { count, error } = await supabase
    .from("letters")
    .select("id", { count: "exact", head: true })
    .eq("approval_status", "Pending_Review");
  if (error) throw error;
  return count ?? 0;
}

export async function countTodayRequests(userId: string, template: LetterTemplate): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("letters")
    .select("id", { count: "exact", head: true })
    .eq("requester_id", userId)
    .eq("template_type", template)
    .gte("created_at", start.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function countTodayByTemplate(userId: string): Promise<Record<string, number>> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("letters")
    .select("template_type")
    .eq("requester_id", userId)
    .gte("created_at", start.toISOString());
  if (error) throw error;
  const result: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ template_type: string }>) {
    result[row.template_type] = (result[row.template_type] ?? 0) + 1;
  }
  return result;
}

export type LetterInput = {
  template_type: LetterTemplate;
  purpose: string;
  recipient_name: string | null;
  recipient_organization: string | null;
  notes: string | null;
};

export async function createLetter(
  input: LetterInput,
  user: { id: string; division: string | null },
): Promise<Letter> {
  const auto = input.template_type === "Aktif_Organisasi";
  const payload: Record<string, unknown> = {
    template_type: input.template_type,
    purpose: input.purpose,
    recipient_name: input.recipient_name,
    recipient_organization: input.recipient_organization,
    notes: input.notes,
    requester_id: user.id,
    requester_division: user.division,
    output_type: "Nomor_Saja",
    approval_status: auto ? "Approved" : "Pending_Review",
    approved_by: auto ? user.id : null,
    approved_at: auto ? new Date().toISOString() : null,
  };
  const { data, error } = await supabase.from("letters").insert(payload).select("*").single();
  if (error) throw error;
  return data as Letter;
}

export async function approveLetter(id: string, reviewerId: string, notes: string | null) {
  const payload: Record<string, unknown> = {
    approval_status: "Approved",
    approved_by: reviewerId,
    approved_at: new Date().toISOString(),
  };
  if (notes) payload["notes"] = notes;
  const { error } = await supabase.from("letters").update(payload).eq("id", id);
  if (error) throw error;
}

export async function rejectLetter(id: string, reviewerId: string, notes: string) {
  const { error } = await supabase
    .from("letters")
    .update({
      approval_status: "Rejected",
      approved_by: reviewerId,
      approved_at: new Date().toISOString(),
      notes,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLetter(id: string) {
  const { error } = await supabase.from("letters").delete().eq("id", id);
  if (error) throw error;
}
