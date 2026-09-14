import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useMyProfile } from "@/hooks/useProfile";
import { isKrd } from "@/lib/marketing";
import {
  canManageResources,
  faviconOf,
  fetchResources,
  openResource,
  sortResources,
  type Resource,
} from "@/lib/resources";
import { Button } from "@/components/ui/button";

/** Pintasan cepat di Dashboard — hanya tambahan, tidak mengganti kartu lain. */
export function QuickShortcuts() {
  const queryClient = useQueryClient();
  const { data: profile } = useMyProfile();
  const { data: rows = [] } = useQuery({
    queryKey: ["resources", false],
    queryFn: () => fetchResources(false),
  });

  const open = useMutation({
    mutationFn: (r: Resource) => openResource(r),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resource-popularity"] }),
  });

  const pinned = sortResources(
    rows.filter((r) => r.is_pinned && !r.is_folder && r.kind === "Alat_Kerja"),
  ).slice(0, 5);

  const division = (profile as { division?: string | null } | undefined)?.division ?? null;
  const bolehLihatHint = canManageResources(profile?.role) && (isKrd(division) || profile?.role !== "Kadiv");
  const folderKosong = rows.filter(
    (f) =>
      f.is_folder &&
      f.kind === "Aset" &&
      !rows.some((i) => !i.is_folder && i.folder_id === f.id),
  );

  if (pinned.length === 0 && !(bolehLihatHint && folderKosong.length > 0)) return null;

  return (
    <div className="space-y-3">
      {pinned.length > 0 && (
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Pintasan Cepat</h2>
            <Link to="/resources" className="text-xs text-primary hover:underline">
              Lihat semua →
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pinned.map((r) => {
              const icon = faviconOf(r.url, r.icon_url);
              return (
                <div key={r.id} className="flex items-center gap-2 rounded-xl border p-2.5">
                  {icon && <img src={icon} alt="" className="size-6 rounded" />}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.title}</span>
                  <Button size="sm" variant="outline" onClick={() => open.mutate(r)}>
                    <ExternalLink className="size-3.5" /> Buka
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {bolehLihatHint && folderKosong.length > 0 && (
        <Link
          to="/resources"
          className="block rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm transition-colors hover:bg-amber-100"
        >
          Folder {folderKosong.map((f) => f.title).join(", ")} belum diisi. Mulai isi brand kit dan
          template supaya tim punya aset bersama.
        </Link>
      )}
    </div>
  );
}
