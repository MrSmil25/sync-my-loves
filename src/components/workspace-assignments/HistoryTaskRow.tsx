import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { StatusBadge, formatDue, FileLink } from "./ReceivedTaskCard";
import type { InternalAssignment, InternalSubmission } from "@/lib/internal-assignments";

export function HistoryTaskRow({
  assignment,
  submission,
}: {
  assignment: InternalAssignment;
  submission: InternalSubmission | undefined;
}) {
  const [open, setOpen] = useState(false);
  const status = submission?.review_status ?? null;

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <button
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{assignment?.title ?? "Tanpa judul"}</span>
          <StatusBadge status={status} />
          {assignment?.is_cancelled === true && (
            <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
              Dibatalkan oleh Pembuat
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {formatDue(submission?.submitted_at ?? assignment?.due_date)}
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-2 border-t pt-3 text-sm">
          {assignment?.instructions && (
            <p className="whitespace-pre-line rounded-xl bg-muted p-3">{assignment.instructions}</p>
          )}
          {submission?.content && (
            <p className="whitespace-pre-line rounded-xl border p-3">{submission.content}</p>
          )}
          {submission?.file_url && <FileLink path={submission.file_url} />}
          {submission?.supervisor_comment && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Catatan</p>
              <p className="mt-1 whitespace-pre-line">{submission.supervisor_comment}</p>
            </div>
          )}
          {submission?.review_status === "Dibatalkan_Anggota" && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3">
              <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                Alasan kamu membatalkan
              </p>
              <p className="mt-1 whitespace-pre-line">
                {submission?.member_cancel_reason ?? "Tanpa alasan"}
              </p>
            </div>
          )}
          {assignment?.is_cancelled === true && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3">
              <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                Alasan pembatalan oleh pembuat
              </p>
              <p className="mt-1 whitespace-pre-line">
                {assignment?.cancelled_reason ?? "Tanpa alasan"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
