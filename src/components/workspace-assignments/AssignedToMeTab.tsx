import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDivisions, useProfiles, type Profile } from "@/hooks/useProfile";
import { uploadSubmissionFile } from "@/lib/assignments";
import {
  cancelByMember,
  cancelByMemberWithoutSubmission,
  fetchEscalationsFor,
  fetchInternalAssignmentsForMe,
  fetchMyInternalSubmissions,
  submitInternalWork,
  type InternalAssignment,
  type InternalSubmission,
} from "@/lib/internal-assignments";
import { ReceivedTaskCard } from "./ReceivedTaskCard";
import { HistoryTaskRow } from "./HistoryTaskRow";
import { CancelReasonDialog } from "./CancelReasonDialog";

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
      <p className="text-sm text-muted-foreground">Gagal memuat data tugas.</p>
      <Button className="mt-3" variant="outline" size="sm" onClick={onRetry}>
        Coba lagi
      </Button>
    </div>
  );
}

export function AssignedToMeTab({ me }: { me: Profile | null | undefined }) {
  const queryClient = useQueryClient();
  const { data: profiles = [] } = useProfiles();
  const { data: divisions = [] } = useDivisions();
  const [cancelTarget, setCancelTarget] = useState<{
    assignmentId: string;
    submissionId: string | null;
  } | null>(null);

  const assignmentsQuery = useQuery({
    queryKey: ["internal-assignments-for-me", me?.id, me?.division],
    queryFn: () =>
      fetchInternalAssignmentsForMe({ id: me?.id as string, division: me?.division ?? null }),
    enabled: !!me?.id,
  });

  const submissionsQuery = useQuery({
    queryKey: ["internal-my-submissions", me?.id],
    queryFn: () => fetchMyInternalSubmissions(me?.id as string),
    enabled: !!me?.id,
  });

  const assignments = useMemo(
    () => (assignmentsQuery.data ?? []) as InternalAssignment[],
    [assignmentsQuery.data],
  );
  const submissions = useMemo(
    () => (submissionsQuery.data ?? []) as InternalSubmission[],
    [submissionsQuery.data],
  );

  const submissionByAssignment = useMemo(() => {
    const map = new Map<string, InternalSubmission>();
    (submissions ?? []).forEach((s) => {
      if (s?.assignment_id) map.set(s.assignment_id, s);
    });
    return map;
  }, [submissions]);

  const relevantSubmissionIds = useMemo(
    () =>
      (assignments ?? [])
        .map((a) => submissionByAssignment.get(a.id)?.id)
        .filter((v): v is string => !!v),
    [assignments, submissionByAssignment],
  );

  const { data: escalations = [] } = useQuery({
    queryKey: ["internal-escalations", relevantSubmissionIds.join(",")],
    queryFn: () => fetchEscalationsFor(relevantSubmissionIds),
    enabled: relevantSubmissionIds.length > 0,
  });

  const divisionNameOf = (code?: string | null) =>
    (divisions ?? []).find((d) => d?.code === code)?.name ?? code ?? "-";

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["internal-assignments-for-me"] });
    queryClient.invalidateQueries({ queryKey: ["internal-my-submissions"] });
    queryClient.invalidateQueries({ queryKey: ["internal-escalations"] });
  }

  const submitMutation = useMutation({
    mutationFn: async (vars: {
      assignmentId: string;
      content: string | null;
      file: File | null;
    }) => {
      let fileUrl: string | null = null;
      if (vars.file) fileUrl = await uploadSubmissionFile(vars.file, me?.id as string);
      await submitInternalWork({
        assignmentId: vars.assignmentId,
        memberId: me?.id as string,
        content: vars.content,
        fileUrl,
      });
    },
    onSuccess: () => {
      toast.success("Pekerjaan berhasil dikumpulkan.");
      refresh();
    },
    onError: (e: Error) => toast.error(e?.message || "Gagal mengumpulkan."),
  });

  const cancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!cancelTarget) return;
      if (cancelTarget.submissionId) {
        await cancelByMember(cancelTarget.submissionId, reason);
      } else {
        await cancelByMemberWithoutSubmission({
          assignmentId: cancelTarget.assignmentId,
          memberId: me?.id as string,
          reason,
        });
      }
    },
    onSuccess: () => {
      toast.success("Tugas dibatalkan.");
      setCancelTarget(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e?.message || "Gagal membatalkan tugas."),
  });

  if (assignmentsQuery.isError || submissionsQuery.isError) {
    return (
      <ErrorState
        onRetry={() => {
          assignmentsQuery.refetch();
          submissionsQuery.refetch();
        }}
      />
    );
  }

  if (assignmentsQuery.isLoading || submissionsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  }

  const isHistory = (a: InternalAssignment) => {
    const s = submissionByAssignment.get(a.id);
    return (
      a?.is_cancelled === true ||
      s?.review_status === "Selesai" ||
      s?.review_status === "Dibatalkan_Anggota"
    );
  };

  const todo = (assignments ?? []).filter((a) => !isHistory(a));
  const history = (assignments ?? []).filter(isHistory);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Perlu Dikerjakan ({todo.length})</h2>
        {todo.length === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
            Tidak ada tugas yang perlu dikerjakan saat ini.
          </p>
        ) : (
          todo.map((a) => {
            const sub = submissionByAssignment.get(a.id);
            return (
              <ReceivedTaskCard
                key={a.id}
                assignment={a}
                submission={sub}
                escalations={(escalations ?? []).filter((e) => e?.submission_id === sub?.id)}
                assigner={(profiles ?? []).find((p) => p?.id === a?.created_by)}
                profiles={profiles ?? []}
                divisionNameOf={divisionNameOf}
                submitting={submitMutation.isPending}
                onSubmitWork={({ content, file }) =>
                  submitMutation.mutate({ assignmentId: a.id, content, file })
                }
                onCancel={() =>
                  setCancelTarget({ assignmentId: a.id, submissionId: sub?.id ?? null })
                }
              />
            );
          })
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Riwayat ({history.length})</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>
        ) : (
          history.map((a) => (
            <HistoryTaskRow key={a.id} assignment={a} submission={submissionByAssignment.get(a.id)} />
          ))
        )}
      </section>

      <CancelReasonDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title="Batalkan tugas ini?"
        info="Aksi ini tidak dapat dibatalkan. Assigner dan atasan akan menerima notifikasi berisi alasan kamu."
        confirmLabel="Ya, batalkan tugas"
        submitting={cancelMutation.isPending}
        onSubmit={(reason) => cancelMutation.mutate(reason)}
      />
    </div>
  );
}
