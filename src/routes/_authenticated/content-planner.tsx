import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Repeat, TrendingDown, TrendingUp } from "lucide-react";
import { useMyProfile } from "@/hooks/useProfile";
import {
  balanceStatus,
  canManageFrameworks,
  fetchActiveFramework,
  fetchAllFrameworkPillars,
  fetchContentBalance,
  type ContentBalanceRow,
} from "@/lib/frameworks";
import { FrameworkPickerDialog } from "@/components/marketing/FrameworkPickerDialog";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_authenticated/content-planner")({
  head: () => ({
    meta: [
      { title: "Content Planner — OrgTool" },
      {
        name: "description",
        content:
          "Kerangka strategis konten organisasi dan pemantauan keseimbangan porsi konten per pilar.",
      },
      { property: "og:title", content: "Content Planner — OrgTool" },
      {
        property: "og:description",
        content: "Kerangka strategis konten dan keseimbangan porsi konten per pilar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContentPlannerPage,
});

function StatusPill({ row }: { row: ContentBalanceRow }) {
  const { status, diff } = balanceStatus(row);
  if (status === "seimbang")
    return (
      <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        <CheckCircle2 className="size-3" /> Seimbang
      </span>
    );
  if (status === "kurang")
    return (
      <span className="flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
        <TrendingDown className="size-3" /> Kurang {Math.abs(diff)}%
      </span>
    );
  return (
    <span className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
      <TrendingUp className="size-3" /> Lebih {Math.abs(diff)}%
    </span>
  );
}

function ContentPlannerPage() {
  const { data: profile } = useMyProfile();
  const canManage = canManageFrameworks(profile?.role);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: active } = useQuery({
    queryKey: ["active-framework"],
    queryFn: fetchActiveFramework,
  });
  const { data: allPillars = [] } = useQuery({
    queryKey: ["framework-pillars"],
    queryFn: fetchAllFrameworkPillars,
  });
  const { data: balance = [] } = useQuery({
    queryKey: ["content-balance"],
    queryFn: fetchContentBalance,
  });

  const pillars = allPillars.filter((p) => p.framework_id === active?.id);
  const totalKonten = balance.reduce((s, r) => s + (r.jumlah_aktual ?? 0), 0);

  const kurang = balance
    .map((r) => ({ r, s: balanceStatus(r) }))
    .filter((x) => x.s.status === "kurang")
    .sort((a, b) => a.s.diff - b.s.diff);
  const lebih = balance
    .map((r) => ({ r, s: balanceStatus(r) }))
    .filter((x) => x.s.status === "lebih")
    .sort((a, b) => b.s.diff - a.s.diff);

  const examplesOf = (pillarId?: string | null) =>
    pillars.find((p) => p.id === pillarId)?.examples ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Content Planner</h1>
        <p className="text-sm text-muted-foreground">
          Lapisan strategis di atas kalender konten: kerangka apa yang dipakai dan apakah porsi
          konten sudah seimbang.
        </p>
      </div>

      {/* Bagian 1: Kerangka aktif */}
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold">{active?.name ?? "Belum ada kerangka aktif"}</span>
              {active?.origin && (
                <span className="rounded-full border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {active.origin}
                </span>
              )}
            </p>
            {active?.description && (
              <p className="max-w-2xl text-sm text-muted-foreground">{active.description}</p>
            )}
          </div>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Repeat className="size-4" /> Ganti Kerangka
            </Button>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p) => (
            <div
              key={p.id}
              className="space-y-1.5 rounded-xl border bg-background p-4"
              style={{ borderLeft: `4px solid ${p.color_hex ?? "hsl(var(--border))"}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{p.name}</p>
                <span
                  className="rounded-lg px-2 py-1 text-sm font-bold text-white"
                  style={{ backgroundColor: p.color_hex ?? "hsl(var(--primary))" }}
                >
                  {p.ideal_percentage ?? 0}%
                </span>
              </div>
              {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
              {p.examples && <p className="text-[11px] text-muted-foreground/80">{p.examples}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Bagian 2: Keseimbangan konten */}
      <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">Keseimbangan Konten</h2>
          <p className="text-xs text-muted-foreground">
            Dihitung dari konten 30 hari ke belakang sampai 30 hari ke depan yang sudah ditandai
            pilar strategis.
          </p>
        </div>

        {balance.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada pilar pada kerangka aktif untuk dibandingkan.
          </p>
        ) : (
          <div className="space-y-4">
            {balance.map((r) => {
              const color = r.color_hex ?? "#94a3b8";
              return (
                <div key={r.pillar_id} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{r.pilar}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Target {r.target_persen ?? 0}% · Aktual {r.aktual_persen ?? 0}% (
                        {r.jumlah_aktual ?? 0} konten)
                      </span>
                      <StatusPill row={r} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-[10px] text-muted-foreground">Target</span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, r.target_persen ?? 0)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-[10px] text-muted-foreground">Aktual</span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, r.aktual_persen ?? 0)}%`,
                            backgroundColor: color,
                            opacity: 0.45,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Insight otomatis */}
        <div className="space-y-2 rounded-xl border bg-muted/40 p-4 text-sm">
          {totalKonten === 0 ? (
            <p>
              Belum ada konten yang ditandai pilar strategis. Tandai konten di Kalender Konten
              supaya keseimbangan bisa dihitung.
            </p>
          ) : (
            <>
              {kurang.map(({ r, s }) => (
                <p key={`k-${r.pillar_id}`}>
                  Kamu kurang konten <b>{r.pilar}</b>. Kerangka menyarankan {r.target_persen ?? 0}%,
                  sekarang baru {r.aktual_persen ?? 0}% (kurang {Math.abs(s.diff)}%).
                  {examplesOf(r.pillar_id) ? ` Pertimbangkan tambah: ${examplesOf(r.pillar_id)}` : ""}
                </p>
              ))}
              {lebih.map(({ r }) => (
                <p key={`l-${r.pillar_id}`}>
                  Konten <b>{r.pilar}</b> berlebih dibanding kerangka. Ini nggak salah, tapi sadari
                  porsinya.
                </p>
              ))}
              {kurang.length === 0 && lebih.length === 0 && (
                <p>
                  Distribusi konten kamu selaras dengan kerangka <b>{active?.name ?? "-"}</b>.
                  Pertahankan.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* Bagian 3: Panduan */}
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">Panduan Penggunaan Kerangka</h2>
        <Accordion type="single" collapsible>
          <AccordionItem value="apa">
            <AccordionTrigger>Apa itu kerangka konten?</AccordionTrigger>
            <AccordionContent>
              Kerangka konten adalah pola pembagian jenis konten yang kamu produksi. Tiap pilar
              punya peran berbeda — ada yang menarik perhatian baru, ada yang merawat audiens
              lama. Porsi ideal tiap pilar jadi patokan supaya konten tidak menumpuk di satu jenis
              saja.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="kapan">
            <AccordionTrigger>Kapan ganti kerangka?</AccordionTrigger>
            <AccordionContent>
              Jangan sering ganti. Idealnya satu periode kepengurusan memakai satu kerangka supaya
              hasilnya bisa dibandingkan dan tim terbiasa dengan istilahnya.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="harian">
            <AccordionTrigger>Bagaimana cara pakai sehari-hari?</AccordionTrigger>
            <AccordionContent>
              Setiap membuat konten di Kalender Konten, tandai konten itu masuk pilar strategis
              mana. Cek halaman ini setiap dua minggu untuk melihat apakah porsinya masih seimbang.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Bagian 5: Tautan kalender */}
      <Button asChild size="lg" className="w-full">
        <Link to="/content-calendar">
          <CalendarDays className="size-5" /> Buka Kalender Konten
        </Link>
      </Button>

      <FrameworkPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} />
    </div>
  );
}
