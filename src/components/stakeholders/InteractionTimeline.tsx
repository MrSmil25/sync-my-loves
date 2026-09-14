import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ChevronDown, ChevronUp, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { isBPH, useMyProfile, useProfiles } from "@/hooks/useProfile";
import {
  CHANNELS,
  CHANNEL_META,
  DIRECTION_LABELS,
  SENTIMENTS,
  SENTIMENT_META,
  setInteractionArchived,
  type Interaction,
} from "@/lib/interactions";
import {
  InteractionLogDialog,
  type InteractionTarget,
} from "@/components/stakeholders/InteractionLogDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 25;

/** Timeline interaksi dengan filter dan paginasi sederhana. */
export function InteractionTimeline({
  interactions,
  target,
  labelFor,
}: {
  interactions: Interaction[];
  target: InteractionTarget;
  /** Label "Ke: …" per kartu (dipakai di halaman company). */
  labelFor?: (i: Interaction) => string | null;
}) {
  const queryClient = useQueryClient();
  const { data: profile } = useMyProfile();
  const { data: profiles = [] } = useProfiles();
  const [channelFilter, setChannelFilter] = useState<string[]>([]);
  const [sentimentFilter, setSentimentFilter] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [logOpen, setLogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Interaction | null>(null);

  const nameOf = useMemo(() => {
    const map = new Map(profiles.map((p) => [p.id, p.full_name]));
    return (uid: string | null) => (uid ? (map.get(uid) ?? "Anggota") : "—");
  }, [profiles]);

  const filtered = useMemo(
    () =>
      interactions.filter(
        (i) =>
          (channelFilter.length === 0 || (i.channel && channelFilter.includes(i.channel))) &&
          (sentimentFilter.length === 0 || (i.sentiment && sentimentFilter.includes(i.sentiment))) &&
          (!from || i.interaction_date >= from) &&
          (!to || i.interaction_date <= to),
      ),
    [interactions, channelFilter, sentimentFilter, from, to],
  );

  const latest = interactions[0];

  function toggle(list: string[], v: string, setter: (x: string[]) => void) {
    setter(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  async function archive(i: Interaction) {
    try {
      await setInteractionArchived(i.id, true);
      queryClient.invalidateQueries({ queryKey: ["interactions"] });
      queryClient.invalidateQueries({ queryKey: ["relationship-status"] });
      toast.success("Interaksi diarsipkan.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengarsipkan.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{interactions.length} interaksi tercatat</p>
          <p className="text-xs text-muted-foreground">
            {latest
              ? `Terakhir: ${format(new Date(latest.interaction_date), "d MMMM yyyy", {
                  locale: localeId,
                })} · ${formatDistanceToNow(new Date(latest.interaction_date), {
                  locale: localeId,
                  addSuffix: true,
                })}`
              : "Belum ada interaksi tercatat."}
          </p>
        </div>
        <Button onClick={() => setLogOpen(true)}>
          <Plus className="size-4" /> Log Baru
        </Button>
      </div>

      <div className="space-y-2 rounded-xl border p-3">
        <div className="flex flex-wrap gap-1.5">
          {CHANNELS.map((c) => (
            <button key={c} type="button" onClick={() => toggle(channelFilter, c, setChannelFilter)}>
              <Badge
                variant="outline"
                className={`cursor-pointer ${CHANNEL_META[c]?.className ?? ""} ${
                  channelFilter.includes(c) ? "ring-2 ring-primary" : "opacity-60"
                }`}
              >
                {CHANNEL_META[c]?.label ?? c}
              </Badge>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SENTIMENTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggle(sentimentFilter, s, setSentimentFilter)}
            >
              <Badge
                variant="outline"
                className={`cursor-pointer ${SENTIMENT_META[s]?.className ?? ""} ${
                  sentimentFilter.includes(s) ? "ring-2 ring-primary" : "opacity-60"
                }`}
              >
                {SENTIMENT_META[s]?.label ?? s}
              </Badge>
            </button>
          ))}
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
            aria-label="Dari tanggal"
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
            aria-label="Sampai tanggal"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Belum ada interaksi yang cocok. Klik <b>+ Log Baru</b> untuk mencatat.
          </CardContent>
        </Card>
      ) : (
        <ol className="relative space-y-3 border-l pl-5">
          {filtered.slice(0, visible).map((i) => {
            const meta = i.channel ? CHANNEL_META[i.channel] : undefined;
            const canEdit = !!profile && (profile.id === i.logged_by || isBPH(profile.role));
            const extraLabel = labelFor?.(i);
            const isOpen = !!expanded[i.id];
            return (
              <li key={i.id} className="relative">
                <span
                  className={`absolute -left-[27px] top-4 flex size-4 items-center justify-center rounded-full ${meta?.className ?? "bg-muted"}`}
                />
                <Card>
                  <CardContent className="space-y-2 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {i.channel && (
                            <Badge variant="outline" className={meta?.className ?? ""}>
                              {meta?.label ?? i.channel}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(i.interaction_date), "d MMM yyyy", { locale: localeId })}
                            {i.interaction_time ? ` · ${i.interaction_time.slice(0, 5)}` : ""}
                          </span>
                          {extraLabel && (
                            <span className="text-xs text-muted-foreground">Ke: {extraLabel}</span>
                          )}
                        </div>
                        <p className="mt-1 font-semibold">{i.summary}</p>
                        {i.direction && (
                          <p className="text-xs text-muted-foreground">
                            {DIRECTION_LABELS[i.direction] ?? i.direction}
                          </p>
                        )}
                      </div>
                      {canEdit && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label="Aksi interaksi">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditTarget(i)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => archive(i)}>Arsipkan</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {i.details && (
                      <div>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                          onClick={() => setExpanded((p) => ({ ...p, [i.id]: !isOpen }))}
                        >
                          {isOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                          {isOpen ? "Sembunyikan detail" : "Lihat detail"}
                        </button>
                        {isOpen && <p className="mt-1 whitespace-pre-wrap text-sm">{i.details}</p>}
                      </div>
                    )}

                    {(i.outcome || i.next_step) && (
                      <div className="rounded-xl border-l-4 border-l-primary bg-muted/40 p-3 text-sm">
                        {i.outcome && (
                          <p>
                            <span className="font-medium">Hasil: </span>
                            {i.outcome}
                          </p>
                        )}
                        {i.next_step && (
                          <p className="mt-1">
                            <span className="font-medium">Next step: </span>
                            {i.next_step}
                            {i.next_step_date &&
                              ` · ${format(new Date(i.next_step_date), "d MMM yyyy", { locale: localeId })}`}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {i.sentiment ? (
                        <Badge variant="outline" className={SENTIMENT_META[i.sentiment]?.className ?? ""}>
                          {SENTIMENT_META[i.sentiment]?.label ?? i.sentiment}
                        </Badge>
                      ) : (
                        <span />
                      )}
                      <span className="text-xs text-muted-foreground">
                        Dicatat {nameOf(i.logged_by)} ·{" "}
                        {formatDistanceToNow(new Date(i.created_at), {
                          locale: localeId,
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      {filtered.length > visible && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Muat {Math.min(PAGE_SIZE, filtered.length - visible)} lagi
          </Button>
        </div>
      )}

      <InteractionLogDialog open={logOpen} onOpenChange={setLogOpen} target={target} />
      {editTarget && (
        <InteractionLogDialog
          open={!!editTarget}
          onOpenChange={(v) => !v && setEditTarget(null)}
          target={target}
          interaction={editTarget}
        />
      )}
    </div>
  );
}
