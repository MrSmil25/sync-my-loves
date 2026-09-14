import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Folder, Plus, Search, TrendingUp } from "lucide-react";
import { useMyProfile } from "@/hooks/useProfile";
import {
  ASSET_CATEGORIES,
  canManageResources,
  faviconOf,
  fetchResourcePopularity,
  fetchResources,
  isImageResource,
  openResource,
  rLabel,
  sortResources,
  type Resource,
  type ResourceKind,
} from "@/lib/resources";
import { ResourceCard } from "@/components/resources/ResourceCard";
import { ResourceFormDialog } from "@/components/resources/ResourceFormDialog";
import { ArchiveToggle } from "@/components/archive/ArchiveToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/resources/")({
  head: () => ({
    meta: [
      { title: "Alat & Aset — OrgTool" },
      {
        name: "description",
        content:
          "Kumpulan alat kerja dan perpustakaan aset organisasi: brand kit, template, foto, dan tautan tool harian.",
      },
      { property: "og:title", content: "Alat & Aset — OrgTool" },
      {
        property: "og:description",
        content: "Alat kerja dan perpustakaan aset organisasi dalam satu tempat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResourcesPage,
});

const ALL = "__all__";

function BrandKitLayout({
  items,
  canManage,
  folders,
  onEdit,
  clicksOf,
}: {
  items: Resource[];
  canManage: boolean;
  folders: Resource[];
  onEdit: (r: Resource) => void;
  clicksOf: (id: string) => number;
}) {
  const byTag = (tag: string) =>
    items.filter((i) => (i.tags ?? []).some((t) => t.toLowerCase() === tag));

  const warna = byTag("warna");
  const font = byTag("font");
  const logo = byTag("logo");
  const lainnya = items.filter((i) => ![...warna, ...font, ...logo].includes(i));

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        Brand Kit belum diisi. Mulai dengan menambahkan warna, font, dan logo organisasi.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {warna.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Warna</h3>
          <div className="flex flex-wrap gap-4">
            {warna.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => void openResource(w)}
                className="flex flex-col items-center gap-1 text-xs"
              >
                <span
                  className="size-14 rounded-full border shadow-sm"
                  style={{ backgroundColor: w.description ?? "#e5e7eb" }}
                />
                {w.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {font.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Font</h3>
          <div className="space-y-2">
            {font.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => void openResource(f)}
                className="block w-full rounded-xl border bg-card p-4 text-left text-2xl font-semibold hover:bg-accent/40"
              >
                {f.title}
                <span className="block text-xs font-normal text-muted-foreground">
                  {f.description ?? "Klik untuk membuka berkas font"}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {logo.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Logo</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {logo.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => void openResource(l)}
                className="rounded-xl border bg-card p-3 hover:bg-accent/40"
              >
                {isImageResource(l.url) ? (
                  <img src={l.url ?? ""} alt={l.title} className="h-32 w-full object-contain" />
                ) : (
                  <span className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                    Buka aset
                  </span>
                )}
                <span className="mt-2 block text-sm font-medium">{l.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {lainnya.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Aset Lain</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lainnya.map((r) => (
              <ResourceCard
                key={r.id}
                resource={r}
                clicks={clicksOf(r.id)}
                canManage={canManage}
                folders={folders}
                onEdit={onEdit}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ResourcesPage() {
  const { data: profile } = useMyProfile();
  const canManage = canManageResources(profile?.role);

  const [kind, setKind] = useState<ResourceKind>("Alat_Kerja");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [category, setCategory] = useState(ALL);
  const [tag, setTag] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["resources", includeArchived],
    queryFn: () => fetchResources(includeArchived),
  });
  const { data: popularity = [] } = useQuery({
    queryKey: ["resource-popularity"],
    queryFn: fetchResourcePopularity,
  });

  const clicksOf = useMemo(() => {
    const map = new Map(popularity.map((p) => [p.resource_id, p.total_klik_30h ?? 0]));
    return (id: string) => map.get(id) ?? 0;
  }, [popularity]);

  const folders = useMemo(() => rows.filter((r) => r.is_folder), [rows]);
  const allTags = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => r.tags ?? []))).sort(),
    [rows],
  );

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortResources(
      rows.filter((r) => {
        if (r.is_folder || r.kind !== kind) return false;
        if (kind === "Aset" && category !== ALL && r.asset_category !== category) return false;
        if (kind === "Aset" && tag !== ALL && !(r.tags ?? []).includes(tag)) return false;
        if (!q) return true;
        return (
          r.title.toLowerCase().includes(q) ||
          (r.description ?? "").toLowerCase().includes(q) ||
          (r.tags ?? []).some((t) => t.toLowerCase().includes(q))
        );
      }),
    );
  }, [rows, kind, category, tag, search]);

  const kindFolders = useMemo(
    () => sortResources(folders.filter((f) => f.kind === kind)),
    [folders, kind],
  );

  const current = openFolder ? (folders.find((f) => f.id === openFolder) ?? null) : null;
  const searching = search.trim().length > 0;

  function openForm(r: Resource | null) {
    setEditing(r);
    setFormOpen(true);
  }

  const folderItems = current ? items.filter((i) => i.folder_id === current.id) : [];
  const looseItems = items.filter((i) => !i.folder_id);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alat &amp; Aset</h1>
          <p className="text-sm text-muted-foreground">
            Semua tool kerja dan aset organisasi dalam satu tempat.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ArchiveToggle
            id="resource-archive"
            checked={includeArchived}
            onCheckedChange={setIncludeArchived}
          />
          <Button asChild variant="outline">
            <Link to="/resources/popular">
              <TrendingUp className="size-4" /> Lihat Populer
            </Link>
          </Button>
          <Button onClick={() => openForm(null)}>
            <Plus className="size-4" /> Tambah
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-card p-1">
          {(["Alat_Kerja", "Aset"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setOpenFolder(null);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                kind === k ? "bg-secondary text-primary" : "text-muted-foreground"
              }`}
            >
              {k === "Alat_Kerja" ? "Alat Kerja" : "Perpustakaan Aset"}
            </button>
          ))}
        </div>

        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, deskripsi, atau tag…"
            className="pl-8"
          />
        </div>

        {kind === "Aset" && (
          <>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Kategori</SelectItem>
                {ASSET_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{rLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Tag" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Tag</SelectItem>
                {allTags.map((t) => (
                  <SelectItem key={t} value={t}>#{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Memuat…</p>}

      {/* Hasil pencarian: tampilkan datar lintas folder */}
      {searching ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Hasil pencarian ({items.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((r) => (
              <ResourceCard
                key={r.id}
                resource={r}
                clicks={clicksOf(r.id)}
                canManage={canManage}
                folders={folders}
                onEdit={openForm}
              />
            ))}
          </div>
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">Tidak ada yang cocok.</p>
          )}
        </section>
      ) : current ? (
        <section className="space-y-3">
          <nav className="flex items-center gap-1 text-sm text-muted-foreground">
            <button type="button" className="hover:underline" onClick={() => setOpenFolder(null)}>
              {kind === "Alat_Kerja" ? "Alat Kerja" : "Perpustakaan Aset"}
            </button>
            <ChevronRight className="size-3.5" />
            <span className="font-medium text-foreground">{current.title}</span>
          </nav>

          {current.title.toLowerCase().includes("brand kit") ? (
            <BrandKitLayout
              items={folderItems}
              canManage={canManage}
              folders={folders}
              onEdit={openForm}
              clicksOf={clicksOf}
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {folderItems.map((r) => (
                  <ResourceCard
                    key={r.id}
                    resource={r}
                    clicks={clicksOf(r.id)}
                    canManage={canManage}
                    folders={folders}
                    onEdit={openForm}
                  />
                ))}
              </div>
              {folderItems.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Folder ini masih kosong. Tambah item lewat tombol "Tambah".
                </p>
              )}
            </>
          )}
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {kindFolders.map((f) => {
              const count = items.filter((i) => i.folder_id === f.id).length;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setOpenFolder(f.id)}
                  className="flex items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent/40"
                >
                  {f.icon_url ? (
                    <img src={f.icon_url} alt="" className="size-10 rounded-lg" />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <Folder className="size-5 text-primary" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block font-semibold">{f.title}</span>
                    {f.description && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {f.description}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-muted-foreground">{count} item</span>
                  </span>
                </button>
              );
            })}
            {kindFolders.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground">Belum ada folder.</p>
            )}
          </section>

          {looseItems.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Lain-lain</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {looseItems.map((r) => (
                  <ResourceCard
                    key={r.id}
                    resource={r}
                    clicks={clicksOf(r.id)}
                    canManage={canManage}
                    folders={folders}
                    onEdit={openForm}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <ResourceFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditing(null);
        }}
        folders={folders}
        allTags={allTags}
        defaultKind={kind}
        defaultFolderId={openFolder}
        editing={editing}
      />
    </div>
  );
}
