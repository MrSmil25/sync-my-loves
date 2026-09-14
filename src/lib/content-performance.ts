import { supabase } from "@/lib/supabase-external";
import type { ContentFormat, ContentPlatform } from "@/lib/marketing";

export type PerformanceRecord = {
  id: string;
  content_plan_id: string | null;
  standalone_title: string | null;
  platform: ContentPlatform;
  format: ContentFormat;
  framework_pillar_id: string | null;
  posted_date: string;
  post_url: string | null;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  link_clicks: number | null;
  profile_visits: number | null;
  new_followers: number | null;
  notes: string | null;
  recorded_by: string | null;
  is_archived: boolean;
  engagement_total: number | null;
  content_plans?: { title: string; published_at: string | null } | null;
  framework_pillars?: { name: string; color_hex: string | null } | null;
};

export type PerformanceInput = Omit<
  PerformanceRecord,
  "id" | "is_archived" | "engagement_total" | "content_plans" | "framework_pillars"
>;

export type PendingPerformance = {
  content_plan_id: string | null;
  title: string | null;
  platform: ContentPlatform | null;
  published_at: string | null;
  owner_division: string | null;
};

export type PerformanceViews = {
  byFormat: Array<{ format: ContentFormat | null; jumlah_konten: number | null; rata_jangkauan: number | null; rata_interaksi: number | null; rata_simpanan: number | null; rata_bagikan: number | null; engagement_rate_persen: number | null }>;
  byPillar: Array<{ pilar: string | null; color_hex: string | null; jumlah_konten: number | null; rata_jangkauan: number | null; rata_interaksi: number | null; rata_simpanan: number | null; engagement_rate_persen: number | null }>;
  byDow: Array<{ hari_angka: number | null; hari_nama: string | null; jumlah_konten: number | null; rata_jangkauan: number | null; rata_interaksi: number | null }>;
  monthly: Array<{ bulan: string | null; jumlah_konten: number | null; rata_jangkauan: number | null; rata_interaksi: number | null; total_follower_baru: number | null }>;
  top: Array<{ id: string | null; judul: string | null; platform: ContentPlatform | null; format: ContentFormat | null; pilar: string | null; posted_date: string | null; reach: number | null; engagement_total: number | null; saves: number | null; new_followers: number | null; post_url: string | null; engagement_rate: number | null }>;
};

export function canRecordPerformance(role?: string | null, division?: string | null) {
  return ["Ketua", "Waketu", "Supervisor", "Kadiv"].includes(role ?? "") || ["KRD", "HMS"].includes(division ?? "");
}

export async function fetchPerformanceRecords(includeArchived = false): Promise<PerformanceRecord[]> {
  let query = supabase
    .from("content_performance")
    .select("*, content_plans(title,published_at), framework_pillars(name,color_hex)");
  if (!includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query.order("posted_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PerformanceRecord[];
}

export async function fetchPendingPerformance(): Promise<PendingPerformance[]> {
  const { data, error } = await supabase
    .from("content_needs_performance")
    .select("*")
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PendingPerformance[];
}

export async function fetchPerformanceViews(): Promise<PerformanceViews> {
  const [byFormat, byPillar, byDow, monthly, top] = await Promise.all([
    supabase.from("performance_by_format").select("*"),
    supabase.from("performance_by_pillar").select("*"),
    supabase.from("performance_by_dow").select("*"),
    supabase.from("performance_monthly").select("*").order("bulan", { ascending: true }),
    supabase.from("performance_top").select("*").limit(20),
  ]);
  const failed = [byFormat, byPillar, byDow, monthly, top].find((result) => result.error);
  if (failed?.error) throw failed.error;
  return {
    byFormat: (byFormat.data ?? []) as PerformanceViews["byFormat"],
    byPillar: (byPillar.data ?? []) as PerformanceViews["byPillar"],
    byDow: (byDow.data ?? []) as PerformanceViews["byDow"],
    monthly: (monthly.data ?? []) as PerformanceViews["monthly"],
    top: (top.data ?? []) as PerformanceViews["top"],
  };
}

export async function savePerformance(input: PerformanceInput, id?: string) {
  if (id) {
    const { error } = await supabase.from("content_performance").update(input as never).eq("id", id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase
    .from("content_performance")
    .insert(input as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function archivePerformance(id: string) {
  const { error } = await supabase
    .from("content_performance")
    .update({ is_archived: true } as never)
    .eq("id", id);
  if (error) throw error;
}

export function recordTitle(record: PerformanceRecord) {
  return record.content_plans?.title ?? record.standalone_title ?? "Tanpa judul";
}

export function engagementRate(engagement: number | null | undefined, reach: number | null | undefined) {
  const safeReach = Number(reach ?? 0);
  return safeReach > 0 ? (Number(engagement ?? 0) / safeReach) * 100 : 0;
}

export const formatNumberID = (value: number | null | undefined) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value ?? 0));

export const formatPercentID = (value: number | null | undefined) =>
  `${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0))}%`;
