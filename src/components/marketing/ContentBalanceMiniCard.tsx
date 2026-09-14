import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Scale } from "lucide-react";
import { fetchContentBalance, mostLackingPillar } from "@/lib/frameworks";

/** Kartu kecil dashboard: ringkasan keseimbangan konten (Kadiv KRD/BPH). */
export function ContentBalanceMiniCard() {
  const { data: rows = [] } = useQuery({
    queryKey: ["content-balance"],
    queryFn: fetchContentBalance,
  });

  if (!rows.length) return null;

  const lacking = mostLackingPillar(rows);
  const totalKonten = rows.reduce((s, r) => s + (r.jumlah_aktual ?? 0), 0);

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Keseimbangan Konten</p>
        <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
          <Scale className="size-4" />
        </span>
      </div>

      {totalKonten === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Belum ada konten yang ditandai pilar strategis.
        </p>
      ) : lacking ? (
        <p className="mt-3 text-sm">
          Paling kurang: <b>{lacking.pilar}</b>{" "}
          <span className="text-muted-foreground">
            (target {lacking.target_persen ?? 0}%, aktual {lacking.aktual_persen ?? 0}%)
          </span>
        </p>
      ) : (
        <p className="mt-3 text-sm text-emerald-700">
          Porsi konten sudah selaras dengan kerangka.
        </p>
      )}

      <div className="mt-3 flex gap-1">
        {rows.map((r) => (
          <span
            key={r.pillar_id}
            title={`${r.pilar}: ${r.aktual_persen ?? 0}%`}
            className="h-2 flex-1 rounded-full"
            style={{ backgroundColor: r.color_hex ?? "hsl(var(--border))", opacity: 0.85 }}
          />
        ))}
      </div>

      <Link to="/content-planner" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
        Lihat Content Planner →
      </Link>
    </div>
  );
}
