import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Info, Send } from "lucide-react";
import { toast } from "sonner";
import { useMyProfile } from "@/hooks/useProfile";
import {
  LETTER_TEMPLATES,
  countTodayByTemplate,
  countTodayRequests,
  createLetter,
  dailyLimitFor,
  templateLabel,
  type LetterTemplate,
} from "@/lib/letters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/letters/request")({
  head: () => ({
    meta: [
      { title: "Request Surat — OrgTool" },
      {
        name: "description",
        content: "Ajukan permintaan surat organisasi lewat wizard tiga langkah: template, detail, konfirmasi.",
      },
      { property: "og:title", content: "Request Surat — OrgTool" },
      {
        property: "og:description",
        content: "Pilih template surat, isi detail keperluan, lalu kirim untuk review Sekretaris.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestLetterPage,
});

function RequestLetterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useMyProfile();
  const division =
    (profile as { division?: string | null } | null | undefined)?.division ?? null;

  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState<LetterTemplate | null>(null);
  const [purpose, setPurpose] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientOrg, setRecipientOrg] = useState("");
  const [notes, setNotes] = useState("");

  const { data: todayCounts = {} } = useQuery({
    queryKey: ["letters-today-counts", profile?.id],
    enabled: !!profile?.id,
    queryFn: () => countTodayByTemplate(profile!.id),
  });

  const limits = useMemo(() => {
    return LETTER_TEMPLATES.map((t) => {
      const limit = dailyLimitFor(t.value);
      const used = todayCounts[t.value] ?? 0;
      return { ...t, limit, used, blocked: limit !== null && used >= limit };
    });
  }, [todayCounts]);

  const needRecipient = template !== null && template !== "Aktif_Organisasi";

  const submit = useMutation({
    mutationFn: async () => {
      if (!profile?.id || !template) throw new Error("Data belum lengkap.");
      const limit = dailyLimitFor(template);
      if (limit !== null) {
        const used = await countTodayRequests(profile.id, template);
        if (used >= limit) {
          throw new Error("Kamu sudah mencapai batas hari ini untuk kategori ini. Coba besok.");
        }
      }
      return createLetter(
        {
          template_type: template,
          purpose: purpose.trim(),
          recipient_name: recipientName.trim() || null,
          recipient_organization: recipientOrg.trim() || null,
          notes: notes.trim() || null,
        },
        { id: profile.id, division },
      );
    },
    onSuccess: (letter) => {
      queryClient.invalidateQueries({ queryKey: ["letters"] });
      queryClient.invalidateQueries({ queryKey: ["letters-pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["letters-today-counts"] });
      toast.success(
        template === "Aktif_Organisasi"
          ? "Surat disetujui otomatis. Nomor surat segera terbit."
          : "Permintaan surat dikirim ke Sekretaris.",
      );
      navigate({ to: "/letters", search: { tab: "mine", highlight: letter.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function nextFromStep2() {
    if (!purpose.trim()) {
      toast.error("Keperluan / perihal wajib diisi.");
      return;
    }
    if (needRecipient && !recipientName.trim()) {
      toast.error("Nama penerima wajib diisi untuk template ini.");
      return;
    }
    setStep(3);
  }

  const flowInfo =
    template === "Aktif_Organisasi"
      ? "Surat ini menggunakan template baku dan akan LANGSUNG DISETUJUI otomatis. Nomor surat akan segera keluar."
      : template === "Custom"
        ? "Surat custom butuh review lebih teliti. Estimasi 1-3 hari kerja."
        : "Surat akan masuk antrean review Sekretaris. Kamu akan dinotifikasi saat disetujui atau ditolak.";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Request Surat</h1>
        <p className="text-sm text-muted-foreground">Tiga langkah singkat untuk mengajukan surat.</p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex-1 rounded-full px-3 py-1.5 text-center font-medium ${
              step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            Langkah {s}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div className="space-y-3 rounded-2xl border bg-card p-5">
          <p className="font-semibold">Pilih Template</p>
          {limits.map((t) => (
            <button
              key={t.value}
              type="button"
              disabled={t.blocked}
              onClick={() => {
                setTemplate(t.value);
                setStep(2);
              }}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                t.blocked
                  ? "cursor-not-allowed opacity-60"
                  : template === t.value
                    ? "border-primary bg-accent"
                    : "hover:bg-accent/60"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1 size-4 shrink-0 rounded-full border-2 ${
                    template === t.value ? "border-primary bg-primary" : "border-muted-foreground"
                  }`}
                />
                <div>
                  <p className="font-medium">{t.label}</p>
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                  {t.hint ? <p className="mt-1 text-xs text-primary">{t.hint}</p> : null}
                  {t.blocked ? (
                    <p className="mt-1 text-xs text-destructive">
                      Kamu sudah mencapai batas hari ini untuk kategori ini. Coba besok.
                    </p>
                  ) : t.limit !== null ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Terpakai hari ini: {t.used}/{t.limit}
                    </p>
                  ) : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {step === 2 && template ? (
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <p className="font-semibold">Isi Detail — {templateLabel(template)}</p>
          <div className="space-y-2">
            <Label htmlFor="purpose">Keperluan / Perihal *</Label>
            <Textarea
              id="purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={4}
              placeholder="Jelaskan keperluan surat ini"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipient">Nama Penerima {needRecipient ? "*" : "(opsional)"}</Label>
            <Input
              id="recipient"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Nama orang atau jabatan tujuan"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org">Organisasi Penerima (opsional)</Label>
            <Input
              id="org"
              value={recipientOrg}
              onChange={(e) => setRecipientOrg(e.target.value)}
              placeholder="Instansi / organisasi tujuan"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Catatan Tambahan (opsional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-2 size-4" /> Kembali
            </Button>
            <Button onClick={nextFromStep2}>
              Lanjut <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 && template ? (
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <p className="font-semibold">Konfirmasi</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Template</dt>
              <dd className="text-sm font-medium">{templateLabel(template)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Divisi</dt>
              <dd className="text-sm font-medium">{division ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Keperluan</dt>
              <dd className="text-sm font-medium whitespace-pre-wrap">{purpose}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Penerima</dt>
              <dd className="text-sm font-medium">{recipientName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Organisasi Penerima</dt>
              <dd className="text-sm font-medium">{recipientOrg || "—"}</dd>
            </div>
            {notes ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Catatan</dt>
                <dd className="text-sm font-medium whitespace-pre-wrap">{notes}</dd>
              </div>
            ) : null}
          </dl>

          <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p className="text-sm">{flowInfo}</p>
          </div>

          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-2 size-4" /> Kembali
            </Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              <Send className="mr-2 size-4" /> {submit.isPending ? "Mengirim…" : "Kirim"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
