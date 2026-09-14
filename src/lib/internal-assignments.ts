import { supabase } from "@/lib/supabase-external";

/* ============================================================
 * Tipe & helper untuk penugasan INTERNAL (assignment_type='Internal').
 * Skema database tidak diubah — semua sudah ada dan verified.
 * ============================================================ */

export type ReviewStatus =
  | "Dikumpulkan"
  | "Direview"
  | "Diteruskan"
  | "Selesai"
  | "Dibatalkan_Anggota";

export type VisibilityFlags = {
  atasan_langsung?: boolean;
  semua_atasan?: boolean;
  divisi_assigner?: boolean;
  divisi_penerima?: boolean;
  supervisor?: boolean;
};

export type InternalAssignment = {
  id: string;
  title: string | null;
  instructions: string | null;
  category: string | null;
  scope: string | null;
  target_division: string | null;
  assignment_type: string | null;
  assigner_role: string | null;
  visibility_flags: VisibilityFlags | null;
  allow_text: boolean | null;
  allow_file: boolean | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string | null;
  is_active: boolean | null;
  is_cancelled: boolean | null;
  cancelled_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
};

export type InternalSubmission = {
  id: string;
  assignment_id: string | null;
  member_id: string | null;
  content: string | null;
  file_url: string | null;
  submitted_at: string | null;
  supervisor_comment: string | null;
  commented_by: string | null;
  commented_at: string | null;
  review_status: ReviewStatus | null;
  finalized_by: string | null;
  finalized_at: string | null;
  member_cancel_reason: string | null;
  member_cancelled_at: string | null;
};

export type Escalation = {
  id: string;
  submission_id: string | null;
  from_user: string | null;
  to_user: string | null;
  note: string | null;
  escalated_at: string | null;
};

export const CATEGORY_SUGGESTIONS = [
  "Koordinasi",
  "Laporan",
  "Persiapan Acara",
  "Follow-up",
  "Lainnya",
];

/* ---------------- Role tier (mirror get_role_tier) ---------------- */

export function roleTier(role?: string | null): number {
  switch (role) {
    case "Supervisor":
      return 3;
    case "Ketua":
    case "Waketu":
    case "Sekretaris":
    case "Controller":
      return 2;
    case "Kadiv":
      return 1;
    default:
      return 0;
  }
}

export function canAssign(role?: string | null): boolean {
  return roleTier(role) >= 1;
}

/** Mirror client-side dari can_assign_to (RLS tetap jadi penjaga utama). */
export function canAssignTo(
  assigner: { id?: string | null; role?: string | null } | null | undefined,
  target: { id?: string | null; role?: string | null } | null | undefined,
): boolean {
  if (!assigner?.id || !target?.id) return false;
  if (assigner.id === target.id) return false;
  const a = roleTier(assigner.role);
  const t = roleTier(target.role);
  if (a === 3) return true;
  if (a === 2) return target.role !== "Supervisor";
  if (a === 1) return t === 0 || target.role === "Kadiv";
  return false;
}

/* ---------------- Label & warna ---------------- */

export function reviewStatusLabel(status?: ReviewStatus | string | null): string {
  if (!status) return "Belum Dikumpulkan";
  if (status === "Dibatalkan_Anggota") return "Dibatalkan Anggota";
  return status;
}

export function reviewStatusClass(status?: ReviewStatus | string | null): string {
  switch (status) {
    case "Dikumpulkan":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
    case "Direview":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "Diteruskan":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-300";
    case "Selesai":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "Dibatalkan_Anggota":
      return "bg-red-500/15 text-red-700 dark:text-red-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function visibilityList(
  flags: VisibilityFlags | null | undefined,
  opts: { assignerName?: string | null; assignerDivision?: string | null },
): string[] {
  const out = [`Pembuat tugas (${opts.assignerName ?? "tidak diketahui"})`];
  if (flags?.atasan_langsung === true) out.push("Atasan langsung pembuat tugas");
  if (flags?.semua_atasan === true)
    out.push("Semua atasan di atas pembuat tugas (Ketua, Waketu, dst)");
  if (flags?.divisi_assigner === true)
    out.push(`Seluruh anggota divisi ${opts.assignerDivision ?? "pembuat tugas"}`);
  if (flags?.divisi_penerima === true) out.push("Seluruh anggota divisi kamu");
  if (flags?.supervisor === true) out.push("Pembina (Supervisor)");
  return out;
}

/* ---------------- Query ---------------- */

const ASSIGNMENT_COLS = "*";

export async function fetchInternalAssignmentsForMe(me: {
  id: string;
  division?: string | null;
}): Promise<InternalAssignment[]> {
  const [{ data: rows, error }, { data: targetRows, error: tErr }] = await Promise.all([
    supabase
      .from("assignments")
      .select(ASSIGNMENT_COLS)
      .eq("assignment_type", "Internal")
      .order("created_at", { ascending: false }),
    supabase.from("assignment_targets").select("assignment_id").eq("member_id", me.id),
  ]);
  if (error) throw error;
  if (tErr) throw tErr;

  const targeted = new Set(
    (targetRows ?? []).map((r: { assignment_id: string | null }) => r.assignment_id),
  );

  return ((rows ?? []) as InternalAssignment[]).filter((a) => {
    if (!a?.id) return false;
    if (a.scope === "Semua") return true;
    if (a.scope === "Divisi") return !!me.division && a.target_division === me.division;
    return targeted.has(a.id);
  });
}

export async function fetchMyInternalSubmissions(memberId: string): Promise<InternalSubmission[]> {
  const { data, error } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("member_id", memberId);
  if (error) throw error;
  return (data ?? []) as InternalSubmission[];
}

export async function fetchEscalationsFor(submissionIds: string[]): Promise<Escalation[]> {
  const ids = (submissionIds ?? []).filter(Boolean);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("assignment_escalations")
    .select("*")
    .in("submission_id", ids)
    .order("escalated_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as Escalation[];
}

export async function fetchAssignmentsCreatedByMe(
  creatorId: string,
): Promise<InternalAssignment[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_COLS)
    .eq("assignment_type", "Internal")
    .eq("created_by", creatorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InternalAssignment[];
}

export async function fetchTargetsForAssignments(
  assignmentIds: string[],
): Promise<{ assignment_id: string | null; member_id: string | null }[]> {
  const ids = (assignmentIds ?? []).filter(Boolean);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("assignment_targets")
    .select("assignment_id, member_id")
    .in("assignment_id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function fetchSubmissionsForAssignments(
  assignmentIds: string[],
): Promise<InternalSubmission[]> {
  const ids = (assignmentIds ?? []).filter(Boolean);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("assignment_submissions")
    .select("*")
    .in("assignment_id", ids);
  if (error) throw error;
  return (data ?? []) as InternalSubmission[];
}

export async function fetchInternalAssignment(id: string): Promise<InternalAssignment | null> {
  const { data, error } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as InternalAssignment | null;
}

/* ---------------- Mutasi ---------------- */

export type CreateInternalAssignmentInput = {
  title: string;
  instructions: string;
  category: string | null;
  scope: "Semua" | "Divisi" | "Individu";
  target_division: string | null;
  memberIds: string[];
  allow_text: boolean;
  allow_file: boolean;
  due_date: string | null;
  visibility_flags: VisibilityFlags;
};

export async function createInternalAssignment(
  input: CreateInternalAssignmentInput,
  creator: { id: string; role?: string | null },
): Promise<string> {
  const { memberIds, ...rest } = input;
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      title: rest.title,
      instructions: rest.instructions,
      category: rest.category,
      scope: rest.scope,
      target_division: rest.scope === "Divisi" ? rest.target_division : null,
      assignment_type: "Internal",
      assigner_role: creator.role ?? null,
      visibility_flags: rest.visibility_flags,
      allow_text: rest.allow_text,
      allow_file: rest.allow_file,
      due_date: rest.due_date,
      created_by: creator.id,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) throw error;

  const assignmentId = data?.id as string;
  if (rest.scope === "Individu" && memberIds.length > 0) {
    const { error: tErr } = await supabase
      .from("assignment_targets")
      .insert(memberIds.map((m) => ({ assignment_id: assignmentId, member_id: m })));
    if (tErr) throw tErr;
  }
  return assignmentId;
}

export async function submitInternalWork(input: {
  assignmentId: string;
  memberId: string;
  content: string | null;
  fileUrl: string | null;
}): Promise<void> {
  const { error } = await supabase.from("assignment_submissions").upsert(
    {
      assignment_id: input.assignmentId,
      member_id: input.memberId,
      content: input.content,
      file_url: input.fileUrl,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      review_status: "Dikumpulkan",
    },
    { onConflict: "assignment_id,member_id" },
  );
  if (error) throw error;
}

export async function cancelByMember(submissionId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from("assignment_submissions")
    .update({
      review_status: "Dibatalkan_Anggota",
      member_cancel_reason: reason,
      member_cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId);
  if (error) throw error;
}

/** Penerima membatalkan tugas yang belum pernah dikumpulkan. */
export async function cancelByMemberWithoutSubmission(input: {
  assignmentId: string;
  memberId: string;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.from("assignment_submissions").upsert(
    {
      assignment_id: input.assignmentId,
      member_id: input.memberId,
      review_status: "Dibatalkan_Anggota",
      member_cancel_reason: input.reason,
      member_cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "assignment_id,member_id" },
  );
  if (error) throw error;
}

export async function cancelWholeAssignment(
  assignmentId: string,
  reason: string,
  cancelledBy: string,
): Promise<void> {
  const { error } = await supabase
    .from("assignments")
    .update({
      is_cancelled: true,
      cancelled_reason: reason,
      cancelled_by: cancelledBy,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignmentId);
  if (error) throw error;
}

export async function commentInternalSubmission(
  submissionId: string,
  comment: string,
  commenterId: string,
  currentStatus: ReviewStatus | null,
): Promise<void> {
  const patch: Record<string, unknown> = {
    supervisor_comment: comment,
    commented_by: commenterId,
    commented_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (currentStatus === "Dikumpulkan") patch["review_status"] = "Direview";
  const { error } = await supabase
    .from("assignment_submissions")
    .update(patch)
    .eq("id", submissionId);
  if (error) throw error;
}

export async function approveSubmission(submissionId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("assignment_submissions")
    .update({
      review_status: "Selesai",
      finalized_by: userId,
      finalized_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId);
  if (error) throw error;
}

export async function escalateSubmission(input: {
  submissionId: string;
  fromUser: string;
  toUser: string;
  note: string;
}): Promise<void> {
  const { error } = await supabase.from("assignment_escalations").insert({
    submission_id: input.submissionId,
    from_user: input.fromUser,
    to_user: input.toUser,
    note: input.note,
  });
  if (error) throw error;
}
