import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isBefore } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Eye, Paperclip, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { signedFileUrl } from "@/lib/assignments";
import type { Profile } from "@/hooks/useProfile";
import {
  reviewStatusClass,
  reviewStatusLabel,
  visibilityList,
  type Escalation,
  type InternalAssignment,
  type InternalSubmission,
} from "@/lib/internal-assignments";

export function FileLink({ path }: { path: string }) {
  const { data: url } = useQuery({
    queryKey: ["submission-file", path],
    queryFn: () => signedFileUrl(path),
  });
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-flex items-center gap-2 text-sm text-primary underline"
    >
      <Paperclip className="size-4" /> Lihat lampiran
    </a>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${reviewStatusClass(status)}`}
    >
      {reviewStatusLabel(status)}
    </span>
  );
}

export function formatDue(due?: string | null): string {
  if (!due) return "Tanpa tenggat";
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return "Tanpa tenggat";
  return format(d, "d MMM yyyy HH:mm", { locale: idLocale });
}

export function ReceivedTaskCard({
  assignment,
  submission,
  escalations,
  assigner,
  profiles,
  divisionNameOf,
  submitting,
  onSubmitWork,
  onCancel,
}: {
  assignment: InternalAssignment;
  submission: InternalSubmission | undefined;
  escalations: Escalation[];
  assigner: Profile | undefined;
  profiles: Profile[];
  divisionNameOf: (code?: string | null) => string;
  submitting: boolean;
  onSubmitWork: (values: { content: string | null; file: File | null }) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(submission?.content ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [expanded, setExpanded] = useState(false);

  const instructions = assignment?.instructions ?? "";
  const long = instructions.length > 200;
  const status = submission?.review_status ?? null;
  const due = assignment?.due_date ? new Date(assignment.due_date) : null;
  const dueSoon = !!due && !Number.isNaN(due.getTime()) && isBefore(due, new Date());

  const canCancel = status !== "Selesai" && status !== "Dibatalkan_Anggota" && !submission?.finalized_at;
  const locked = assignment?.is_cancelled === true || status === "Selesai" || status === "Dibatalkan_Anggota";

  const visList = visibilityList(assignment?.visibility_flags, {
    assignerName: assigner?.full_name ?? null,
    assignerDivision: divisionNameOf(assigner?.division),
  });

  return (
    <article className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{assignment?.title ?? "Tanpa judul"}</h3>
        {assignment?.category && (
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">
            {assignment.category}
          </span>
        )}
        <StatusBadge status={status} />
        {assignment?.is_cancelled === true && (
          <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
            Dibatalkan oleh Pembuat
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Ditugaskan oleh: {assigner?.full_name ?? "Tidak diketahui"} ({assigner?.role ?? "-"}
        {assigner?.division ? `, ${divisionNameOf(assigner.division)}` : ""})
      </p>

      {instructions && (
        <div className="mt-3 rounded-xl bg-muted p-3 text-sm">
          <p className="whitespace-pre-line">
            {long && !expanded ? `${instructions.slice(0, 200)}…` : instructions}
          </p>
          {long && (
            <button
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              {expanded ? "Tutup" : "Selengkapnya"}
            </button>
          )}
        </div>
      )}

      <p className={`mt-3 text-xs ${dueSoon ? "font-semibold text-red-600" : "text-muted-foreground"}`}>
        Tenggat: {formatDue(assignment?.due_date)}
      </p>

      <div className="mt-3 rounded-xl border bg-background p-3">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <Eye className="size-3.5" /> Kumpulan kamu akan dilihat oleh:
        </p>
        <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
          {visList.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
      </div>

      {(escalations ?? []).length > 0 && (
        <div className="mt-3 rounded-xl border border-purple-500/40 bg-purple-500/10 p-3 text-sm">
          {(escalations ?? []).map((e) => {
            const to = (profiles ?? []).find((p) => p?.id === e?.to_user);
            return (
              <p key={e.id}>
                Tugas kamu sedang direview oleh {to?.full_name ?? "atasan"}
                {e?.note ? ` — ${e.note}` : ""}
              </p>
            );
          })}
        </div>
      )}

      {submission?.supervisor_comment && (
        <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            Catatan untuk kamu
          </p>
          <p className="mt-1 whitespace-pre-line text-sm">{submission.supervisor_comment}</p>
        </div>
      )}

      {submission?.file_url && <FileLink path={submission.file_url} />}

      {!locked && (
        <div className="mt-4 space-y-2 border-t pt-4">
          {assignment?.allow_text === true && (
            <Textarea
              rows={3}
              placeholder="Tulis jawaban kamu…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          )}
          {assignment?.allow_file === true && (
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={submitting || (!((content ?? "").trim()) && !file)}
              onClick={() => onSubmitWork({ content: (content ?? "").trim() || null, file })}
            >
              {submission ? "Simpan Revisi" : "Kumpulkan"}
            </Button>
            {canCancel && (
              <Button size="sm" variant="outline" className="border-red-500/50 text-red-600" onClick={onCancel}>
                Batalkan Tugas
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
