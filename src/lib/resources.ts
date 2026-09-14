import { supabase } from "@/lib/supabase-external";

/* ===================== Enum & tipe ===================== */

export const RESOURCE_KINDS = ["Alat_Kerja", "Aset"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const ASSET_CATEGORIES = [
  "Brand_Kit",
  "Logo",
  "Template_Desain",
  "Foto",
  "Video",
  "Font",
  "Ikon",
  "Deck_Presentasi",
  "Dokumen_Referensi",
  "Panduan_Gaya",
  "Lainnya",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const RESOURCE_SCOPES = ["Semua_Organisasi", "Divisi", "Peran"] as const;
export type ResourceScope = (typeof RESOURCE_SCOPES)[number];

export const USER_ROLES = [
  "Anggota",
  "Kadiv",
  "Sekretaris",
  "Controller",
  "Waketu",
  "Ketua",
  "Supervisor",
] as const;

export const CATEGORY_CLASS: Record<string, string> = {
  Brand_Kit: "border-purple-200 bg-purple-50 text-purple-800",
  Logo: "border-blue-200 bg-blue-50 text-blue-800",
  Template_Desain: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Foto: "border-amber-200 bg-amber-50 text-amber-800",
  Video: "border-rose-200 bg-rose-50 text-rose-800",
  Font: "border-indigo-200 bg-indigo-50 text-indigo-800",
  Ikon: "border-cyan-200 bg-cyan-50 text-cyan-800",
  Deck_Presentasi: "border-orange-200 bg-orange-50 text-orange-800",
  Dokumen_Referensi: "border-slate-200 bg-slate-50 text-slate-800",
  Panduan_Gaya: "border-teal-200 bg-teal-50 text-teal-800",
  Lainnya: "border-border bg-muted text-muted-foreground",
};

export const rLabel = (v?: string | null) => (v ? v.replace(/_/g, " ") : "-");

export type Resource = {
  id: string;
  kind: ResourceKind;
  title: string;
  description: string | null;
  url: string | null;
  icon_url: string | null;
  asset_category: AssetCategory | null;
  tags: string[] | null;
  scope: ResourceScope;
  target_division: string | null;
  target_roles: string[] | null;
  folder_id: string | null;
  is_folder: boolean;
  is_pinned: boolean;
  sort_order: number | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ResourcePopularityRow = {
  resource_id: string;
  title: string | null;
  kind: string | null;
  url: string | null;
  total_klik_30h: number | null;
  pengguna_unik_30h: number | null;
  klik_terakhir: string | null;
};

/* ===================== Util ===================== */

export function faviconOf(url?: string | null, iconUrl?: string | null) {
  if (iconUrl) return iconUrl;
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return null;
  }
}

export function hostOf(url?: string | null) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isImageResource(url?: string | null) {
  return !!url && /\.(jpg|jpeg|png|webp|svg|gif)(\?.*)?$/i.test(url);
}

export function isPdfResource(url?: string | null) {
  return !!url && /\.pdf(\?.*)?$/i.test(url);
}

export function isExternalService(url?: string | null) {
  return (
    !!url &&
    /(drive\.google|docs\.google|canva\.com|figma\.com|dropbox\.com|notion\.so)/i.test(url)
  );
}

/** Urutan tampil: pinned dulu, lalu sort_order, lalu terbaru. */
export function sortResources(rows: Resource[]) {
  return [...rows].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    const sa = a.sort_order ?? 9999;
    const sb = b.sort_order ?? 9999;
    if (sa !== sb) return sa - sb;
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });
}

/** Pre-filter tombol kelola. Wewenang sebenarnya tetap dijaga RLS. */
export function canManageResources(role?: string | null) {
  return !!role && ["Ketua", "Waketu", "Supervisor", "Kadiv"].includes(role);
}

/* ===================== Query ===================== */

export async function fetchResources(includeArchived = false): Promise<Resource[]> {
  let q = supabase.from("resources").select("*");
  if (!includeArchived) q = q.eq("is_archived", false);
  const { data, error } = await q.order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Resource[];
}

export async function fetchResourcePopularity(): Promise<ResourcePopularityRow[]> {
  const { data, error } = await supabase
    .from("resource_popularity")
    .select("*")
    .order("total_klik_30h", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as ResourcePopularityRow[];
}

/* ===================== Mutasi ===================== */

export async function logResourceClick(resourceId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return;
  await supabase.from("resource_clicks").insert({
    resource_id: resourceId,
    clicked_by: uid,
  } as never);
}

/** Catat klik lalu buka tautan di tab baru. */
export async function openResource(resource: Resource) {
  try {
    await logResourceClick(resource.id);
  } catch {
    /* pencatatan klik gagal tidak boleh menghalangi membuka tautan */
  }
  if (resource.url) window.open(resource.url, "_blank", "noopener,noreferrer");
}

export async function createResource(payload: Partial<Resource>) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("resources")
    .insert({ ...payload, created_by: auth.user?.id ?? null } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Resource;
}

export async function updateResource(id: string, patch: Partial<Resource>) {
  const { error } = await supabase
    .from("resources")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function setResourceArchived(id: string, archived: boolean) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("resources")
    .update({
      is_archived: archived,
      archived_by: archived ? (auth.user?.id ?? null) : null,
      archived_at: archived ? new Date().toISOString() : null,
    } as never)
    .eq("id", id);
  if (error) throw error;
}
