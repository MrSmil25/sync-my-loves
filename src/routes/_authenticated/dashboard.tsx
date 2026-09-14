import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  UserCheck,
  Building2,
  BriefcaseBusiness,
  Handshake,
  CalendarDays,
  ArrowRight,
  Bell,
  ClipboardCheck,
} from "lucide-react";
import { useDivisions, useMyProfile, useProfiles, isSupervisor } from "@/hooks/useProfile";
import { fetchDeals } from "@/lib/deals";
import { fetchDashboardFinance } from "@/lib/transactions";
import { fetchEvents, formatEventDate } from "@/lib/events";
import { formatRupiah } from "@/lib/format";
import { canManageCash, fetchMyBills, fetchPendingClaims } from "@/lib/cash";
import { SupervisorOverview } from "@/components/assignments/SupervisorOverview";
import { UrgentBanners } from "@/components/announcements/UrgentBanners";
import { WelcomeGuideCard } from "@/components/WelcomeGuideCard";
import { MarketingDashboardCards } from "@/components/marketing/MarketingDashboardCards";
import { StakeholderDashboardCards } from "@/components/stakeholders/StakeholderDashboardCards";
import { QuickShortcuts } from "@/components/resources/QuickShortcuts";
import { ContentBalanceMiniCard } from "@/components/marketing/ContentBalanceMiniCard";
import { PerformanceReminderCard } from "@/components/marketing/PerformanceReminderCard";
import { LetterReviewCard } from "@/components/letters/LetterReviewCard";
import { countContributionsThisWeek, countUnacknowledgedCoaching, isKadiv } from "@/lib/hr";
import { countUnacknowledgedWarnings, fetchWarnings } from "@/lib/warnings";
import { fetchProposals, isEligibleVoter } from "@/lib/proposals";
import { isBPH } from "@/hooks/useProfile";
import { isBPHOrSupervisor } from "@/lib/hr";
import { fetchWallets } from "@/lib/finance-summary";
import { fetchCancelRequests } from "@/lib/cancel-requests";
import { fetchHelpRequests } from "@/lib/help-requests";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickActionsGrid } from "@/components/dashboard/QuickActionsGrid";
import { ActivityTimeline, type ActivityItem } from "@/components/dashboard/ActivityTimeline";
import { AttentionCenter, type AttentionItem } from "@/components/dashboard/AttentionCenter";
import { FinancialSnapshot } from "@/components/dashboard/FinancialSnapshot";
import { useMyAssignments, useMySubmissions } from "@/hooks/useAssignments";
import { fetchUnreadCount } from "@/lib/notifications";
import { fetchOrgSettings } from "@/lib/announcements";
import teamPhoto from "@/assets/my-room-team.jpg.asset.json";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — My Room" },
      {
        name: "description",
        content: "Panorama tim, aksi penting, dan ringkasan organisasi di My Room.",
      },
      { property: "og:title", content: "Dashboard — My Room" },
      {
        property: "og:description",
        content: "Panorama tim, aksi penting, dan ringkasan organisasi di My Room.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

// StatCard, QuickActionsGrid dan ActivityTimeline: komponen presentasi murni.

function DashboardPage() {
  const [teamPhotoLoaded, setTeamPhotoLoaded] = useState(false);
  const [teamPhotoFailed, setTeamPhotoFailed] = useState(false);
  const { data: profile } = useMyProfile();
  const { data: profiles = [], isLoading } = useProfiles();
  const { data: divisions = [] } = useDivisions();
  const { data: org } = useQuery({ queryKey: ["org-settings"], queryFn: fetchOrgSettings });

  const { data: deals = [] } = useQuery({ queryKey: ["deals"], queryFn: () => fetchDeals() });
  const { data: finance } = useQuery({
    queryKey: ["dashboard-finance"],
    queryFn: fetchDashboardFinance,
  });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => fetchEvents() });

  const canSeeWealth = ["Controller", "Ketua", "Waketu", "Supervisor"].includes(
    profile?.role ?? "",
  );
  const { data: wallets } = useQuery({
    queryKey: ["fin-wallets"],
    queryFn: fetchWallets,
    enabled: canSeeWealth,
  });

  const cashManager = canManageCash(profile?.role);
  const { data: myBills = [] } = useQuery({ queryKey: ["my-bills"], queryFn: fetchMyBills });
  const { data: pendingClaims = [] } = useQuery({
    queryKey: ["cash-pending-claims"],
    queryFn: fetchPendingClaims,
    enabled: cashManager,
  });
  const unpaidBills = myBills.filter(
    (b) => b.status === "Belum_Bayar" || b.status === "Ditolak",
  ).length;

  const { data: unreadCoaching = 0 } = useQuery({
    queryKey: ["coaching-unread", profile?.id],
    queryFn: () => (profile?.id ? countUnacknowledgedCoaching(profile.id) : Promise.resolve(0)),
    enabled: !!profile?.id,
  });
  const { data: weeklyContributions = 0 } = useQuery({
    queryKey: ["contributions-week", profile?.id],
    queryFn: () => (profile?.id ? countContributionsThisWeek(profile.id) : Promise.resolve(0)),
    enabled: !!profile?.id,
  });

  const { data: unackWarnings = 0 } = useQuery({
    queryKey: ["warnings-unack", profile?.id],
    queryFn: () => (profile?.id ? countUnacknowledgedWarnings(profile.id) : Promise.resolve(0)),
    enabled: !!profile?.id,
  });

  const kadiv = isKadiv(profile?.role);
  const { data: divisionWarnings = [] } = useQuery({
    queryKey: ["warnings", "division-active", profile?.division],
    queryFn: () => fetchWarnings({ activeOnly: true }),
    enabled: kadiv && !!profile?.division,
  });
  const divisionWarningCount = divisionWarnings.filter(
    (w) => w.member?.division === profile?.division,
  ).length;

  const { data: cancelRequests = [] } = useQuery({
    queryKey: ["cancel-requests"],
    queryFn: fetchCancelRequests,
    enabled: !!profile?.id,
  });
  const { data: helpRequests = [] } = useQuery({
    queryKey: ["help-requests"],
    queryFn: fetchHelpRequests,
    enabled: !!profile?.id,
  });
  const myPendingCancels = cancelRequests.filter(
    (r) => r.status === "Pending" && r.requested_by === profile?.id,
  ).length;
  const myPendingHelp = helpRequests.filter(
    (r) => r.status === "Pending" && r.requested_by === profile?.id,
  ).length;
  const decisionsWaiting =
    cancelRequests.filter((r) => r.status === "Pending" && r.requested_by !== profile?.id).length +
    helpRequests.filter(
      (r) =>
        r.status === "Pending" &&
        r.requested_by !== profile?.id &&
        r.target_division === profile?.division,
    ).length;

  const bphOrSupervisor = isBPH(profile?.role) || isBPHOrSupervisor(profile?.role);
  const { data: proposals = [] } = useQuery({
    queryKey: ["proposals"],
    queryFn: fetchProposals,
    enabled: !!profile?.id,
  });
  const activeProposals = proposals.filter((p) => p.status === "Voting");
  const myVoteProposals = activeProposals.filter((p) =>
    isEligibleVoter(p, profile ? { id: profile.id, division: profile.division } : null),
  );
  const proposalsAboutMe = activeProposals.filter((p) => p.target_member_id === profile?.id);

  const activeEvents = events.filter((e) =>
    ["Planning", "Preparation", "Live"].includes(e.status ?? ""),
  );
  const myPicEvents = activeEvents.filter((e) => e.pic_id && e.pic_id === profile?.id);
  const upcomingEvent = [...events]
    .filter((e) => e.date_start && new Date(e.date_start).getTime() >= Date.now() - 86400000)
    .sort((a, b) => new Date(a.date_start!).getTime() - new Date(b.date_start!).getTime())[0];

  const activeDeals = deals.filter(
    (d) => d.stage !== "Deal" && d.stage !== "Rejected" && d.stage !== "Ghosted",
  ).length;
  const totalAnggota = profiles.length;
  const anggotaAktif = profiles.filter((p) => p.status === "Active").length;
  const myDivision = divisions.find((d) => d.code === profile?.division);

  const assignmentsQuery = useMyAssignments();
  const submissionsQuery = useMySubmissions();
  const {
    data: unreadNotifications,
    isLoading: unreadLoading,
    isError: unreadError,
  } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: fetchUnreadCount,
    refetchInterval: 45_000,
  });
  const submittedAssignmentIds = new Set(
    (submissionsQuery.data ?? []).map((submission) => submission.assignment_id),
  );
  const pendingAssignments = (assignmentsQuery.data ?? []).filter(
    (assignment) => !submittedAssignmentIds.has(assignment.id),
  ).length;
  const assignmentsLoading = assignmentsQuery.isLoading || submissionsQuery.isLoading;
  const assignmentsError = assignmentsQuery.isError || submissionsQuery.isError;
  const pendingAssignmentLabel = assignmentsError
    ? "Jumlah tugas belum dapat dimuat"
    : assignmentsLoading
      ? "Memuat tugas…"
      : pendingAssignments === 0
        ? "Tidak ada tugas yang perlu dilihat"
        : `${pendingAssignments} tugas perlu dilihat`;
  const greetingName =
    profile?.nickname?.trim() || profile?.full_name?.trim().split(/\s+/)[0] || null;
  const today = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const todayKey = new Date().toLocaleDateString("en-CA");
  const todayEvents = events.filter((event) => {
    const start = event.date_start?.slice(0, 10);
    const end = event.date_end?.slice(0, 10) ?? start;
    return !!start && start <= todayKey && !!end && end >= todayKey;
  });

  // Timeline dibangun dari data yang sudah dimuat di atas — tanpa query baru.
  const activityItems: ActivityItem[] = [
    ...(upcomingEvent
      ? [
          {
            id: `upcoming-${upcomingEvent.id}`,
            title: `Event berikutnya: ${upcomingEvent.name}`,
            meta: `${formatEventDate(upcomingEvent.date_start, upcomingEvent.date_end)}${
              upcomingEvent.venue ? ` — ${upcomingEvent.venue}` : ""
            }`,
            to: "/events/$id",
            params: { id: upcomingEvent.id },
          } satisfies ActivityItem,
        ]
      : []),
    ...myPicEvents.map(
      (e) =>
        ({
          id: `pic-${e.id}`,
          title: `Kamu PIC untuk ${e.name}`,
          meta: `${formatEventDate(e.date_start, e.date_end)} · ${e.status}`,
          to: "/events/$id",
          params: { id: e.id },
        }) satisfies ActivityItem,
    ),
  ];
  const attentionItems: AttentionItem[] = [
    ...(pendingAssignments > 0
      ? [
          {
            id: "mentor-tasks",
            title: `${pendingAssignments} tugas baru dari pembina`,
            detail: "Buka tugas dan tentukan langkah berikutnya.",
            to: "/mentor-tasks",
            tone: "danger" as const,
          },
        ]
      : []),
    ...(decisionsWaiting > 0
      ? [
          {
            id: "help-decisions",
            title: `${decisionsWaiting} request bantuan menunggu keputusan`,
            detail: "Tinjau permintaan dari anggota dan divisi terkait.",
            to: "/help-requests",
            tone: "info" as const,
          },
        ]
      : []),
    ...(unpaidBills > 0
      ? [
          {
            id: "unpaid-bills",
            title: `${unpaidBills} tagihan kas belum dibayar`,
            detail: "Selesaikan pembayaran kas yang masih tertunda.",
            to: "/cash",
            tone: "warning" as const,
          },
        ]
      : []),
    ...(unackWarnings > 0
      ? [
          {
            id: "warnings",
            title: `${unackWarnings} peringatan perlu dibaca`,
            detail: "Buka dan akui peringatan yang ditujukan kepadamu.",
            to: "/warnings",
            tone: "danger" as const,
          },
        ]
      : []),
    ...(myPicEvents.length > 0
      ? [
          {
            id: "pic-events",
            title: `${myPicEvents.length} event aktif menjadi tanggung jawabmu`,
            detail: "Pastikan persiapan dan kebutuhan event tetap terpantau.",
            to: "/calendar",
            tone: "success" as const,
          },
        ]
      : []),
    ...(myPendingCancels > 0
      ? [
          {
            id: "cancel-requests",
            title: `${myPendingCancels} permintaan batal tugas masih diproses`,
            detail: "Permintaanmu sedang menunggu keputusan Kadiv.",
            to: "/workspace",
            tone: "info" as const,
          },
        ]
      : []),
    ...(myPendingHelp > 0
      ? [
          {
            id: "my-help-requests",
            title: `${myPendingHelp} request bantuanmu masih diproses`,
            detail: "Permintaan sedang menunggu keputusan divisi tujuan.",
            to: "/help-requests",
            tone: "info" as const,
          },
        ]
      : []),
    ...(pendingClaims.length > 0 && cashManager
      ? [
          {
            id: "pending-claims",
            title: `${pendingClaims.length} klaim menunggu verifikasi`,
            detail: "Periksa kelengkapan klaim kas yang masuk.",
            to: "/cash",
            tone: "warning" as const,
          },
        ]
      : []),
    ...(unreadCoaching > 0
      ? [
          {
            id: "coaching",
            title: `${unreadCoaching} catatan bimbingan belum dibaca`,
            detail: "Buka catatan terbaru dari sesi bimbingan.",
            to: "/coaching",
            tone: "info" as const,
          },
        ]
      : []),
    ...(myVoteProposals.length > 0
      ? [
          {
            id: "proposal-votes",
            title: `${myVoteProposals.length} usulan menunggu suaramu`,
            detail: "Tinjau usulan peringatan yang sedang aktif.",
            to: "/warnings/proposals",
            tone: "warning" as const,
          },
        ]
      : []),
    ...(divisionWarningCount > 0 && kadiv
      ? [
          {
            id: "division-warnings",
            title: `${divisionWarningCount} SP aktif di divisimu`,
            detail: "Pantau tindak lanjut peringatan anggota divisi.",
            to: "/warnings",
            tone: "warning" as const,
          },
        ]
      : []),
  ];

  return (
    <div className="dashboard-panorama mx-auto max-w-[1600px] space-y-7">
      <section className="dashboard-panorama-hero dash-enter" aria-labelledby="dashboard-heading">
        <div className="dashboard-hero-copy">
          <p className="dashboard-hero-date">{today}</p>
          <h1 id="dashboard-heading">{greetingName ? `Halo, ${greetingName}!` : "Halo!"}</h1>
          <p className="dashboard-hero-role">
            {[profile?.role, org?.org_name ?? "My Room"].filter(Boolean).join(" · ")}
          </p>
          <div className="dashboard-hero-actions">
            <Link to="/workspace" className="dashboard-hero-primary">
              <BriefcaseBusiness className="size-5" />
              Buka Ruang Kerja Saya
            </Link>
            <Link to="/guide" className="dashboard-hero-secondary">
              Lihat Panduan <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
        <div className="dashboard-team-photo" aria-label="Foto tim My Room">
          {!teamPhotoFailed && (
            <img
              src={teamPhoto.url}
              alt="Tim My Room mengenakan jaket kuning berfoto bersama"
              width="1024"
              height="768"
              data-loaded={teamPhotoLoaded}
              onLoad={() => setTeamPhotoLoaded(true)}
              onError={() => setTeamPhotoFailed(true)}
            />
          )}
        </div>
      </section>

      <section className="dashboard-daily-summary dash-enter" aria-label="Ringkasan hari ini">
        <p>Ringkasan hari ini</p>
        <span className="dashboard-daily-item">
          <ClipboardCheck />{" "}
          {assignmentsLoading ? "Memuat tugas…" : `${pendingAssignments} tugas perlu dilihat`}
        </span>
        <span className="dashboard-daily-item">
          <CalendarDays /> {todayEvents.length} agenda hari ini
        </span>
        <Link to="/notifications" className="dashboard-daily-item">
          <Bell />{" "}
          {unreadLoading
            ? "Memuat notifikasi…"
            : unreadError
              ? "Notifikasi belum termuat"
              : `${unreadNotifications} notifikasi baru`}
        </Link>
      </section>

      <QuickActionsGrid pendingLabel={pendingAssignmentLabel} />

      <AttentionCenter items={attentionItems} />

      <ActivityTimeline items={activityItems} />

      <section
        id="ringkasan-organisasi"
        className="dashboard-section dash-enter"
        aria-labelledby="summary-heading"
      >
        <div className="dashboard-section-heading">
          <div>
            <p className="dashboard-section-kicker">ORGANIZATION PULSE</p>
            <h2 id="summary-heading">Organisasi Hari Ini</h2>
          </div>
        </div>
        <div className="dashboard-pulse-grid dash-stagger">
          <StatCard label="Total Anggota" value={isLoading ? "…" : totalAnggota} icon={Users} />
          <StatCard label="Anggota Aktif" value={isLoading ? "…" : anggotaAktif} icon={UserCheck} />
          <StatCard label="Event Berjalan" value={activeEvents.length} icon={CalendarDays} />
          <StatCard label="Deal Aktif" value={activeDeals} icon={Handshake} />
        </div>
      </section>

      <FinancialSnapshot balance={finance?.balance} monthExpense={finance?.monthExpense} />

      <section className="space-y-5 dash-enter" aria-label="Informasi organisasi lainnya">
        {proposalsAboutMe.map((proposal) => (
          <Link
            key={proposal.id}
            to="/warnings/proposals/$id"
            params={{ id: proposal.id }}
            className="dashboard-warning-banner"
          >
            Ada usulan peringatan untuk kamu. Kamu berhak menyanggah.
          </Link>
        ))}
        <UrgentBanners />
        <LetterReviewCard />
        <PerformanceReminderCard />
        {canSeeWealth && (
          <Link to="/finance-summary" className="dashboard-info-banner group">
            <span className="font-semibold">
              Total Kekayaan: {wallets ? formatRupiah(wallets.total_saldo) : "…"}
            </span>
            {wallets &&
              ` · Ops ${formatRupiah(wallets.ops_saldo)} · Kas ${formatRupiah(wallets.kas_saldo)}`}
          </Link>
        )}
        {bphOrSupervisor && activeProposals.length > 0 && (
          <Link to="/warnings/proposals" className="dashboard-info-banner">
            Usulan aktif di organisasi:{" "}
            <span className="font-semibold">{activeProposals.length}</span>
          </Link>
        )}
        {weeklyContributions > 0 && (
          <Link to="/contributions" className="dashboard-success-banner">
            Minggu ini kamu mendapat {weeklyContributions} apresiasi dari rekan. Terima kasih sudah
            hadir untuk tim.
          </Link>
        )}
        <StakeholderDashboardCards />
        <MarketingDashboardCards />
        {isSupervisor(profile?.role) && <SupervisorOverview />}
        {(isBPH(profile?.role) || (profile?.role === "Kadiv" && profile?.division === "KRD")) && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ContentBalanceMiniCard />
          </div>
        )}
        {myDivision && (
          <section className="dash-surface p-6">
            <div className="flex items-start gap-4">
              <span className="dash-icon-bubble shrink-0">
                <Building2 className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">Divisi {myDivision.name}</h2>
                <p className="mt-1 text-sm text-dash-muted">
                  {myDivision.description ?? "Belum ada deskripsi divisi."}
                </p>
              </div>
            </div>
          </section>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <WelcomeGuideCard />
          <QuickShortcuts />
        </div>
      </section>
    </div>
  );
}
