import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ExternalLink,
  Layers,
  MoreHorizontal,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useMyProfile } from "@/hooks/useProfile";
import { CONTENT_FORMATS, CONTENT_PLATFORMS, label } from "@/lib/marketing";
import { formatDateID } from "@/lib/format";
import { fetchAllFrameworkPillars } from "@/lib/frameworks";
import {
  archivePerformance,
  canRecordPerformance,
  engagementRate,
  fetchPendingPerformance,
  fetchPerformanceRecords,
  formatNumberID,
  formatPercentID,
  recordTitle,
  type PendingPerformance,
  type PerformanceRecord,
} from "@/lib/content-performance";
import { PerformanceFormDialog } from "@/components/marketing/PerformanceFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tab = "dashboard" | "catatan";
const NONE = "__none__";
const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Senin → Minggu

export const Route = createFileRoute("/_authenticated/content-performance")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: search["tab"] === "catatan" ? "catatan" : "dashboard",
  }),
  head: () => ({
    meta: [
      { title: "Performa Konten — OrgTool" },
      {
        name: "description",
        content:
          "Dashboard pola performa konten: format terbaik, hari terbaik, pilar paling resonan, dan catatan metrik konten.",
      },
      { property: "og:title", content: "Performa Konten — OrgTool" },
      {
        property: "og:description",
        content: "Pelajari pola performa konten dan catat metrik konten yang sudah tayang.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContentPerformancePage,
});

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultFrom() {
  const date = new Date();
  date.setDate(date.getDate() - 90);
  return toDateInputValue(date);
}

function monthLabel(key: string) {
  const [year = 2026, month = 1] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

function ContentPerformancePage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useMyProfile();
  const canRecord = canRecordPerformance(profile?.role, profile?.division);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PerformanceRecord | null>(null);
  const [seed, setSeed] = useState<PendingPerformance | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["content-performance"],
    queryFn: () => fetchPerformanceRecords(),
  });
  const { data: pending = [] } = useQuery({
    queryKey: ["content-needs-performance"],
    queryFn: fetchPendingPerformance,
  });
  const { data: pillars = [] } = useQuery({
    queryKey: ["framework-pillars"],
    queryFn: fetchAllFrameworkPillars,
  });

  const archive = useMutation({
    mutationFn: archivePerformance,
    onSuccess: () => {
      toast.success("Catatan performa diarsipkan");
      queryClient.invalidateQueries({ queryKey: ["content-performance"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openNew(pendingItem?: PendingPerformance) {
    setEditing(null);
    setSeed(pendingItem ?? null);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <BarChart3 className="size-6" /> Performa Konten
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pelajari pola konten yang berhasil, lalu tiru dan perbanyak.
          </p>
        </div>
        {canRecord ? (
          <Button onClick={() => openNew()}>
            <Plus className="size-4" /> Catat Performa
          </Button>
        ) : null}
      </header>

      <div className="flex gap-2">
        {(
          [
            ["dashboard", "Dashboard Pola"],
            ["catatan", "Catatan"],
          ] as Array<[Tab, string]>
        ).map(([value, caption]) => (
          <button
            key={value}
            onClick={() => navigate({ search: { tab: value } })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {caption}
          </button>
        ))}
      </div>

      {tab === "dashboard" ? (
        <DashboardPol records={records} isLoading={isLoading} />
      ) : (
        <CatatanTab
          records={records}
          isLoading={isLoading}
          pending={pending}
          pillars={pillars}
          canRecord={canRecord}
          onNew={openNew}
          onEdit={(record) => {
            setEditing(record);
            setSeed(null);
            setDialogOpen(true);
          }}
          onArchive={(id) => archive.mutate(id)}
        />
      )}

      <PerformanceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialPending={seed}
        editing={editing}
      />
    </div>
  );
}

/* ================= TAB 1: DASHBOARD POLA ================= */

type Aggregate = {
  key: string;
  color?: string | null | undefined;
  jumlah: number;
  totalReach: number;
  totalEngagement: number;
  totalSaves: number;
  totalShares: number;
  totalFollowers: number;
};

function newAggregate(key: string, color?: string | null): Aggregate {
  return {
    key,
    color,
    jumlah: 0,
    totalReach: 0,
    totalEngagement: 0,
    totalSaves: 0,
    totalShares: 0,
    totalFollowers: 0,
  };
}

function addToAggregate(bucket: Aggregate, record: PerformanceRecord) {
  bucket.jumlah += 1;
  bucket.totalReach += Number(record.reach ?? 0);
  bucket.totalEngagement += Number(record.engagement_total ?? 0);
  bucket.totalSaves += Number(record.saves ?? 0);
  bucket.totalShares += Number(record.shares ?? 0);
  bucket.totalFollowers += Number(record.new_followers ?? 0);
}

const avg = (total: number, count: number) => (count > 0 ? total / count : 0);
const erOf = (bucket: Aggregate) =>
  bucket.totalReach > 0 ? (bucket.totalEngagement / bucket.totalReach) * 100 : 0;

function DashboardPol({
  records,
  isLoading,
}: {
  records: PerformanceRecord[];
  isLoading: boolean;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(() => toDateInputValue(new Date()));
  const [platforms, setPlatforms] = useState<string[]>([]);

  const filtered = useMemo(
    () =>
      records.filter((record) => {
        if (from && record.posted_date < from) return false;
        if (to && record.posted_date > to) return false;
        if (platforms.length > 0 && !platforms.includes(record.platform)) return false;
        return true;
      }),
    [records, from, to, platforms],
  );

  const byFormat = useMemo(() => {
    const map = new Map<string, Aggregate>();
    for (const record of filtered) {
      const key = label(record.format);
      if (!map.has(key)) map.set(key, newAggregate(key));
      addToAggregate(map.get(key)!, record);
    }
    return [...map.values()].sort((a, b) => erOf(b) - erOf(a));
  }, [filtered]);

  const byPillar = useMemo(() => {
    const map = new Map<string, Aggregate>();
    for (const record of filtered) {
      const key = record.framework_pillars?.name ?? "Tanpa pilar";
      if (!map.has(key)) map.set(key, newAggregate(key, record.framework_pillars?.color_hex));
      addToAggregate(map.get(key)!, record);
    }
    return [...map.values()].sort((a, b) => erOf(b) - erOf(a));
  }, [filtered]);

  const byDow = useMemo(() => {
    const map = new Map<number, Aggregate>();
    for (const record of filtered) {
      const day = new Date(`${record.posted_date}T00:00:00`).getDay();
      if (!map.has(day)) map.set(day, newAggregate(DAY_NAMES[day] ?? "-"));
      addToAggregate(map.get(day)!, record);
    }
    return DAY_ORDER.filter((day) => map.has(day)).map((day) => ({
      ...map.get(day)!,
      hari: DAY_NAMES[day],
    }));
  }, [filtered]);

  const monthly = useMemo(() => {
    const map = new Map<string, Aggregate>();
    for (const record of filtered) {
      const key = record.posted_date.slice(0, 7);
      if (!map.has(key)) map.set(key, newAggregate(key));
      addToAggregate(map.get(key)!, record);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, bucket]) => ({
        bulan: monthLabel(key),
        rataJangkauan: Math.round(avg(bucket.totalReach, bucket.jumlah)),
        rataInteraksi: Math.round(avg(bucket.totalEngagement, bucket.jumlah)),
        followerBaru: bucket.totalFollowers,
      }));
  }, [filtered]);

  const top = useMemo(
    () =>
      [...filtered]
        .sort(
          (a, b) =>
            engagementRate(b.engagement_total, b.reach) -
            engagementRate(a.engagement_total, a.reach),
        )
        .slice(0, 20),
    [filtered],
  );

  const insights = useMemo(() => {
    const list: Array<{ icon: typeof Sparkles; text: string }> = [];
    const bestFormat = byFormat[0];
    if (bestFormat) {
      list.push({
        icon: Layers,
        text: `Format dengan engagement tertinggi: ${bestFormat.key} (${formatPercentID(erOf(bestFormat))}). Perbanyak format ini.`,
      });
    }
    const bestDay = [...byDow].sort(
      (a, b) => avg(b.totalEngagement, b.jumlah) - avg(a.totalEngagement, a.jumlah),
    )[0];
    if (bestDay) {
      list.push({
        icon: CalendarDays,
        text: `Hari terbaik posting: ${bestDay.hari} (rata-rata ${formatNumberID(avg(bestDay.totalEngagement, bestDay.jumlah))} interaksi).`,
      });
    }
    const bestPillar = byPillar[0];
    if (bestPillar && bestPillar.key !== "Tanpa pilar") {
      list.push({
        icon: Target,
        text: `Pilar paling resonan: ${bestPillar.key} (${formatPercentID(erOf(bestPillar))} engagement).`,
      });
    }
    if (filtered.length > 0 && filtered.length < 5) {
      list.push({
        icon: AlertTriangle,
        text: "Data masih sedikit. Pola akan makin akurat setelah 10+ konten dicatat.",
      });
    }
    return list;
  }, [byFormat, byDow, byPillar, filtered.length]);

  function togglePlatform(platform: string) {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform],
    );
  }

  const maxDowAvg = Math.max(0, ...byDow.map((row) => avg(row.totalEngagement, row.jumlah)));

  return (
    <div className="space-y-6">
      {/* Filter */}
      <section className="flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card p-4">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Dari tanggal</span>
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Sampai</span>
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Platform</span>
          <div className="flex flex-wrap gap-1.5">
            {CONTENT_PLATFORMS.map((platform) => (
              <button
                key={platform}
                onClick={() => togglePlatform(platform)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  platforms.includes(platform)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {label(platform)}
              </button>
            ))}
          </div>
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} konten dalam filter
        </span>
      </section>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat data performa…</p>
      ) : filtered.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Belum ada performa tercatat pada rentang ini. Catat performa lewat tab Catatan.
          </p>
        </section>
      ) : (
        <>
          {/* Insight otomatis */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {insights.map((insight) => (
              <section
                key={insight.text}
                className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <insight.icon className="size-4" />
                </span>
                <p className="text-sm text-foreground">{insight.text}</p>
              </section>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Performa per Format */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">Performa per Format</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byFormat.map((row) => ({ ...row, er: erOf(row) }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip
                      formatter={(value: number) => [formatPercentID(value), "Engagement rate"]}
                    />
                    <Bar dataKey="er" radius={[6, 6, 0, 0]} className="fill-primary" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-2">Format</th>
                      <th className="py-2 pr-2">Konten</th>
                      <th className="py-2 pr-2">Rata jangkauan</th>
                      <th className="py-2 pr-2">Rata interaksi</th>
                      <th className="py-2 pr-2">Rata simpanan</th>
                      <th className="py-2">Engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byFormat.map((row) => (
                      <tr key={row.key} className="border-t border-border">
                        <td className="py-2 pr-2 font-medium text-foreground">{row.key}</td>
                        <td className="py-2 pr-2">{formatNumberID(row.jumlah)}</td>
                        <td className="py-2 pr-2">{formatNumberID(avg(row.totalReach, row.jumlah))}</td>
                        <td className="py-2 pr-2">
                          {formatNumberID(avg(row.totalEngagement, row.jumlah))}
                        </td>
                        <td className="py-2 pr-2">{formatNumberID(avg(row.totalSaves, row.jumlah))}</td>
                        <td className="py-2">{formatPercentID(erOf(row))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Performa per Pilar */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">Performa per Pilar Strategis</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Pilar kerangka konten mana yang paling perform.
              </p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byPillar.map((row) => ({ ...row, er: erOf(row) }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip
                      formatter={(value: number) => [formatPercentID(value), "Engagement rate"]}
                    />
                    <Bar dataKey="er" radius={[6, 6, 0, 0]}>
                      {byPillar.map((row) => (
                        <Cell key={row.key} fill={row.color ?? "hsl(var(--primary))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Performa per Hari */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">Performa per Hari</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Rata-rata interaksi per hari posting (Senin–Minggu).
              </p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={byDow.map((row) => ({
                      hari: row.hari,
                      interaksi: Math.round(avg(row.totalEngagement, row.jumlah)),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="hari" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [formatNumberID(value), "Rata interaksi"]} />
                    <Bar dataKey="interaksi" radius={[6, 6, 0, 0]}>
                      {byDow.map((row) => (
                        <Cell
                          key={row.hari}
                          className={
                            avg(row.totalEngagement, row.jumlah) === maxDowAvg
                              ? "fill-primary"
                              : "fill-primary/40"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Tren Bulanan */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <TrendingUp className="size-4" /> Tren Bulanan
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Jawaban atas pertanyaan: kita berkembang atau stagnan?
              </p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => formatNumberID(value)} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="rataJangkauan"
                      name="Rata jangkauan"
                      strokeWidth={2}
                      className="stroke-primary"
                      stroke="hsl(var(--primary))"
                    />
                    <Line
                      type="monotone"
                      dataKey="rataInteraksi"
                      name="Rata interaksi"
                      strokeWidth={2}
                      stroke="hsl(var(--chart-2, 160 60% 45%))"
                    />
                    <Line
                      type="monotone"
                      dataKey="followerBaru"
                      name="Follower baru"
                      strokeWidth={2}
                      stroke="hsl(var(--chart-3, 30 80% 55%))"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* Konten Terbaik */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 p-5 pb-3">
              <Sparkles className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Konten Terbaik — pelajari dan tiru polanya
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Judul</th>
                    <th className="px-4 py-3">Platform</th>
                    <th className="px-4 py-3">Format</th>
                    <th className="px-4 py-3">Pilar</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Jangkauan</th>
                    <th className="px-4 py-3">Interaksi</th>
                    <th className="px-4 py-3">Simpanan</th>
                    <th className="px-4 py-3">Engagement</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {top.map((record) => (
                    <tr key={record.id} className="border-t border-border">
                      <td className="max-w-56 truncate px-4 py-3 font-medium text-foreground">
                        {recordTitle(record)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{label(record.platform)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{label(record.format)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {record.framework_pillars?.name ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateID(record.posted_date)}
                      </td>
                      <td className="px-4 py-3">{formatNumberID(record.reach)}</td>
                      <td className="px-4 py-3">{formatNumberID(record.engagement_total)}</td>
                      <td className="px-4 py-3">{formatNumberID(record.saves)}</td>
                      <td className="px-4 py-3">
                        {formatPercentID(engagementRate(record.engagement_total, record.reach))}
                      </td>
                      <td className="px-4 py-3">
                        {record.post_url ? (
                          <a
                            href={record.post_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Buka <ExternalLink className="size-3" />
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/* ================= TAB 2: CATATAN ================= */

function CatatanTab({
  records,
  isLoading,
  pending,
  pillars,
  canRecord,
  onNew,
  onEdit,
  onArchive,
}: {
  records: PerformanceRecord[];
  isLoading: boolean;
  pending: PendingPerformance[];
  pillars: Array<{ id: string; name: string }>;
  canRecord: boolean;
  onNew: (pendingItem?: PendingPerformance) => void;
  onEdit: (record: PerformanceRecord) => void;
  onArchive: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState(NONE);
  const [formatFilter, setFormatFilter] = useState(NONE);
  const [pillarFilter, setPillarFilter] = useState(NONE);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      if (term && !recordTitle(record).toLowerCase().includes(term)) return false;
      if (platformFilter !== NONE && record.platform !== platformFilter) return false;
      if (formatFilter !== NONE && record.format !== formatFilter) return false;
      if (pillarFilter !== NONE && record.framework_pillar_id !== pillarFilter) return false;
      return true;
    });
  }, [records, search, platformFilter, formatFilter, pillarFilter]);

  return (
    <div className="space-y-6">
      {/* Konten menunggu dicatat */}
      {pending.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
            <AlertTriangle className="size-4" /> Konten ini sudah tayang tapi performanya belum
            dicatat:
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {pending.map((item) => (
              <li
                key={`${item.content_plan_id}-${item.title}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200/70 bg-card px-3 py-2 dark:border-amber-900"
              >
                <span className="text-sm text-foreground">
                  {item.title ?? "Tanpa judul"}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {label(item.platform)} · tayang {formatDateID(item.published_at)}
                  </span>
                </span>
                {canRecord ? (
                  <Button size="sm" variant="secondary" onClick={() => onNew(item)}>
                    Catat Performa
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Semua konten tayang sudah dicatat. Bagus!
          </p>
        </section>
      )}

      {/* Daftar tercatat */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 p-5 pb-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari judul konten…"
            className="max-w-xs"
          />
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Semua platform</SelectItem>
              {CONTENT_PLATFORMS.map((platform) => (
                <SelectItem key={platform} value={platform}>
                  {label(platform)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={formatFilter} onValueChange={setFormatFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Semua format</SelectItem>
              {CONTENT_FORMATS.map((format) => (
                <SelectItem key={format} value={format}>
                  {label(format)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={pillarFilter} onValueChange={setPillarFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Pilar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Semua pilar</SelectItem>
              {pillars.map((pillar) => (
                <SelectItem key={pillar.id} value={pillar.id}>
                  {pillar.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Memuat catatan…</p>
        ) : filtered.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            {records.length === 0 ? "Belum ada catatan performa." : "Tidak ada yang cocok dengan filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Judul</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Format</th>
                  <th className="px-4 py-3">Pilar</th>
                  <th className="px-4 py-3">Jangkauan</th>
                  <th className="px-4 py-3">Interaksi</th>
                  <th className="px-4 py-3">Simpanan</th>
                  <th className="px-4 py-3">Engagement</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => (
                  <tr key={record.id} className="border-t border-border">
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateID(record.posted_date)}
                    </td>
                    <td className="max-w-56 truncate px-4 py-3 font-medium text-foreground">
                      {recordTitle(record)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{label(record.platform)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{label(record.format)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {record.framework_pillars?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3">{formatNumberID(record.reach)}</td>
                    <td className="px-4 py-3">{formatNumberID(record.engagement_total)}</td>
                    <td className="px-4 py-3">{formatNumberID(record.saves)}</td>
                    <td className="px-4 py-3">
                      {formatPercentID(engagementRate(record.engagement_total, record.reach))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canRecord ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label="Aksi">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(record)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onArchive(record.id)}>
                              Arsipkan
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
