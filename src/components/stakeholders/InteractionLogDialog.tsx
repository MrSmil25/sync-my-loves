import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchDeals } from "@/lib/deals";
import { fetchEvents } from "@/lib/events";
import {
  CHANNELS,
  CHANNEL_META,
  DIRECTIONS,
  DIRECTION_LABELS,
  SENTIMENTS,
  SENTIMENT_META,
  createInteraction,
  fetchCompanyStatus,
  fetchIndividualStatus,
  updateInteraction,
  type Interaction,
  type InteractionChannel,
  type InteractionDirection,
  type Sentiment,
} from "@/lib/interactions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type InteractionTarget = {
  kind: "company" | "individual" | "people";
  id: string;
  name: string;
  /** Untuk kontak people, sertakan company induk agar log tetap terkait. */
  companyId?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: InteractionTarget;
  /** Kalau diisi, modal berfungsi sebagai edit. */
  interaction?: Interaction | null;
};

const today = () => new Date().toISOString().slice(0, 10);

const NONE = "__none__";

export function InteractionLogDialog({ open, onOpenChange, target, interaction }: Props) {
  const queryClient = useQueryClient();
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);

  const [summary, setSummary] = useState("");
  const [channel, setChannel] = useState<InteractionChannel>("WhatsApp");
  const [date, setDate] = useState(today());
  const [time, setTime] = useState("");
  const [direction, setDirection] = useState<InteractionDirection | "">("");
  const [details, setDetails] = useState("");
  const [outcome, setOutcome] = useState("");
  const [sentiment, setSentiment] = useState<Sentiment | "">("");
  const [eventId, setEventId] = useState(NONE);
  const [dealId, setDealId] = useState(NONE);
  const [nextStep, setNextStep] = useState("");
  const [nextStepDate, setNextStepDate] = useState("");

  const { data: events = [] } = useQuery({
    queryKey: ["events", "for-interaction"],
    queryFn: () => fetchEvents(false),
    enabled: open,
  });
  const { data: deals = [] } = useQuery({
    queryKey: ["deals", "for-interaction"],
    queryFn: () => fetchDeals(false),
    enabled: open,
  });

  function resetForm(keepTarget = true) {
    setSummary("");
    setChannel("WhatsApp");
    setDate(today());
    setTime("");
    setDirection("");
    setDetails("");
    setOutcome("");
    setSentiment("");
    setEventId(NONE);
    setDealId(NONE);
    setNextStep("");
    setNextStepDate("");
    if (keepTarget) setTimeout(() => summaryRef.current?.focus(), 50);
  }

  useEffect(() => {
    if (!open) return;
    if (interaction) {
      setSummary(interaction.summary ?? "");
      setChannel(interaction.channel ?? "WhatsApp");
      setDate(interaction.interaction_date ?? today());
      setTime(interaction.interaction_time?.slice(0, 5) ?? "");
      setDirection(interaction.direction ?? "");
      setDetails(interaction.details ?? "");
      setOutcome(interaction.outcome ?? "");
      setSentiment(interaction.sentiment ?? "");
      setEventId(interaction.related_event_id ?? NONE);
      setDealId(interaction.related_deal_id ?? NONE);
      setNextStep(interaction.next_step ?? "");
      setNextStepDate(interaction.next_step_date ?? "");
    } else {
      resetForm(false);
    }
    setTimeout(() => summaryRef.current?.focus(), 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, interaction?.id]);

  function buildPayload() {
    return {
      company_id:
        target.kind === "company"
          ? target.id
          : target.kind === "people"
            ? (target.companyId ?? null)
            : null,
      individual_id: target.kind === "individual" ? target.id : null,
      people_id: target.kind === "people" ? target.id : null,
      interaction_date: date || today(),
      interaction_time: time || null,
      channel,
      direction: direction || null,
      summary: summary.trim(),
      details: details.trim() || null,
      outcome: outcome.trim() || null,
      sentiment: sentiment || null,
      related_event_id: eventId === NONE ? null : eventId,
      related_deal_id: dealId === NONE ? null : dealId,
      next_step: nextStep.trim() || null,
      next_step_date: nextStepDate || null,
    };
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["interactions"] });
    queryClient.invalidateQueries({ queryKey: ["relationship-status"] });
    queryClient.invalidateQueries({ queryKey: ["relationship-statuses"] });
    queryClient.invalidateQueries({ queryKey: ["relationship-dashboard"] });
  }

  async function save(closeAfter: boolean) {
    if (!summary.trim()) {
      toast.error("Ringkasan wajib diisi.");
      summaryRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      if (interaction) {
        await updateInteraction(interaction.id, buildPayload());
        invalidate();
        toast.success("Interaksi diperbarui.");
        onOpenChange(false);
        return;
      }
      await createInteraction(buildPayload());
      invalidate();
      const status =
        target.kind === "individual"
          ? await fetchIndividualStatus(target.id).catch(() => null)
          : target.kind === "company"
            ? await fetchCompanyStatus(target.id).catch(() => null)
            : null;
      toast.success(
        status?.relationship_level
          ? `Interaksi tercatat. ${target.name} sekarang ${status.relationship_level}.`
          : `Interaksi tercatat untuk ${target.name}.`,
      );
      if (closeAfter) {
        onOpenChange(false);
      } else {
        resetForm(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan interaksi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {interaction ? "Edit Interaksi" : "Log Interaksi"} — {target.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="summary">Ringkasan (wajib)</Label>
            <Textarea
              id="summary"
              ref={summaryRef}
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  save(true);
                }
              }}
              placeholder="Contoh: Ngobrol soal potensi kerja sama sponsor Semnas"
            />
            <p className="text-xs text-muted-foreground">Tekan Ctrl/Cmd + Enter untuk simpan cepat.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kanal</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as InteractionChannel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>{CHANNEL_META[c]?.label ?? c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <Accordion type="single" collapsible>
            <AccordionItem value="detail">
              <AccordionTrigger>Detail Tambahan</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Waktu</Label>
                    <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Arah</Label>
                    <Select value={direction} onValueChange={(v) => setDirection(v as InteractionDirection)}>
                      <SelectTrigger><SelectValue placeholder="Pilih arah" /></SelectTrigger>
                      <SelectContent>
                        {DIRECTIONS.map((d) => (
                          <SelectItem key={d} value={d}>{DIRECTION_LABELS[d]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Detail lebih dalam</Label>
                  <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Hasil / Kesepakatan</Label>
                  <Textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Sentimen</Label>
                  <RadioGroup
                    className="flex flex-wrap gap-4"
                    value={sentiment}
                    onValueChange={(v) => setSentiment(v as Sentiment)}
                  >
                    {SENTIMENTS.map((s) => (
                      <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
                        <RadioGroupItem value={s} />
                        {SENTIMENT_META[s]?.label ?? s}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Event Terkait</Label>
                    <Select value={eventId} onValueChange={setEventId}>
                      <SelectTrigger><SelectValue placeholder="Tidak ada" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Tidak ada</SelectItem>
                        {events.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Deal Terkait</Label>
                    <Select value={dealId} onValueChange={setDealId}>
                      <SelectTrigger><SelectValue placeholder="Tidak ada" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Tidak ada</SelectItem>
                        {deals.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2 rounded-xl border border-dashed p-3">
                  <Label>Follow-up (jadi pengingat di dashboard)</Label>
                  <Input
                    value={nextStep}
                    onChange={(e) => setNextStep(e.target.value)}
                    placeholder="Contoh: Kirim proposal sponsorship"
                  />
                  <Input
                    type="date"
                    value={nextStepDate}
                    onChange={(e) => setNextStepDate(e.target.value)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
            {!interaction && (
              <Button variant="outline" disabled={saving} onClick={() => save(false)}>
                Simpan & Log Lagi
              </Button>
            )}
            <Button disabled={saving} onClick={() => save(true)}>
              {saving && <Loader2 className="size-4 animate-spin" />} Simpan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
