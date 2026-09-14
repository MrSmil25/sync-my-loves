import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { useMyProfile } from "@/hooks/useProfile";
import { canRecordPerformance, fetchPendingPerformance } from "@/lib/content-performance";

export function PerformanceReminderCard() {
  const { data: profile } = useMyProfile();
  const canRecord = canRecordPerformance(profile?.role, profile?.division);
  const { data: pending = [] } = useQuery({
    queryKey: ["content-needs-performance"],
    queryFn: fetchPendingPerformance,
    enabled: canRecord,
  });

  if (!canRecord || pending.length === 0) return null;

  return (
    <Link
      to="/content-performance"
      search={{ tab: "catatan" }}
      className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm transition-colors hover:bg-amber-100"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
        <BarChart3 className="size-5" />
      </span>
      <div>
        <p className="font-semibold">Konten belum dicatat performanya: {pending.length}</p>
        <p className="text-xs text-amber-800">Buka catatan performa untuk melengkapinya.</p>
      </div>
    </Link>
  );
}
