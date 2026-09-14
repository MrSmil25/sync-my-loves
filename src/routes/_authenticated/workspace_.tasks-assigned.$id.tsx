import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/UserAvatar";
import { DivisionBadge } from "@/components/DivisionBadge";
import { useDivisions, useMyProfile, useProfiles } from "@/hooks/useProfile";
import {
  approveSubmission,
  cancelWholeAssignment,
  commentInternalSubmission,
  escalateSubmission,
  fetchEscalationsFor,
  fetchInternalAssignment,
  fetchSubmissionsForAssignments,
  fetchTargetsForAssignments,
  roleTier,
  visibilityList,
  type InternalSubmission,
  type ReviewStatus,
} from "@/lib/internal-assignments";
import { CancelReasonDialog } from "@/components/workspace-assignments/CancelReasonDialog";
import {
  FileLink,
  StatusBadge,
  formatDue,
} from "@/components/workspace-assignments/ReceivedTaskCard";

export const Route = createFileRoute("/_authenticated/workspace_/tasks-assigned/$id")({
  head: () => ({
    meta: [
      { title: "Detail Tugas Internal — OrgTool" },
      {
        name: "description",
        content: "Pantau pengumpulan, beri komentar, dan teruskan tugas internal yang kamu buat.",
      },
      { property: "og:title", content: "Detail Tugas Internal — OrgTool" },
      {
        property: "og:description",
        content: "Pantau pengumpulan, beri komentar, dan teruskan tugas internal yang kamu buat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssignedTaskDetailPage,
});

function AssignedTaskDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: me } = useMyProfile();
  const { data: profiles = [] } = useProfiles();
  const { data: divisions = [] } = useDivisions();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<InternalSubmission | null>(null);
  const [commentText, setCommentText] = useState("");
  const [approveTarget, setApproveTarget] = useState<InternalSubmission | null>(null);
  const [escalateTarget, setEscalateTarget] = useState<InternalSubmission | null>(null);
  const [escalateTo, setEscalateTo] = useState("");
  const [escalateNote, setEscalateNote] = useState("");

  const assignmentQuery = useQuery({
    queryKey: ["internal-assignment", id],
    queryFn: () => fetchInternalAssignment(id),
  });
  const submissionsQuery = useQuery({
    queryKey: ["internal-assignment-submissions", id],
    queryFn: () => fetchSubmissionsForAssignments([id]),
  });
  const targetsQuery = useQuery({
    queryKey: ["internal-assignment-targets", id],
    queryFn: () => fetchTargetsForAssignments([id]),
  });

  const assignment = assignmentQuery.data ?? null;
  const submissions = useMemo(
    () => (submissionsQuery.data ?? []) as InternalSubmission[],
    [submissionsQuery.data],
  );
  const submissionIds = useMemo(
    () => submissions.map((s) => s?.id).filter((v): v is string => !!v),
    [submissions],
  );
  const { data: escalations = [] } = useQuery({
    queryKey: ["internal-assignment-escalations", submissionIds.join(",")],
    queryFn: () => fetchEscalationsFor(submissionIds),
    enabled: submissionIds.length > 0,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["internal-assignment", id] });
    queryClient.invalidateQueries({ queryKey: ["internal-assignment-submissions", id] });
    queryClient.invalidateQueries({ queryKey: ["internal-assignment-escalations"] });
    queryClient.invalidateQueries({ queryKey: ["internal-assignments-by-me"] });
  }

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => cancelWholeAssignment(id, reason, me?.id as string),
    onSuccess: () => {
      toast.success("Tugas dibatalkan.");
      setCancelOpen(false);
      refresh();
    },
    onError: (e: Error) => toast.error(e?.message || "Gagal membatalkan tugas."),
  });

  const commentMutation = useMutation({
    mutationFn: () =>
      commentInternalSubmission(
        commentTarget?.id as string,
        (commentText ?? "").trim(),
        me?.id as string,
        (commentTarget?.review_status ?? null) as ReviewStatus | null,
      ),
    onSuccess: () => {
      toast.success("Komentar tersimpan.");
      setCommentTarget(null);
      setCommentText("");
      refresh();
    },
    onError: (e: Error) => toast.error(e?.message || "Gagal menyimpan komentar."),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveSubmission(approveTarget?.id as string, me?.id as string),
    onSuccess: () => {
      toast.success("Ditandai selesai.");
      setApproveTarget(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e?.message || "Gagal menyelesaikan."),
  });

  const escalateMutation = useMutation({
    mutationFn: () =>
      escalateSubmission({
        submissionId: escalateTarget?.id as string,
        fromUser: me?.id as string,
        toUser: escalateTo,
        note: (escalateNote ?? "").trim(),
      }),
    onSuccess: () => {
      toast.success("Tugas diteruskan.");
      setEscalateTarget(null);
      setEscalateTo("");
      setEscalateNote("");
      refresh();
    },
    onError: (e: Error) => toast.error(e?.message || "Gagal meneruskan tugas."),
  });

  const divisionNameOf = (code?: string | null) =>
    (divisions ?? []).find((d) => d?.code === code)?.name ?? code ?? "-";
  const divisionColorOf = (code?: string | null) =>
    (divisions ?? []).find((d) => d?.code === code)?.color_hex ?? null;

  if (assignmentQuery.isError) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">Gagal memuat tugas ini.</p>
        <Button className="mt-3" variant="outline" onClick={() => assignmentQuery.refetch()}>
          Coba lagi
        </Button>
      </div>
    );
  }

  if (assignmentQuery.isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  if (!assignment) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">Tugas tidak ditemukan.</p>
      </div>
    );
  }

  const activeMembers = (profiles ?? []).filter((p) => (p?.status ?? "Active") === "Active");
  const targetIds = (targetsQuery.data ?? [])
    .map((t) => t?.member_id)
    .filter((v): v is string => !!v);
  const targetMembers =
    assignment.scope === "Semua"
      ? activeMembers
      : assignment.scope === "Divisi"
        ? activeMembers.filter((p) => p?.division === assignment.target_division)
        : activeMembers.filter((p) => targetIds.includes(p.id));

  const subByMember = new Map<string, InternalSubmission>();
  submissions.forEach((s) => {
    if (s?.member_id) subByMember.set(s.member_id, s);
  });

  const total = targetMembers.length;
  const stat = (status: ReviewStatus) =>
    submissions.filter((s) => s?.review_status === status).length;

  const myTier = roleTier(me?.role);
  const escalationCandidates = activeMembers.filter(
    (p) => roleTier(p?.role) > myTier && p?.id !== me?.id,
  );

  const visList = visibilityList(assignment.visibility_flags, {
    assignerName: me?.full_name ?? null,
    assignerDivision: divisionNameOf(me?.division),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        to="/workspace"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke Ruang Kerja
      </Link>

      <header className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">{assignment?.title ?? "Tanpa judul"}</h1>
          {assignment?.category && (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">
              {assignment.category}
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              assignment?.is_cancelled === true
                ? "bg-red-500/15 text-red-700 dark:text-red-300"
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {assignment?.is_cancelled === true ? "Dibatalkan" : "Aktif"}
          </span>
        </div>

        {assignment?.instructions && (
          <p className="mt-3 whitespace-pre-line rounded-xl bg-muted p-3 text-sm">
            {assignment.instructions}
          </p>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {assignment?.scope === "Semua"
            ? "Seluruh organisasi"
            : assignment?.scope === "Divisi"
              ? `Divisi ${divisionNameOf(assignment?.target_division)}`
              : "Anggota tertentu"}{" "}
          · Tenggat: {formatDue(assignment?.due_date)}
        </p>

        <div className="mt-3 rounded-xl border p-3">
          <p className="text-xs font-semibold">Kumpulan bisa dilihat oleh:</p>
          <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
            {visList.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {total === 0
            ? "0 target"
            : `${total} target · ${submissions.filter((s) => s?.review_status && s.review_status !== "Dibatalkan_Anggota").length} sudah kumpul · ${stat("Direview")} direview · ${stat("Diteruskan")} diteruskan · ${stat("Selesai")} selesai · ${stat("Dibatalkan_Anggota")} dibatalkan anggota`}
        </p>

        {assignment?.is_cancelled === true ? (
          <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
            <p className="text-xs font-semibold text-red-700 dark:text-red-300">
              Alasan pembatalan
            </p>
            <p className="mt-1 whitespace-pre-line">
              {assignment?.cancelled_reason ?? "Tanpa alasan"}
            </p>
          </div>
        ) : (
          <Button
            className="mt-4"
            variant="destructive"
            size="sm"
            onClick={() => setCancelOpen(true)}
          >
            Batalkan Seluruh Tugas
          </Button>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
          DAFTAR PENERIMA ({total})
        </h2>

        {submissionsQuery.isLoading ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : total === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
            Belum ada penerima terdaftar.
          </p>
        ) : (
          targetMembers.map((p) => {
            const s = subByMember.get(p.id);
            const subEsc = (escalations ?? []).filter((e) => e?.submission_id === s?.id);
            return (
              <article key={p.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar path={p?.photo_url} name={p?.full_name} className="size-9" />
                    <div>
                      <p className="text-sm font-semibold">{p?.full_name ?? "Anggota"}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <DivisionBadge
                          name={p?.division ? divisionNameOf(p.division) : null}
                          colorHex={divisionColorOf(p?.division)}
                        />
                        <StatusBadge status={s?.review_status ?? null} />
                      </div>
                    </div>
                  </div>

                  {s && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCommentTarget(s);
                          setCommentText(s?.supervisor_comment ?? "");
                        }}
                      >
                        Beri Komentar
                      </Button>
                      {s?.review_status !== "Selesai" &&
                        s?.review_status !== "Dibatalkan_Anggota" && (
                          <>
                            <Button size="sm" onClick={() => setApproveTarget(s)}>
                              Approve Selesai
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEscalateTarget(s)}
                            >
                              Teruskan
                            </Button>
                          </>
                        )}
                    </div>
                  )}
                </div>

                {s?.content && (
                  <p className="mt-3 rounded-xl bg-muted p-3 text-sm">
                    {(s.content ?? "").length > 100
                      ? `${(s.content ?? "").slice(0, 100)}…`
                      : s.content}
                  </p>
                )}
                {s?.file_url && <FileLink path={s.file_url} />}
                {s?.submitted_at && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Dikumpulkan: {formatDue(s.submitted_at)}
                  </p>
                )}

                {s?.review_status === "Dibatalkan_Anggota" && (
                  <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                      Alasan pembatalan anggota
                    </p>
                    <p className="mt-1 whitespace-pre-line">
                      {s?.member_cancel_reason ?? "Tanpa alasan"}
                    </p>
                  </div>
                )}

                {subEsc.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {subEsc.map((e) => {
                      const to = (profiles ?? []).find((x) => x?.id === e?.to_user);
                      return (
                        <li key={e.id}>
                          Diteruskan ke {to?.full_name ?? "-"} pada {formatDue(e?.escalated_at)}
                          {e?.note ? `: ${e.note}` : ""}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
            );
          })
        )}
      </section>

      <CancelReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Batalkan seluruh tugas?"
        info="Aksi ini tidak dapat dibatalkan. Semua penerima akan tidak lagi bisa mengumpulkan. Submission yang sudah masuk tetap tersimpan sebagai bukti."
        confirmLabel="Ya, batalkan tugas"
        submitting={cancelMutation.isPending}
        onSubmit={(reason) => cancelMutation.mutate(reason)}
      />

      <Dialog open={!!commentTarget} onOpenChange={(o) => !o && setCommentTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Beri Komentar</DialogTitle>
            <DialogDescription>Catatan ini akan terlihat oleh anggota.</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Tulis komentar…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentTarget(null)}>
              Batal
            </Button>
            <Button
              disabled={!((commentText ?? "").trim()) || commentMutation.isPending}
              onClick={() => commentMutation.mutate()}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tandai selesai?</DialogTitle>
            <DialogDescription>
              Pengumpulan ini akan ditutup dan ditandai selesai.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>
              Batal
            </Button>
            <Button disabled={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
              Ya, selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!escalateTarget} onOpenChange={(o) => !o && setEscalateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teruskan ke atasan</DialogTitle>
            <DialogDescription>Pilih siapa yang akan melanjutkan review ini.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={escalateTo} onValueChange={setEscalateTo}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih penerima" />
              </SelectTrigger>
              <SelectContent>
                {escalationCandidates
                  .filter(
                    (p) =>
                      p?.id !== escalateTarget?.member_id &&
                      !(escalations ?? []).some(
                        (e) => e?.submission_id === escalateTarget?.id && e?.to_user === p?.id,
                      ),
                  )
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p?.full_name ?? "-"} ({p?.role ?? "-"})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Textarea
              rows={3}
              value={escalateNote}
              onChange={(e) => setEscalateNote(e.target.value)}
              placeholder="Catatan eskalasi (minimal 10 karakter)"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalateTarget(null)}>
              Batal
            </Button>
            <Button
              disabled={
                !escalateTo ||
                (escalateNote ?? "").trim().length < 10 ||
                escalateMutation.isPending
              }
              onClick={() => escalateMutation.mutate()}
            >
              Teruskan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
