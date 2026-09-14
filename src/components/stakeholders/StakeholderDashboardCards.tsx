import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Snowflake, Sparkles, UserX } from "lucide-react";
import { isBPH, useMyProfile } from "@/hooks/useProfile";
import { countIndividualsWithoutPic, countStakeholdersAddedSince } from "@/lib/stakeholders";
import { countFollowupsToday, countGoingCold } from "@/lib/interactions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Kartu dorongan positif pemetaan pemangku kepentingan (tambahan, bukan pengganti). */
export function StakeholderDashboardCards() {
  const { data: profile } = useMyProfile();
  const { data: addedWeek = 0 } = useQuery({
    queryKey: ["stakeholders", "added-week"],
    queryFn: () => countStakeholdersAddedSince(7),
  });
  const { data: noPic = 0 } = useQuery({
    queryKey: ["individuals", "no-pic"],
    queryFn: countIndividualsWithoutPic,
    enabled: !!profile && isBPH(profile.role),
  });
  const { data: followupsToday = 0 } = useQuery({
    queryKey: ["followups", "today-count"],
    queryFn: countFollowupsToday,
  });
  const { data: coldCount = 0 } = useQuery({
    queryKey: ["going-cold", "count"],
    queryFn: countGoingCold,
    enabled: !!profile && isBPH(profile.role),
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {followupsToday > 0 && (
        <Link to="/stakeholders/dashboard" className="block">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Follow-up Hari Ini</CardTitle>
              <CalendarClock className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{followupsToday}</div>
              <p className="text-xs text-muted-foreground">Janji tindak lanjut yang jatuh tempo hari ini.</p>
            </CardContent>
          </Card>
        </Link>
      )}
      {profile && isBPH(profile.role) && coldCount > 0 && (
        <Link to="/stakeholders/dashboard" className="block">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pemangku Dingin Butuh Perhatian</CardTitle>
              <Snowflake className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{coldCount}</div>
              <p className="text-xs text-muted-foreground">Sudah lama tidak dihubungi — coba sapa lagi.</p>
            </CardContent>
          </Card>
        </Link>
      )}
      <Link to="/stakeholders" className="block">
        <Card className="h-full transition-colors hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pemangku Kepentingan Minggu Ini</CardTitle>
            <Sparkles className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{addedWeek}</div>
            <p className="text-xs text-muted-foreground">Ditambahkan 7 hari terakhir — terus update peta!</p>
          </CardContent>
        </Card>
      </Link>
      {profile && isBPH(profile.role) && (
        <Link to="/stakeholders/individuals" className="block">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pemangku Tanpa PIC</CardTitle>
              <UserX className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{noPic}</div>
              <p className="text-xs text-muted-foreground">Individual yang belum punya penanggung jawab.</p>
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}
