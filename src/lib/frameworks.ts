import { supabase } from "@/lib/supabase-external";
import { isBph } from "@/lib/marketing";

/* ===================== Tipe ===================== */

export type ContentFramework = {
  id: string;
  code: string;
  name: string;
  origin: string | null;
  description: string | null;
  is_active: boolean | null;
  is_builtin: boolean | null;
  sort_order: number | null;
};

export type FrameworkPillar = {
  id: string;
  framework_id: string;
  name: string;
  description: string | null;
  ideal_percentage: number | null;
  color_hex: string | null;
  examples: string | null;
  sort_order: number | null;
};

export type ContentBalanceRow = {
  pillar_id: string | null;
  pilar: string | null;
  color_hex: string | null;
  target_persen: number | null;
  jumlah_aktual: number | null;
  aktual_persen: number | null;
  sort_order: number | null;
};

/* ===================== Wewenang ===================== */

/** Kadiv & BPH boleh kelola kerangka konten. */
export function canManageFrameworks(role?: string | null) {
  return isBph(role) || role === "Kadiv";
}

/* ===================== Query ===================== */

export async function fetchFrameworks(): Promise<ContentFramework[]> {
  const { data, error } = await supabase
    .from("content_frameworks")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ContentFramework[];
}

export async function fetchAllFrameworkPillars(): Promise<FrameworkPillar[]> {
  const { data, error } = await supabase
    .from("framework_pillars")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as FrameworkPillar[];
}

export async function fetchActiveFramework(): Promise<ContentFramework | null> {
  const { data, error } = await supabase
    .from("content_frameworks")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as ContentFramework | null;
}

/** Pilar kerangka yang sedang aktif (untuk dropdown di kalender konten). */
export async function fetchActivePillars(): Promise<FrameworkPillar[]> {
  const active = await fetchActiveFramework();
  if (!active) return [];
  const { data, error } = await supabase
    .from("framework_pillars")
    .select("*")
    .eq("framework_id", active.id)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as FrameworkPillar[];
}

export async function fetchContentBalance(): Promise<ContentBalanceRow[]> {
  const { data, error } = await supabase
    .from("content_balance")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ContentBalanceRow[];
}

export async function activateFramework(id: string): Promise<void> {
  const { error } = await supabase
    .from("content_frameworks")
    .update({ is_active: true })
    .eq("id", id);
  if (error) throw error;
}

export type NewPillarInput = {
  name: string;
  description?: string | null;
  ideal_percentage: number;
  color_hex: string;
  examples?: string | null;
};

export async function createCustomFramework(input: {
  name: string;
  origin?: string | null;
  description?: string | null;
  pillars: NewPillarInput[];
}): Promise<string> {
  const code = input.name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24) || `CUSTOM_${Date.now()}`;

  const { data, error } = await supabase
    .from("content_frameworks")
    .insert({
      code,
      name: input.name,
      origin: input.origin || null,
      description: input.description || null,
      is_active: false,
      is_builtin: false,
      sort_order: 900,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  const frameworkId = (data as { id: string }).id;

  if (input.pillars.length) {
    const { error: pErr } = await supabase.from("framework_pillars").insert(
      input.pillars.map((p, i) => ({
        framework_id: frameworkId,
        name: p.name,
        description: p.description || null,
        ideal_percentage: p.ideal_percentage,
        color_hex: p.color_hex,
        examples: p.examples || null,
        sort_order: (i + 1) * 10,
      })) as never,
    );
    if (pErr) throw pErr;
  }
  return frameworkId;
}

/* ===================== Analitik keseimbangan ===================== */

export type BalanceStatus = "seimbang" | "kurang" | "lebih";

export function balanceStatus(row: ContentBalanceRow): {
  status: BalanceStatus;
  diff: number;
} {
  const target = row.target_persen ?? 0;
  const actual = row.aktual_persen ?? 0;
  const diff = Math.round(actual - target);
  if (Math.abs(diff) <= 10) return { status: "seimbang", diff };
  return { status: diff < 0 ? "kurang" : "lebih", diff };
}

/** Pilar yang paling jauh di bawah target (untuk kartu dashboard). */
export function mostLackingPillar(rows: ContentBalanceRow[]): ContentBalanceRow | null {
  const lacking = rows
    .map((r) => ({ r, d: balanceStatus(r) }))
    .filter((x) => x.d.status === "kurang")
    .sort((a, b) => a.d.diff - b.d.diff);
  return lacking[0]?.r ?? null;
}
