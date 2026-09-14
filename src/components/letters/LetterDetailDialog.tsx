import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { formatDateID } from "@/lib/format";
import {
  approveLetter,
  canReviewLetters,
  deleteLetter,
  rejectLetter,
  statusBadgeClass,
  statusLabel,
  templateBadgeClass,
  templateLabel,
  type Letter,
} from "@/lib/letters";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  letter: Letter | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: { id: string; role: string | null } | null;
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value || "—"}</p>
    </div>
  );
}

export function LetterDetailDialog({ letter, open, onOpenChange, currentUser }: Props) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    setNotes("");
    setRejecting(false);
  }, [letter?.id, open]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["letters"] });
    queryClient.invalidateQueries({ queryKey: ["letters-pending-count"] });
  };

  const approve = useMutation({
    mutationFn: async () => {
      if (!letter || !currentUser) return;
      await approveLetter(letter.id, currentUser.id, notes.trim() || null);
    },
    onSuccess: () => {
      toast.success("Surat disetujui. Nomor surat sedang dibuat.");
      invalidate();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async () => {
      if (!letter || !currentUser) return;
      await rejectLetter(letter.id, currentUser.id, notes.trim());
    },
    onSuccess: () => {
      toast.success("Surat ditolak.");
      invalidate();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!letter) return;
      await deleteLetter(letter.id);
    },
    onSuccess: () => {
      toast.success("Draft surat dihapus.");
      invalidate();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!letter) return null;

  const isReviewer = canReviewLetters(currentUser?.role);
  const canApprove = isReviewer && letter.approval_status === "Pending_Review";
  const canDelete = letter.approval_status === "Draft" && letter.requester_id === currentUser?.id;

  async function copyNumber() {
    if (!letter?.letter_number) return;
    try {
      await navigator.clipboard.writeText(letter.letter_number);
      toast.success("Nomor surat disalin.");
    } catch {
      toast.error("Gagal menyalin nomor surat.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Detail Surat</DialogTitle>
          <DialogDescription>Informasi lengkap permintaan surat.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${templateBadgeClass(letter.template_type)}`}>
              {templateLabel(letter.template_type)}
            </span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(letter.approval_status)}`}>
              {statusLabel(letter.approval_status)}
            </span>
          </div>

          {letter.approval_status === "Approved" && letter.letter_number ? (
            <div className="rounded-xl border bg-emerald-50 p-4">
              <p className="text-xs text-emerald-800">Nomor Surat</p>
              <p className="mt-1 text-xl font-bold break-words text-emerald-950">{letter.letter_number}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={copyNumber}>
                <Copy className="mr-2 size-4" /> Salin Nomor
              </Button>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Keperluan / Perihal" value={letter.purpose} />
            <Field label="Nama Penerima" value={letter.recipient_name} />
            <Field label="Organisasi Penerima" value={letter.recipient_organization} />
            <Field
              label="Requester"
              value={
                letter.requester?.full_name
                  ? `${letter.requester.full_name}${letter.requester.division ? ` — ${letter.requester.division}` : ""}`
                  : (letter.requester_division ?? "—")
              }
            />
            <Field label="Divisi Requester" value={letter.requester_division} />
            <Field label="Jenis Output" value={letter.output_type ?? "Nomor_Saja"} />
            <Field label="Tanggal Dibuat" value={formatDateID(letter.created_at)} />
            <Field
              label="Disetujui / Ditolak"
              value={letter.approved_at ? formatDateID(letter.approved_at) : "—"}
            />
          </div>

          {letter.notes ? (
            <div className="rounded-xl border bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground">Catatan</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{letter.notes}</p>
            </div>
          ) : null}

          {canApprove ? (
            <div className="space-y-3 rounded-xl border p-4">
              <p className="text-sm font-semibold">Tindakan Review</p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  rejecting ? "Alasan penolakan (wajib)" : "Catatan untuk requester (opsional)"
                }
                rows={3}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => approve.mutate()}
                  disabled={approve.isPending}
                >
                  <Check className="mr-2 size-4" /> Setujui
                </Button>
                <Button
                  variant="destructive"
                  disabled={reject.isPending}
                  onClick={() => {
                    if (!notes.trim()) {
                      setRejecting(true);
                      toast.error("Alasan penolakan wajib diisi.");
                      return;
                    }
                    reject.mutate();
                  }}
                >
                  <X className="mr-2 size-4" /> Tolak
                </Button>
              </div>
            </div>
          ) : null}

          {canDelete ? (
            <Button
              variant="outline"
              className="text-destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              <Trash2 className="mr-2 size-4" /> Hapus Draft
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
