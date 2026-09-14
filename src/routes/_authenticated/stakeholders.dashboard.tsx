import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CalendarClock, Flame, Snowflake, Trophy } from "lucide-react";
import { useProfiles } from "@/hooks/useProfile";
import {
  LEVEL_META,
  RELATIONSHIP_LEVELS,
  fetchGoingCold,
  fetchMonthlyLogActivity,
  fetchRelationshipHeatmap,
  fetchTopLoggers,
  fetchUpcomingFollowups,
  type GoingCold,
} from "@/lib/interactions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/stakeholders/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Hubungan — Pemangku Kepentingan" },
      {
        name: "description",
        content: "Follow-up hari ini, pemangku yang mulai dingin, dan peta kekuatan hubungan organisasi.",
      },
      { property: "og:title", content: "Dashboard Hubungan" },
      {
        property: "og:description",
        content: "Pantau follow-up, pemangku yang mulai dingin, dan disiplin log interaksi tim.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RelationshipDashboard,
});

const COLD_LIMIT = 20;

function RelationshipDashboard() {
  const [showAllCold, setShowAllCold] = useState(false);
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  const [catFilter, setCatFilter] = useState<string[]>([]);

  const { data: followups = [] } = useQuery({
    queryKey: ["followups", "upcoming"],
    queryFn: () => fetchUpcomingFollowups(7),
  });
  const { data: cold = [] } = useQuery({ queryKey: ["going-cold"], queryFn: fetchGoingCold });
  const { data: heat = [] } = useQuery({ queryKey: ["relationship-heatmap"], queryFn: fetchRelationshipHeatmap });
  const { data: monthly = [] } = useQuery({
    queryKey: ["interactions", "monthly"],
    queryFn: fetchMonthlyLogActivity,
  });
  const { data: loggers = [] } = useQuery({
    queryKey: ["interactions", "top-loggers"],
    queryFn: fetchTopLoggers,
  });
  const { data: profiles = [] } = useProfiles();
  const nameOf = useMemo(() => {
    const map = new Map(profiles.map((p) => [p.id, p.full_name]));
    return (uid: string) => map.get(uid) ?? "Anggota";
  }, [profiles]);

  const groups = useMemo(() => {
    const today = new Date();
    const g: Record<string, typeof followups> = { hari: [], besok: [], minggu: [] };
    for (const f of followups) {
      const d = differenceInCalendarDays(new Date(f.next_step_date), today);
      if (d <= 0) g["hari"]!.push(f);
      else if (d === 1) g["besok"]!.push(f);
      else g["minggu"]!.push(f);
    }
    return g;
  }, [followups]);

  const categories = useMemo(
    () => Array.from(new Set(cold.map((c) => c.category).filter(Boolean) as string[])).sort(),
    [cold],
  );
  const filteredCold = useMemo(
    () =>
      cold.filter(
        (c) =>
          (levelFilter.length === 0 || (c.level && levelFilter.includes(c.level))) &&
          (catFilter.length === 0 || (c.category && catFilter.includes(c.category))),
      ),
    [cold, levelFilter, catFilter],
  );
  const shownCold = showAllCold ? filteredCold : filteredCold.slice(0, COLD_LIMIT);

  const heatCats = useMemo(() => Array.from(new Set(heat.map((h) => h.category))).sort(), [heat]);
  const heatMax = Math.max(1, ...heat.map((h) => h.count));
  const cellOf = (cat: string, lvl: string) =>
    heat.find((h) => h.category === cat && h.level === lvl)?.count ?? 0;

  const maxMonth = Math.max(1, ...monthly.map((m) => m.count));

  function toggle(list: string[], v: string, setter: (x: string[]) => void) {
    setter(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Hubungan</h1>
        <p className="text-sm text-muted-foreground">
          Siapa yang perlu disapa hari ini, dan seberapa kuat hubungan kita di tiap kategori.
        </p>
      </div>

      {/* Section 1 */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <CalendarClock className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Follow-up Hari Ini &amp; Minggu Ini</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {followups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Tidak ada follow-up terjadwal. Coba tandai next step di log interaksi berikutnya.
            </p>
          ) : (
            (
              [
                ["hari", "Hari Ini"],
                ["besok", "Besok"],
                ["minggu", "Minggu Ini"],
              ] as [string, string][]
            ).map(([key, label]) =>
              (groups[key] ?? []).length === 0 ? null : (
                <div key={key} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  {(groups[key] ?? []).map((f) => (
                    <div
                      key={f.interaction_id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold">{f.target_name ?? "Tanpa nama"}</p>
                        <p className="text-sm">{f.next_step}</p>
                        {f.previous_summary && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Sebelumnya: {f.previous_summary}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {format(new Date(f.next_step_date), "EEEE, d MMMM yyyy", { locale: localeId })}
                        </p>
                      </div>
                      {f.target_link && (
                        <Button asChild size="sm" variant="outline">
                          <a href={f.target_link}>Buka</a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ),
            )
          )}
        </CardContent>
      </Card>

      {/* Section 2 */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Snowflake className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Mulai Dingin (perlu perhatian)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {["Dingin", "Putus"].map((l) => (
              <button key={l} type="button" onClick={() => toggle(levelFilter, l, setLevelFilter)}>
                <Badge
                  variant="outline"
                  className={`cursor-pointer ${LEVEL_META[l]?.badge ?? ""} ${
                    levelFilter.includes(l) ? "ring-2 ring-primary" : "opacity-60"
                  }`}
                >
                  {l}
                </Badge>
              </button>
            ))}
            {categories.map((c) => (
              <button key={c} type="button" onClick={() => toggle(catFilter, c, setCatFilter)}>
                <Badge
                  variant="outline"
                  className={`cursor-pointer ${catFilter.includes(c) ? "ring-2 ring-primary" : "opacity-60"}`}
                >
                  {c.replace(/_/g, " ")}
                </Badge>
              </button>
            ))}
          </div>

          {shownCold.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Tidak ada pemangku yang mulai dingin. Kerja bagus!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Nama</th>
                    <th className="py-2 pr-3">Kategori</th>
                    <th className="py-2 pr-3">Level</th>
                    <th className="py-2 pr-3">Terakhir Hubungi</th>
                    <th className="py-2 pr-3">Sudah</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {shownCold.map((c: GoingCold) => (
                    <tr key={`${c.target_type}-${c.target_id}`} className="border-t">
                      <td className="py-2 pr-3 font-medium">{c.target_name}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {c.category?.replace(/_/g, " ") ?? "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className={LEVEL_META[c.level ?? ""]?.badge ?? ""}>
                          {c.level ?? "—"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {c.last_interaction_date
                          ? format(new Date(c.last_interaction_date), "d MMM yyyy", { locale: localeId })
                          : "Belum pernah"}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {c.days_since_last != null ? `${c.days_since_last} hari` : "—"}
                      </td>
                      <td className="py-2">
                        <Button asChild size="sm" variant="outline">
                          {c.target_type === "company" ? (
                            <Link to="/companies/$id" params={{ id: c.target_id }} search={{ log: true }}>
                              Sapa Sekarang
                            </Link>
                          ) : (
                            <Link
                              to="/stakeholders/individuals/$id"
                              params={{ id: c.target_id }}
                              search={{ log: true }}
                            >
                              Sapa Sekarang
                            </Link>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!showAllCold && filteredCold.length > COLD_LIMIT && (
            <Button variant="ghost" size="sm" onClick={() => setShowAllCold(true)}>
              Lihat semua ({filteredCold.length})
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Section 3 */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Flame className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Peta Panas Hubungan</CardTitle>
        </CardHeader>
        <CardContent>
          {heatCats.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada data hubungan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-xs uppercase text-muted-foreground">Tingkat</th>
                    {heatCats.map((c) => (
                      <th key={c} className="p-2 text-xs font-medium text-muted-foreground">
                        {c.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RELATIONSHIP_LEVELS.map((lvl) => (
                    <tr key={lvl}>
                      <td className="p-2 text-xs font-semibold">{lvl}</td>
                      {heatCats.map((cat) => {
                        const n = cellOf(cat, lvl);
                        return (
                          <td key={cat} className="p-1">
                            <Link
                              to="/stakeholders"
                              search={{ level: lvl, cat }}
                              className="flex size-12 items-center justify-center rounded-lg border font-semibold transition-transform hover:scale-105"
                              style={{
                                backgroundColor: n
                                  ? `color-mix(in srgb, var(--primary) ${Math.round((n / heatMax) * 70) + 10}%, transparent)`
                                  : undefined,
                              }}
                            >
                              {n || ""}
                            </Link>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Section 4 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aktivitas Log (12 bulan)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-1.5">
              {monthly.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{m.count || ""}</span>
                  <div
                    className="w-full rounded-t bg-primary/70"
                    style={{ height: `${(m.count / maxMonth) * 100}%`, minHeight: m.count ? 4 : 2 }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(`${m.month}-01`), "MMM", { locale: localeId })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Section 5 */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Trophy className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Top Kontributor Log Bulan Ini</CardTitle>
          </CardHeader>
          <CardContent>
            {loggers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Belum ada log bulan ini. Yuk mulai catat interaksi!
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {loggers.slice(0, 10).map((l, idx) => (
                    <tr key={l.user_id} className="border-t first:border-t-0">
                      <td className="w-8 py-2 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 font-medium">{nameOf(l.user_id)}</td>
                      <td className="py-2 text-right text-muted-foreground">{l.count} log</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
