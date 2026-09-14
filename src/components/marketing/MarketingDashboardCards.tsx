import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMyProfile } from "@/hooks/useProfile";
import {
  fetchContentPlans,
  fetchDesignRequests,
  isBph,
  isKrd,
  toDateKey,
} from "@/lib/marketing";

/**
 * Kartu tambahan untuk Dashboard — hanya muncul kalau relevan.
 * Tidak mengganti kartu dashboard yang sudah ada.
 */
export function MarketingDashboardCards() {
  const { data: profile } = useMyProfile();
  const division = (profile as { division?: string | null } | undefined)?.division ?? null;

  const { data: requests = [] } = useQuery({
    queryKey: ["design-requests", false],
    queryFn: () => fetchDesignRequests(false),
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["content-plans", false],
    queryFn: () => fetchContentPlans(false),
  });

  const krd = isKrd(division);

  const menungguDiambil = requests.filter((r) => r.status === "Baru" && !r.designer_id).length;
  const milikkuDikerjakan = requests.filter(
    (r) => r.designer_id === profile?.id && ["Diambil", "Dikerjakan", "Revisi"].includes(r.status),
  ).length;

  const menungguPersetujuan = useMemo(
    () =>
      plans.filter(
        (p) =>
          p.status === "Review" &&
          (isBph(profile?.role) ||
            (profile?.role === "Kadiv" && !!division && p.owner_division === division)),
      ).length,
    [plans, profile?.role, division],
  );

  const besokKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toDateKey(d);
  }, []);
  const belumSiap = plans.filter(
    (p) =>
      p.copywriter_id === profile?.id &&
      p.scheduled_date?.slice(0, 10) === besokKey &&
      ["Ide", "Draf", "Perlu_Desain", "Review"].includes(p.status),
  );

  if (!krd && menungguPersetujuan === 0 && belumSiap.length === 0) return null;

  return (
    <div className="space-y-3">
      {krd && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/design-queue"
            className="block rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:bg-accent/40"
          >
            Permintaan desain menunggu diambil:{" "}
            <span className="font-semibold">{menungguDiambil}</span>
          </Link>
          <Link
            to="/design-queue"
            className="block rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:bg-accent/40"
          >
            Milik kamu sedang dikerjakan:{" "}
            <span className="font-semibold">{milikkuDikerjakan}</span>
          </Link>
        </div>
      )}

      {menungguPersetujuan > 0 && (
        <Link
          to="/content-calendar"
          className="block rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:bg-accent/40"
        >
          <span className="font-semibold">{menungguPersetujuan}</span> konten menunggu persetujuan
          kamu.
        </Link>
      )}

      {belumSiap.length > 0 && (
        <Link
          to="/content-calendar"
          className="block rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900 shadow-sm transition-colors hover:bg-red-100"
        >
          {belumSiap.length} konten kamu tayang besok tapi belum disetujui. Segera kirim untuk
          review.
        </Link>
      )}
    </div>
  );
}
