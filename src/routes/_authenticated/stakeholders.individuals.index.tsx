import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useDivisions } from "@/hooks/useProfile";
import {
  INDIVIDUAL_ROLES,
  ROLE_META,
  expertiseChips,
  fetchIndividuals,
  fetchPrimaryAffiliations,
  setIndividualArchived,
  type Individual,
} from "@/lib/stakeholders";
import { QuickAddWizard } from "@/components/stakeholders/QuickAddWizard";
import { IndividualEditDialog } from "@/components/stakeholders/IndividualEditDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/stakeholders/individuals/")({
  head: () => ({
    meta: [
      { title: "Individuals — Pemangku Kepentingan" },
      { name: "description", content: "Daftar individual penting untuk organisasi." },
    ],
  }),
  component: IndividualsPage,
});

function IndividualsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Individual | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  const { data: divisions = [] } = useDivisions();
  const { data: individuals = [] } = useQuery({
    queryKey: ["individuals", showArchived],
    queryFn: () => fetchIndividuals(showArchived),
  });
  const { data: primaryAffs = [] } = useQuery({
    queryKey: ["affiliations", "primary"],
    queryFn: fetchPrimaryAffiliations,
  });

  const primaryByIndividual = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of primaryAffs) if (a.company) map.set(a.individual_id, a.company.name);
    return map;
  }, [primaryAffs]);

  const divisionName = useMemo(() => {
    const map = new Map(divisions.map((d) => [d.code, d.name]));
    return (code: string | null) => (code ? (map.get(code) ?? code) : "—");
  }, [divisions]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      individuals.filter(
        (i) =>
          (roleFilter === "all" || i.primary_role === roleFilter) &&
          (divisionFilter === "all" || i.owner_division === divisionFilter) &&
          (!q ||
            [i.full_name, i.nickname, i.email, i.phone, i.areas_of_expertise, ...(i.tags ?? [])].some((v) =>
              v?.toLowerCase().includes(q),
            )),
      ),
    [individuals, roleFilter, divisionFilter, q],
  );

  async function toggleArchive(ind: Individual) {
    try {
      await setIndividualArchived(ind.id, !ind.is_archived);
      queryClient.invalidateQueries({ queryKey: ["individuals"] });
      toast.success(ind.is_archived ? "Dikeluarkan dari arsip." : "Diarsipkan.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah arsip.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Individuals</h1>
          <p className="text-sm text-muted-foreground">
            Orang-orang penting di sekitar organisasi.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="size-4" /> Tambah Individual
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, kontak, tag, keahlian…"
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Role</SelectItem>
            {INDIVIDUAL_ROLES.map((r) => (
              <SelectItem key={r} value={r}>{ROLE_META[r]?.label ?? r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={divisionFilter} onValueChange={setDivisionFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Divisi" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Divisi</SelectItem>
            {divisions.map((d) => (
              <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} id="show-archived" />
          <Label htmlFor="show-archived" className="cursor-pointer font-normal">Tampilkan Arsip</Label>
        </label>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Afiliasi Primer</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telepon</TableHead>
              <TableHead>Bidang Keahlian</TableHead>
              <TableHead>Owner Divisi</TableHead>
              <TableHead>Tanggal Kenal</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                  Belum ada individual. Klik <b>+ Tambah Individual</b> untuk mulai.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((i) => {
                const meta = ROLE_META[i.primary_role];
                return (
                  <TableRow
                    key={i.id}
                    className={`cursor-pointer ${i.is_archived ? "opacity-50" : ""}`}
                    onClick={() =>
                      navigate({ to: "/stakeholders/individuals/$id", params: { id: i.id } })
                    }
                  >
                    <TableCell className="font-medium">
                      {i.full_name}
                      {i.nickname && (
                        <span className="ml-1 text-xs text-muted-foreground">({i.nickname})</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={meta?.badge ?? ""}>
                        {meta?.label ?? i.primary_role}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-sm">{i.title ?? "—"}</TableCell>
                    <TableCell className="text-sm">{primaryByIndividual.get(i.id) ?? "—"}</TableCell>
                    <TableCell className="max-w-44 truncate text-sm">{i.email ?? "—"}</TableCell>
                    <TableCell className="text-sm">{i.phone ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex max-w-52 flex-wrap gap-1">
                        {expertiseChips(i.areas_of_expertise).slice(0, 3).map((e) => (
                          <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{divisionName(i.owner_division)}</TableCell>
                    <TableCell className="text-sm">
                      {i.first_met_date
                        ? format(new Date(i.first_met_date), "d MMM yyyy", { locale: localeId })
                        : "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" aria-label="Aksi">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditTarget(i)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleArchive(i)}>
                            {i.is_archived ? "Keluarkan dari Arsip" : "Arsipkan"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <QuickAddWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      {editTarget && (
        <IndividualEditDialog
          open={!!editTarget}
          onOpenChange={(v) => !v && setEditTarget(null)}
          individual={editTarget}
        />
      )}
    </div>
  );
}
