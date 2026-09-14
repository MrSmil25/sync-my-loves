import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Radar,
  HeartHandshake,
  User,
  Users,
  Boxes,
  LogOut,
  Megaphone,
  Settings,
  BriefcaseBusiness,
  TrendingUp,
  Wallet,
  ShieldCheck,
  NotebookPen,
  CalendarDays,
  PiggyBank,
  GraduationCap,
  ClipboardList,
  Building2,
  KanbanSquare,
  FileSignature,
  Receipt,
  Tags,
  Mic,
  MailPlus,
  FileText,
  FilePlus2,
  BookOpen,
  AlertTriangle,
  Vote,
  PieChart,
  LifeBuoy,
  SlidersHorizontal,
  Palette,
  Wrench,
  Compass,
  ChartNoAxesCombined,
  ChevronDown,
  Network,
  ContactRound,
} from "lucide-react";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase-external";
import { isBPH, isSupervisor, useMyProfile } from "@/hooks/useProfile";
import { usePendingAssignmentCount } from "@/hooks/useAssignments";
import { canApproveFunds } from "@/lib/fund-requests";
import { canManageCategories } from "@/lib/transactions";
import {
  canManageSections,
  fetchSectionOverrides,
  fetchSectionSettings,
  isSectionVisible,
} from "@/lib/sections";
import { UserAvatar } from "@/components/UserAvatar";
import { ProfileCompletionGate } from "@/components/ProfileCompletionGate";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WorkspaceNavigation } from "@/components/navigation/WorkspaceNavigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  component: AppLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  requires?: "categoryAdmin" | "orgAdmin" | "fundApprover" | "supervisor" | "sectionAdmin";
};

type NavSection = { key: string; label: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    key: "UTAMA",
    label: "UTAMA",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/workspace", label: "Ruang Kerja Saya", icon: BriefcaseBusiness },
      { to: "/help-requests", label: "Request Bantuan", icon: LifeBuoy },
      { to: "/calendar", label: "Kalender", icon: CalendarDays },
      { to: "/mentor-tasks", label: "Tugas dari Pembina", icon: GraduationCap },
    ],
  },
  {
    key: "KOMUNIKASI",
    label: "KOMUNIKASI",
    items: [{ to: "/announcements", label: "Pengumuman", icon: Megaphone }],
  },
  {
    key: "KEUANGAN",
    label: "KEUANGAN",
    items: [
      { to: "/finance-summary", label: "Ringkasan Keuangan", icon: PieChart },
      { to: "/fund-requests", label: "Pengajuan Dana", icon: Wallet },
      {
        to: "/fund-approvals",
        label: "Approval Dana",
        icon: ShieldCheck,
        requires: "fundApprover",
      },
      { to: "/budgets", label: "Anggaran", icon: PiggyBank },
      { to: "/transactions", label: "Feed Keuangan", icon: Receipt },
      { to: "/admin/categories", label: "Kelola Kategori", icon: Tags, requires: "categoryAdmin" },
    ],
  },
  {
    key: "KAS",
    label: "KAS",
    items: [{ to: "/cash", label: "Kas & Iuran", icon: PiggyBank }],
  },
  {
    key: "STRATEGI",
    label: "STRATEGI",
    items: [
      { to: "/command-center", label: "Command Center", icon: Radar },
      { to: "/member-progress", label: "Progres Anggota", icon: TrendingUp },
    ],
  },
  {
    key: "EKSTERNAL",
    label: "EKSTERNAL",
    items: [
      { to: "/companies", label: "Perusahaan", icon: Building2 },
      { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { to: "/mous", label: "MoU", icon: FileSignature },
    ],
  },
  {
    key: "PEMANGKU_KEPENTINGAN",
    label: "PEMANGKU KEPENTINGAN",
    items: [
      { to: "/stakeholders", label: "Peta Pemangku Kepentingan", icon: Network },
      { to: "/stakeholders/individuals", label: "Individuals", icon: ContactRound },
      { to: "/stakeholders/dashboard", label: "Dashboard Hubungan", icon: HeartHandshake },
    ],
  },
  {
    key: "MARKETING",
    label: "MARKETING",
    items: [
      { to: "/content-calendar", label: "Kalender Konten", icon: CalendarDays },
      { to: "/design-queue", label: "Antrean Desain", icon: Palette },
      { to: "/resources", label: "Alat & Aset", icon: Wrench },
      { to: "/content-planner", label: "Content Planner", icon: Compass },
      { to: "/content-performance", label: "Performa Konten", icon: ChartNoAxesCombined },
    ],
  },
  {
    key: "EVENT",
    label: "EVENT",
    items: [
      { to: "/events", label: "Events", icon: CalendarDays },
      { to: "/speakers", label: "Speaker", icon: Mic },
    ],
  },
  {
    key: "ORGANISASI",
    label: "ORGANISASI",
    items: [
      { to: "/profile", label: "Profil Saya", icon: User },
      { to: "/members", label: "Anggota", icon: Users },
      { to: "/divisions", label: "Divisi", icon: Boxes },
      { to: "/meetings", label: "Rapat", icon: NotebookPen },
      { to: "/invitations", label: "Undangan", icon: MailPlus, requires: "orgAdmin" },
      { to: "/settings/organization", label: "Pengaturan", icon: Settings, requires: "orgAdmin" },
      {
        to: "/admin/sections",
        label: "Kelola Section",
        icon: SlidersHorizontal,
        requires: "sectionAdmin",
      },
      { to: "/letters/request", label: "Request Surat", icon: FilePlus2 },
      { to: "/letters", label: "Daftar Surat", icon: FileText },
      { to: "/guide", label: "Panduan", icon: BookOpen },
    ],
  },
  {
    key: "HR_KINERJA",
    label: "HR & KINERJA",
    items: [
      { to: "/reports/member", label: "Rapor Anggota", icon: ClipboardList },
      { to: "/reports/workload", label: "Peta Beban Kerja", icon: TrendingUp },
      { to: "/reports/blockers", label: "Pelacak Penyumbat", icon: ShieldCheck },
      { to: "/reports/holdings", label: "Serah Terima", icon: Boxes },
      { to: "/coaching", label: "Catatan Bimbingan", icon: NotebookPen },
      { to: "/contributions", label: "Kontribusi", icon: Megaphone },
      { to: "/warnings", label: "Peringatan (SP)", icon: AlertTriangle },
      { to: "/warnings/proposals", label: "Usulan Peringatan", icon: Vote },
    ],
  },
  {
    key: "PEMBINA",
    label: "PEMBINA",
    items: [
      {
        to: "/mentor/assignments",
        label: "Kelola Tugas",
        icon: ClipboardList,
        requires: "supervisor",
      },
    ],
  },
];

function AppLayout() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useMyProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: sectionSettings } = useQuery({
    queryKey: ["section-settings"],
    queryFn: fetchSectionSettings,
    staleTime: 5 * 60 * 1000,
  });
  const { data: sectionOverrides } = useQuery({
    queryKey: ["section-overrides"],
    queryFn: fetchSectionOverrides,
    staleTime: 5 * 60 * 1000,
  });

  const canManageOrg = isBPH(profile?.role);
  const canApprove = canApproveFunds(profile?.role);
  const supervisor = isSupervisor(profile?.role);
  const categoryAdmin = canManageCategories(profile?.role);
  const sectionAdmin = canManageSections(profile?.role);
  const pendingAssignments = usePendingAssignmentCount();
  const profileDivision =
    (profile as { division?: string | null } | null | undefined)?.division ?? null;

  const visibleSections = useMemo(() => {
    function allowed(item: NavItem) {
      if (item.requires === "categoryAdmin") return categoryAdmin;
      if (item.requires === "orgAdmin") return canManageOrg;
      if (item.requires === "fundApprover") return canApprove;
      if (item.requires === "supervisor") return supervisor;
      if (item.requires === "sectionAdmin") return sectionAdmin;
      return true;
    }

    return navSections
      .map((section) => ({ ...section, items: section.items.filter(allowed) }))
      .filter((section) => section.items.length > 0)
      .filter((section) =>
        isSectionVisible(section.key, {
          role: profile?.role,
          division: profileDivision,
          settings: sectionSettings ?? null,
          overrides: sectionOverrides ?? null,
        }),
      );
  }, [
    profile?.role,
    profileDivision,
    sectionSettings,
    sectionOverrides,
    categoryAdmin,
    canManageOrg,
    canApprove,
    supervisor,
    sectionAdmin,
  ]);

  async function handleLogout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const workspaceSections = useMemo(
    () =>
      visibleSections.map((section) => ({
        key: section.key,
        label: section.label,
        items: section.items.map((item) => ({
          ...item,
          badge: item.to === "/mentor-tasks" ? pendingAssignments : 0,
        })),
      })),
    [visibleSections, pendingAssignments],
  );

  return (
    <div className="workspace-shell dash-atmosphere">
      <WorkspaceNavigation accountId={user.id} pathname={pathname} sections={workspaceSections} />
      <div className="workspace-content">
        <header className="workspace-header">
          <Link to="/dashboard" className="workspace-wordmark" aria-label="My Room — Dashboard">
            My Room
          </Link>
          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
            <ThemeToggle />
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-11 min-w-0 gap-2 px-1.5 sm:px-2"
                  aria-label="Buka menu akun"
                >
                  <UserAvatar
                    path={profile?.photo_url}
                    name={profile?.full_name}
                    className="size-9"
                  />
                  <span className="hidden min-w-0 text-left md:block">
                    <span className="block max-w-40 truncate text-sm font-semibold">
                      {profile?.full_name ?? "Pengguna"}
                    </span>
                    <span className="block max-w-40 truncate text-xs text-muted-foreground">
                      {profile?.role ?? "Anggota"}
                    </span>
                  </span>
                  <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <span className="block truncate">{profile?.full_name ?? "Pengguna"}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {profile?.role ?? "Anggota"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <User /> Profil saya
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => void handleLogout()}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut /> Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="workspace-main">
          <ProfileCompletionGate>
            <Outlet />
          </ProfileCompletionGate>
        </main>
      </div>
    </div>
  );
}
