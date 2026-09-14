import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useMyProfile } from "@/hooks/useProfile";
import { canReviewLetters, countPendingLetters } from "@/lib/letters";

export function LetterReviewCard() {
  const { data: profile } = useMyProfile();
  const isReviewer = canReviewLetters(profile?.role);
  const { data: pending = 0 } = useQuery({
    queryKey: ["letters-pending-count"],
    queryFn: countPendingLetters,
    enabled: isReviewer,
  });

  if (!isReviewer || pending === 0) return null;

  return (
    <Link
      to="/letters"
      search={{ tab: "review" }}
      className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm transition-colors hover:bg-amber-100"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
        <Mail className="size-5" />
      </span>
      <div>
        <p className="font-semibold">Surat menunggu review: {pending}</p>
        <p className="text-xs text-amber-800">Buka daftar surat tab Perlu Direview.</p>
      </div>
    </Link>
  );
}
