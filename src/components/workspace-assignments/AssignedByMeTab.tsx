import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDivisions, useProfiles, type Profile } from "@/hooks/useProfile";
import {
  createInternalAssignment,
  fetchAssignmentsCreatedByMe,
  fetchSubmissionsForAssignments,
  fetchTargetsForAssignments,
  type CreateInternalAssignmentInput,
  type InternalAssignment,
} from "@/lib/internal-assignments";
import { InternalTaskFormDialog } from "./InternalTaskFormDialog";
import { formatDue } from "./ReceivedTaskCard";

export function AssignedByMeTab({ me }: { me: Profile | null | undefined }) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const { data: profiles = [] } = useProfiles();
  const { data: divisions = [] } = useDivisions();

  const assignmentsQuery = useQuery({
    queryKey: ["internal-assignments-by-me", me?.id],
    queryFn: () => fetchAssignmentsCreatedByMe(me?.id as string),
    enabled: !!me?.id,
  });

  const assignments = useMemo(
    () => (assignmentsQuery.data ?? []) as InternalAssignment[],
    [assignmentsQuery.data],
  );
  const ids = useMemo(() => (assignments ?? []).map((a) => a.id), [assignments]);

  const { data: targets = [] } = useQuery({
    queryKey: ["internal-targets-by-me", ids.join(",")],
    queryFn: () => fetchTargetsForAssignments(ids),
    enabled: ids.length > 0,
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["internal-submissions-by-me", ids.join(",")],
    queryFn: () => fetchSubmissionsForAssignments(ids),
    enabled: ids.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateInternalAssignmentInput) =>
      createInternalAssignment(values, { id: me?.id as string, role: me?.role ?? null }),
    onSuccess: () => {
      toast.success("Tugas berhasil dibuat.");
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["internal-assignments-by-me"] });
      queryClient.invalidateQueries({ queryKey: ["internal-assignments-for-me"] });
    },
    onError: (e: Error) => toast.error(e?.message || "Gagal membuat tugas."),
  });

  const activeMembers = (profiles ?? []).filter((p) => (p?.status ?? "Active") === "Active");

  function totalTarget(a: InternalAssignment): number {
    if (a?.scope === "Semua") return activeMembers.length;
    if (a?.scope === "Divisi")
      return activeMembers.filter((p) => p?.division === a?.target_division).length;
    return (targets ?? []).filter((t) => t?.assignment_id === a.id).length;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Tugas yang Saya Berikan</h2>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="size-4" /> Buat Tugas Baru
        </Button>
      </div>

      {assignmentsQuery.isError ? (
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Gagal memuat daftar tugas.</p>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={() => assignmentsQuery.refetch()}
          >
            Coba lagi
          </Button>
        </div>
      ) : assignmentsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Kamu belum pernah membuat tugas internal.
        </p>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const subs = (submissions ?? []).filter((s) => s?.assignment_id === a.id);
            const total = totalTarget(a);
            const submitted = subs.filter(
              (s) => s?.review_status && s.review_status !== "Dibatalkan_Anggota",
            ).length;
            const done = subs.filter((s) => s?.review_status === "Selesai").length;
            const cancelled = subs.filter(
              (s) => s?.review_status === "Dibatalkan_Anggota",
            ).length;
            const divName =
              (divisions ?? []).find((d) => d?.code === a?.target_division)?.name ??
              a?.target_division;

            return (
              <Link
                key={a.id}
                to="/workspace/tasks-assigned/$id"
                params={{ id: a.id }}
                className="block rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:bg-accent/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">{a?.title ?? "Tanpa judul"}</h3>
                  {a?.category && (
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">
                      {a.category}
                    </span>
                  )}
                  {a?.is_cancelled === true && (
                    <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
                      Dibatalkan
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a?.scope === "Semua"
                    ? "Seluruh organisasi"
                    : a?.scope === "Divisi"
                      ? `Divisi ${divName ?? "-"}`
                      : "Anggota tertentu"}{" "}
                  · Tenggat: {formatDue(a?.due_date)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {total === 0
                    ? "0 target"
                    : `${total} target · ${submitted} sudah kumpul · ${done} selesai · ${cancelled} dibatalkan`}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      <InternalTaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        me={me}
        saving={createMutation.isPending}
        onSubmit={(values) => createMutation.mutate(values)}
      />
    </div>
  );
}
