import { useMemo } from "react";
import type { ContentPillar, ContentPlan } from "@/lib/marketing";

/**
 * Ringkasan bulan berjalan untuk halaman Kalender Konten.
 * Murni tampilan tambahan — tidak mengubah data apa pun.
 */
export function ContentMonthSummary({
  plans,
  pillars,
  month,
  year,
  monthLabel,
}: {
  plans: ContentPlan[];
  pillars: ContentPillar[];
  month: number;
  year: number;
  monthLabel: string;
}) {
  const monthPlans = useMemo(
    () =>
      plans.filter((p) => {
        if (!p.scheduled_date) return false;
        const d = new Date(p.scheduled_date);
        return d.getMonth() === month && d.getFullYear() === year;
      }),
    [plans, month, year],
  );

  const tayang = monthPlans.filter((p) => p.status === "Tayang").length;
  const review = monthPlans.filter((p) => p.status === "Review").length;

  const perPillar = useMemo(() => {
    const rows = pillars.map((pil) => ({
      pillar: pil,
      count: monthPlans.filter((p) => p.pillar_id === pil.id).length,
    }));
    const tanpa = monthPlans.filter((p) => !p.pillar_id).length;
    return { rows, tanpa };
  }, [pillars, monthPlans]);

  const total = monthPlans.length;
  const dominan = perPillar.rows.reduce(
    (best, r) => (r.count > (best?.count ?? 0) ? r : best),
    null as null | { pillar: ContentPillar; count: number },
  );
  const timpang = !!dominan && total >= 3 && dominan.count / total > 0.6;
  const kurang = perPillar.rows
    .filter((r) => r.count === 0)
    .map((r) => r.pillar.name)
    .slice(0, 2);

  return (
    <aside className="space-y-3">
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {monthLabel}
        </p>
        <p className="mt-2 text-sm">
          <b>{total}</b> terencana · <b>{tayang}</b> tayang · <b>{review}</b> menunggu review
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Distribusi pilar
        </p>
        <div className="mt-3 space-y-2">
          {perPillar.rows.map(({ pillar, count }) => (
            <div key={pillar.id}>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block size-2.5 rounded-full border border-border"
                    style={{ backgroundColor: pillar.color_hex ?? "transparent" }}
                  />
                  {pillar.name}
                </span>
                <span className="text-muted-foreground">{count}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${total ? Math.round((count / total) * 100) : 0}%`,
                    backgroundColor: pillar.color_hex ?? "currentColor",
                  }}
                />
              </div>
            </div>
          ))}
          {perPillar.tanpa > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Tanpa pilar: {perPillar.tanpa}
            </p>
          )}
          {total === 0 && (
            <p className="text-xs text-muted-foreground">Belum ada konten bulan ini.</p>
          )}
        </div>

        {timpang && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
            {dominan!.count} dari {total} konten bulan ini pilar {dominan!.pillar.name}.
            {kurang.length > 0 ? ` Pertimbangkan tambah ${kurang.join(" / ")}.` : ""}
          </p>
        )}
      </div>
    </aside>
  );
}
