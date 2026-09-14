import * as XLSX from "xlsx";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/lib/supabase-external";
import { fetchOrgSettings } from "@/lib/announcements";
import {
  fetchAssignment,
  fetchAssignmentProgress,
  fetchAssignmentTargets,
  fetchAssignmentsByCreator,
  fetchSubmissions,
  scopeLabel,
  type Assignment,
  type AssignmentSubmission,
} from "@/lib/assignments";

type ProfileLite = { id: string; full_name: string | null; division: string | null; status?: string | null };
type DivisionLite = { code: string; name: string | null };

const DT = (v?: string | null) =>
  v ? format(new Date(v), "dd/MM/yyyy HH:mm", { locale: idLocale }) : "";
const D = (v?: string | null) => (v ? format(new Date(v), "dd/MM/yyyy", { locale: idLocale }) : "");

function truncate(v: string | null | undefined, max = 500) {
  if (!v) return "";
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

function slug(v: string) {
  return v
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function sheetFrom(rows: Record<string, unknown>[], cols: number[], header?: string[]) {
  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}], header ? { header } : undefined);
  ws["!cols"] = cols.map((wch) => ({ wch }));
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = { font: { bold: true } };
  }
  return ws;
}

async function loadDirectories() {
  const [{ data: profiles }, { data: divisions }, org] = await Promise.all([
    supabase.from("profiles").select("id, full_name, division, status"),
    supabase.from("divisions").select("code, name"),
    fetchOrgSettings(),
  ]);
  return {
    profiles: (profiles ?? []) as ProfileLite[],
    divisions: (divisions ?? []) as DivisionLite[],
    orgName: org?.org_name ?? "Organisasi",
  };
}

function targetsFor(
  assignment: Assignment,
  profiles: ProfileLite[],
  targetIds: string[],
): ProfileLite[] {
  const active = profiles.filter((p) => p.status === "Active");
  if (assignment.scope === "Semua") return active;
  if (assignment.scope === "Divisi")
    return active.filter((p) => p.division === assignment.target_division);
  return active.filter((p) => targetIds.includes(p.id));
}

function detailRows(
  assignment: Assignment,
  targets: ProfileLite[],
  submissions: AssignmentSubmission[],
  divisions: DivisionLite[],
) {
  const byMember = new Map(submissions.map((s) => [s.member_id, s]));
  return targets.map((p) => {
    const s = byMember.get(p.id);
    return {
      "Judul Tugas": assignment.title,
      Kategori: assignment.category ?? "",
      "Nama Anggota": p.full_name ?? "",
      Divisi: divisions.find((d) => d.code === p.division)?.name ?? p.division ?? "",
      "Status Kumpul": s ? "Sudah" : "Belum",
      "Waktu Kumpul": s ? DT(s.submitted_at) : "",
      "Isi Jawaban": s ? truncate(s.content) : "",
      "Ada Lampiran": s ? (s.file_url ? "Ya" : "Tidak") : "",
      "Komentar Pembina": s?.supervisor_comment ?? "",
      "Waktu Dikomentari": s ? DT(s.commented_at) : "",
    };
  });
}

const DETAIL_COLS = [30, 14, 25, 18, 14, 18, 50, 13, 40, 18];

/** Export rekap seluruh penugasan milik Pembina. */
export async function exportAllAssignments(creatorId: string): Promise<void> {
  const [{ profiles, divisions, orgName }, assignments, progress] = await Promise.all([
    loadDirectories(),
    fetchAssignmentsByCreator(creatorId),
    fetchAssignmentProgress(),
  ]);

  const perAssignment = await Promise.all(
    assignments.map(async (a) => {
      const [submissions, targetIds] = await Promise.all([
        fetchSubmissions(a.id),
        a.scope === "Individu" ? fetchAssignmentTargets(a.id) : Promise.resolve<string[]>([]),
      ]);
      return { a, submissions, targets: targetsFor(a, profiles, targetIds) };
    }),
  );

  const today = format(new Date(), "yyyy-MM-dd");

  // Sheet 1
  const summaryRows = assignments.map((a) => {
    const entry = perAssignment.find((p) => p.a.id === a.id);
    const row = progress.find((p) => p.assignment_id === a.id);
    const total = Number(row?.total_target ?? entry?.targets.length ?? 0);
    const submitted = Number(row?.total_submitted ?? entry?.submissions.length ?? 0);
    return {
      "Judul Tugas": a.title,
      Kategori: a.category ?? "",
      Sasaran: scopeLabel(a.scope, divisions.find((d) => d.code === a.target_division)?.name),
      Tenggat: a.due_date ? DT(a.due_date) : "Tanpa tenggat",
      "Total Target": total,
      "Total Terkumpul": submitted,
      "Persentase (%)": `${total > 0 ? Math.round((submitted / total) * 100) : 0}%`,
      Status: a.is_active ? "Aktif" : "Nonaktif",
    };
  });
  const totTarget = summaryRows.reduce((n, r) => n + Number(r["Total Target"]), 0);
  const totSubmit = summaryRows.reduce((n, r) => n + Number(r["Total Terkumpul"]), 0);
  summaryRows.push({
    "Judul Tugas": "TOTAL",
    Kategori: "",
    Sasaran: "",
    Tenggat: "",
    "Total Target": totTarget,
    "Total Terkumpul": totSubmit,
    "Persentase (%)": `${totTarget > 0 ? Math.round((totSubmit / totTarget) * 100) : 0}%`,
    Status: "",
  });


  const wb = XLSX.utils.book_new();
  const wsHeaderTable = XLSX.utils.aoa_to_sheet([
    ["Rekap Tugas dari Pembina"],
    [`Organisasi: ${orgName}`],
    [`Tanggal Export: ${D(new Date().toISOString())}`],
    [],
  ]);
  XLSX.utils.sheet_add_json(wsHeaderTable, summaryRows, { origin: "A5" });
  wsHeaderTable["!cols"] = [30, 14, 22, 18, 13, 16, 15, 12].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsHeaderTable, "Ringkasan");

  // Sheet 2
  const allDetail = perAssignment.flatMap(({ a, submissions, targets }) =>
    detailRows(a, targets, submissions, divisions),
  );
  XLSX.utils.book_append_sheet(wb, sheetFrom(allDetail, DETAIL_COLS), "Detail Pengumpulan");

  // Sheet 3
  const stats = new Map<string, { done: number; total: number }>();
  perAssignment.forEach(({ submissions, targets }) => {
    const done = new Set(submissions.map((s) => s.member_id));
    targets.forEach((p) => {
      const cur = stats.get(p.id) ?? { done: 0, total: 0 };
      cur.total += 1;
      if (done.has(p.id)) cur.done += 1;
      stats.set(p.id, cur);
    });
  });
  const memberRows = [...stats.entries()]
    .map(([memberId, s]) => {
      const p = profiles.find((x) => x.id === memberId);
      const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
      return {
        Nama: p?.full_name ?? "",
        Divisi: divisions.find((d) => d.code === p?.division)?.name ?? p?.division ?? "",
        "Total Tugas Ditugaskan": s.total,
        "Sudah Dikumpulkan": s.done,
        Belum: s.total - s.done,
        "Persentase Kepatuhan (%)": `${pct}%`,
        _pct: pct,
      };
    })
    .sort((a, b) => b._pct - a._pct)
    .map(({ _pct, ...rest }) => rest);
  XLSX.utils.book_append_sheet(wb, sheetFrom(memberRows, [25, 18, 20, 18, 10, 22]), "Rekap per Anggota");

  XLSX.writeFile(wb, `Rekap-Tugas-Pembina_${today}.xlsx`);
}

/** Export satu penugasan. */
export async function exportSingleAssignment(assignmentId: string): Promise<void> {
  const [{ profiles, divisions }, assignment, submissions, targetIds] = await Promise.all([
    loadDirectories(),
    fetchAssignment(assignmentId),
    fetchSubmissions(assignmentId),
    fetchAssignmentTargets(assignmentId),
  ]);
  if (!assignment) throw new Error("Penugasan tidak ditemukan.");

  const targets = targetsFor(assignment, profiles, targetIds);
  const divName = divisions.find((d) => d.code === assignment.target_division)?.name;

  const wb = XLSX.utils.book_new();
  const wsInfo = XLSX.utils.aoa_to_sheet([
    ["Judul", assignment.title],
    ["Instruksi", assignment.instructions ?? ""],
    ["Kategori", assignment.category ?? ""],
    ["Sasaran", scopeLabel(assignment.scope, divName)],
    ["Tenggat", assignment.due_date ? DT(assignment.due_date) : "Tanpa tenggat"],
    ["Visibilitas", assignment.visibility ?? ""],
    ["Total Target", targets.length],
    ["Total Terkumpul", submissions.length],
  ]);
  wsInfo["!cols"] = [{ wch: 20 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, "Info");

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(detailRows(assignment, targets, submissions, divisions), DETAIL_COLS),
    "Pengumpulan",
  );

  XLSX.writeFile(
    wb,
    `Tugas_${slug(assignment.title ?? "tugas")}_${format(new Date(), "yyyy-MM-dd")}.xlsx`,
  );
}
