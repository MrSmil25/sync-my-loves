import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Plus, Search } from "lucide-react";
import {
  CATEGORY_META,
  INDIVIDUAL_ROLES,
  ROLE_META,
  STAKEHOLDER_CATEGORIES,
  avatarColor,
  expertiseChips,
  fetchIndividuals,
  fetchPrimaryAffiliations,
  fetchStakeholderCompanies,
  nameInitials,
} from "@/lib/stakeholders";
import { QuickAddWizard } from "@/components/stakeholders/QuickAddWizard";
import {
  LEVEL_META,
  RELATIONSHIP_LEVELS,
  fetchAllCompanyStatuses,
  fetchAllIndividualStatuses,
} from "@/lib/interactions";
import { RelationshipBadge } from "@/components/stakeholders/RelationshipBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/stakeholders/")({
  validateSearch: (search: Record<string, unknown>): { level?: string | undefined; cat?: string | undefined } => ({
    level: typeof search["level"] === "string" ? (search["level"] as string) : undefined,
    cat: typeof search["cat"] === "string" ? (search["cat"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Peta Pemangku Kepentingan" },
      { name: "description", content: "Semua pihak yang penting untuk organisasi kita, di satu tempat." },
    ],
  }),
  component: StakeholdersPage,
});

type KindFilter = "all" | "company" | "individual";

function StakeholdersPage() {
  const { level: levelParam, cat: catParam } = Route.useSearch();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [kind, setKind] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string[]>(catParam ? [catParam] : []);
  const [roleFilter, setRoleFilter] = useState<string[]>(catParam ? [catParam] : []);
  const [levelFilter, setLevelFilter] = useState<string[]>(levelParam ? [levelParam] : []);

  const { data: companyStatuses } = useQuery({
    queryKey: ["relationship-statuses", "companies"],
    queryFn: fetchAllCompanyStatuses,
  });
  const { data: individualStatuses } = useQuery({
    queryKey: ["relationship-statuses", "individuals"],
    queryFn: fetchAllIndividualStatuses,
  });


  const { data: companies = [] } = useQuery({
    queryKey: ["stakeholders", "companies"],
    queryFn: fetchStakeholderCompanies,
  });
  const { data: individuals = [] } = useQuery({
    queryKey: ["individuals"],
    queryFn: () => fetchIndividuals(false),
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

  const q = search.trim().toLowerCase();
  const matchLevel = (lvl: string | null | undefined) =>
    levelFilter.length === 0 || (lvl != null && levelFilter.includes(lvl));

  const filteredCompanies = useMemo(
    () =>
      companies.filter(
        (c) =>
          (kind !== "individual") &&
          (catFilter.length === 0 || (c.stakeholder_category && catFilter.includes(c.stakeholder_category))) &&
          matchLevel(companyStatuses?.get(c.id)?.relationship_level) &&
          (!q || [c.name, c.city, c.industry].some((v) => v?.toLowerCase().includes(q))),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companies, kind, catFilter, q, levelFilter, companyStatuses],
  );
  const filteredIndividuals = useMemo(
    () =>
      individuals.filter(
        (i) =>
          kind !== "company" &&
          (roleFilter.length === 0 || roleFilter.includes(i.primary_role)) &&
          matchLevel(individualStatuses?.get(i.id)?.relationship_level) &&
          (!q ||
            [i.full_name, i.nickname, i.email, i.phone, i.areas_of_expertise, ...(i.tags ?? [])].some((v) =>
              v?.toLowerCase().includes(q),
            )),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [individuals, kind, roleFilter, q, levelFilter, individualStatuses],
  );

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of RELATIONSHIP_LEVELS) counts[l] = 0;
    for (const c of companies) {
      const l = companyStatuses?.get(c.id)?.relationship_level;
      if (l) counts[l] = (counts[l] ?? 0) + 1;
    }
    for (const i of individuals) {
      const l = individualStatuses?.get(i.id)?.relationship_level;
      if (l) counts[l] = (counts[l] ?? 0) + 1;
    }
    return counts;
  }, [companies, individuals, companyStatuses, individualStatuses]);
  const levelTotal = RELATIONSHIP_LEVELS.reduce((s, l) => s + (levelCounts[l] ?? 0), 0);

  const total = filteredCompanies.length + filteredIndividuals.length;
  const addedThisMonth = useMemo(() => {
    const since = Date.now() - 30 * 86400000;
    return (
      companies.filter((c) => new Date(c.created_at).getTime() >= since).length +
      individuals.filter((i) => new Date(i.created_at).getTime() >= since).length
    );
  }, [companies, individuals]);

  const breakdown = useMemo(() => {
    const parts: string[] = [];
    for (const c of STAKEHOLDER_CATEGORIES) {
      const n = companies.filter((x) => x.stakeholder_category === c).length;
      if (n) parts.push(`${n} ${CATEGORY_META[c]?.label ?? c}`);
    }
    for (const r of INDIVIDUAL_ROLES) {
      const n = individuals.filter((x) => x.primary_role === r).length;
      if (n) parts.push(`${n} ${ROLE_META[r]?.label ?? r}`);
    }
    return parts;
  }, [companies, individuals]);

  function toggle(list: string[], v: string, setter: (x: string[]) => void) {
    setter(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Peta Pemangku Kepentingan</h1>
          <p className="text-sm text-muted-foreground">
            Semua pihak yang penting untuk organisasi kita, di satu tempat.
          </p>
        </div>
        <Button size="lg" onClick={() => setWizardOpen(true)}>
          <Plus className="size-4" /> Tambah Cepat
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Pemangku</p>
            <p className="text-3xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Rincian kategori</p>
            <p className="mt-1 text-sm font-medium">
              {breakdown.length ? breakdown.join(" · ") : "Belum ada data"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Ditambahkan bulan ini: <span className="font-semibold text-foreground">{addedThisMonth}</span>
            </p>
            <p className="mt-3 text-sm">
              {RELATIONSHIP_LEVELS.map((l, idx) => (
                <span key={l}>
                  {idx > 0 && <span className="text-muted-foreground"> · </span>}
                  <span className="text-muted-foreground">{LEVEL_META[l]?.label ?? l}: </span>
                  <span className="font-semibold">{levelCounts[l] ?? 0}</span>
                </span>
              ))}
            </p>
            {levelTotal > 0 && (
              <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                {RELATIONSHIP_LEVELS.map((l) =>
                  (levelCounts[l] ?? 0) > 0 ? (
                    <div
                      key={l}
                      className={LEVEL_META[l]?.bar ?? "bg-muted"}
                      style={{ width: `${((levelCounts[l] ?? 0) / levelTotal) * 100}%` }}
                      title={`${LEVEL_META[l]?.label ?? l}: ${levelCounts[l]}`}
                    />
                  ) : null,
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border p-0.5 text-sm">
          {(
            [
              ["all", "Semua"],
              ["company", "Perusahaan/Institusi"],
              ["individual", "Individual"],
            ] as [KindFilter, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setKind(v)}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                kind === v ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, email, telepon, tag, keahlian…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Tingkat hubungan:</span>
        {RELATIONSHIP_LEVELS.map((l) => (
          <button key={l} type="button" onClick={() => toggle(levelFilter, l, setLevelFilter)}>
            <Badge
              variant="outline"
              className={`cursor-pointer ${LEVEL_META[l]?.badge ?? ""} ${
                levelFilter.includes(l) ? "ring-2 ring-primary" : "opacity-60"
              }`}
            >
              {LEVEL_META[l]?.label ?? l}
            </Badge>
          </button>
        ))}
      </div>

      {kind !== "individual" && (
        <div className="flex flex-wrap gap-1.5">
          {STAKEHOLDER_CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => toggle(catFilter, c, setCatFilter)}>
              <Badge
                variant="outline"
                className={`cursor-pointer ${CATEGORY_META[c]?.badge ?? ""} ${
                  catFilter.includes(c) ? "ring-2 ring-primary" : "opacity-60"
                }`}
              >
                {CATEGORY_META[c]?.label ?? c}
              </Badge>
            </button>
          ))}
        </div>
      )}
      {kind !== "company" && (
        <div className="flex flex-wrap gap-1.5">
          {INDIVIDUAL_ROLES.map((r) => (
            <button key={r} type="button" onClick={() => toggle(roleFilter, r, setRoleFilter)}>
              <Badge
                variant="outline"
                className={`cursor-pointer ${ROLE_META[r]?.badge ?? ""} ${
                  roleFilter.includes(r) ? "ring-2 ring-primary" : "opacity-60"
                }`}
              >
                {ROLE_META[r]?.label ?? r}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {total === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Belum ada pemangku kepentingan yang cocok. Klik <b>+ Tambah Cepat</b> untuk mulai memetakan.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCompanies.map((c) => {
            const meta = c.stakeholder_category ? CATEGORY_META[c.stakeholder_category] : undefined;
            return (
              <Link key={`c-${c.id}`} to="/companies/$id" params={{ id: c.id }} className="block">
                <Card className={`h-full border-l-4 transition-shadow hover:shadow-md ${meta?.accent ?? ""}`}>
                  <CardContent className="flex items-start gap-3 pt-6">
                    <span className="rounded-xl bg-muted p-2.5">
                      <Building2 className="size-5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold">{c.name}</p>
                      {c.stakeholder_category && (
                        <Badge variant="outline" className={`mt-1.5 ${meta?.badge ?? ""}`}>
                          {meta?.label ?? c.stakeholder_category}
                        </Badge>
                      )}
                      <p className="mt-1.5 truncate text-xs text-muted-foreground">
                        {[c.city, c.industry].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <RelationshipBadge
                        status={companyStatuses?.get(c.id)}
                        className="mt-1.5 text-[11px]"
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {filteredIndividuals.map((i) => {
            const meta = ROLE_META[i.primary_role];
            const primary = primaryByIndividual.get(i.id);
            return (
              <Link
                key={`i-${i.id}`}
                to="/stakeholders/individuals/$id"
                params={{ id: i.id }}
                className="block"
              >
                <Card className={`h-full border-l-4 transition-shadow hover:shadow-md ${meta?.accent ?? ""}`}>
                  <CardContent className="flex items-start gap-3 pt-6">
                    {i.photo_url ? (
                      <img
                        src={i.photo_url}
                        alt={i.full_name}
                        className="size-10 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className={`flex size-10 items-center justify-center rounded-full text-sm font-bold ${avatarColor(i.full_name)}`}
                      >
                        {nameInitials(i.full_name)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-bold">
                        {i.full_name}
                        {i.nickname && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">({i.nickname})</span>
                        )}
                      </p>
                      <Badge variant="outline" className={`mt-1.5 ${meta?.badge ?? ""}`}>
                        {meta?.label ?? i.primary_role}
                      </Badge>
                      {i.title && <p className="mt-1 truncate text-xs text-muted-foreground">{i.title}</p>}
                      {primary && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">@ {primary}</p>
                      )}
                      <RelationshipBadge
                        status={individualStatuses?.get(i.id)}
                        className="mt-1.5 text-[11px]"
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <QuickAddWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
