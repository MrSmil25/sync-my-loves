import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, MoreHorizontal, Plus, Search } from "lucide-react";
import { useMyProfile } from "@/hooks/useProfile";
import { formatDateID } from "@/lib/format";
import {
  LETTER_TEMPLATES,
  canReviewLetters,
  canSeeAllLetters,
  fetchAllLetters,
  fetchMyLetters,
  fetchPendingLetters,
  statusBadgeClass,
  statusLabel,
  templateBadgeClass,
  templateLabel,
  type Letter,
} from "@/lib/letters";
import { LetterDetailDialog } from "@/components/letters/LetterDetailDialog";
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

type Tab = "mine" | "review" | "all";
const ALL = "__all__";

export const Route = createFileRoute("/_authenticated/letters/")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab; highlight?: string } => {
    const tab = search["tab"];
    const highlight = search["highlight"];
    return {
      tab: tab === "review" || tab === "all" ? tab : "mine",
      ...(typeof highlight === "string" ? { highlight } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Daftar Surat — OrgTool" },
      {
        name: "description",
        content: "Daftar permintaan surat organisasi beserta status review dan nomor surat resmi.",
      },
      { property: "og:title", content: "Daftar Surat — OrgTool" },
      {
        property: "og:description",
        content: "Pantau permintaan surat, review Sekretaris, dan nomor surat yang sudah terbit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LettersPage,
});

function LettersPage() {
  const { tab, highlight } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: profile } = useMyProfile();
  const role = profile?.role ?? null;
  const isReviewer = canReviewLetters(role);
  const seeAll = canSeeAllLetters(role);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [templateFilter, setTemplateFilter] = useState<string>(ALL);
  const [selected, setSelected] = useState<Letter | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const activeTab: Tab = tab === "review" && !isReviewer ? "mine" : tab === "all" && !seeAll ? "mine" : tab;

  const { data: letters = [], isLoading } = useQuery({
    queryKey: ["letters", activeTab, profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      if (activeTab === "review") return fetchPendingLetters();
      if (activeTab === "all") return fetchAllLetters();
      return fetchMyLetters(profile!.id);
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return letters.filter((l) => {
      if (statusFilter !== ALL && l.approval_status !== statusFilter) return false;
      if (templateFilter !== ALL && l.template_type !== templateFilter) return false;
      if (!term) return true;
      return (
        (l.purpose ?? "").toLowerCase().includes(term) ||
        (l.recipient_name ?? "").toLowerCase().includes(term)
      );
    });
  }, [letters, search, statusFilter, templateFilter]);

  const tabs: Array<{ key: Tab; label: string; show: boolean }> = [
    { key: "mine", label: "Milik Saya", show: true },
    { key: "review", label: "Perlu Direview", show: isReviewer },
    { key: "all", label: "Semua", show: seeAll },
  ];

  function openDetail(letter: Letter) {
    setSelected(letter);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daftar Surat</h1>
          <p className="text-sm text-muted-foreground">
            Pantau permintaan surat dan nomor surat yang sudah terbit.
          </p>
        </div>
        <Button asChild>
          <Link to="/letters/request">
            <Plus className="mr-2 size-4" /> Request Surat
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => navigate({ search: { tab: t.key } })}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-accent"
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari perihal atau penerima…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Semua status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua status</SelectItem>
            {(["Draft", "Pending_Review", "Approved", "Rejected"] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={templateFilter} onValueChange={setTemplateFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Semua template" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua template</SelectItem>
            {LETTER_TEMPLATES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Nomor Surat</th>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Perihal</th>
              <th className="px-4 py-3">Penerima</th>
              <th className="px-4 py-3">Requester</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Memuat data…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 size-6" />
                  Belum ada surat di tab ini.
                </td>
              </tr>
            ) : (
              rows.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => openDetail(l)}
                  className={`cursor-pointer border-t transition-colors hover:bg-accent/50 ${
                    highlight === l.id ? "bg-emerald-50" : ""
                  }`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateID(l.created_at)}</td>
                  <td className="px-4 py-3 font-medium">{l.letter_number ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${templateBadgeClass(l.template_type)}`}
                    >
                      {templateLabel(l.template_type)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(l.purpose ?? "").length > 60 ? `${l.purpose.slice(0, 60)}…` : l.purpose}
                  </td>
                  <td className="px-4 py-3">
                    <p>{l.recipient_name ?? "—"}</p>
                    {l.recipient_organization ? (
                      <p className="text-xs text-muted-foreground">{l.recipient_organization}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <p>{l.requester?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.requester?.division ?? l.requester_division ?? ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${statusBadgeClass(l.approval_status)}`}
                    >
                      {statusLabel(l.approval_status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDetail(l)}>Lihat Detail</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <LetterDetailDialog
        letter={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        currentUser={profile ? { id: profile.id, role } : null}
      />
    </div>
  );
}
