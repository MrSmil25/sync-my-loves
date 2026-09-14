import { supabase } from "@/lib/supabase-external";

export type InteractionChannel =
  | "Tatap_Muka"
  | "WhatsApp"
  | "Email"
  | "Telepon"
  | "Video_Call"
  | "Instagram_DM"
  | "LinkedIn"
  | "Event"
  | "Lainnya";

export type InteractionDirection =
  | "Kita_Menghubungi"
  | "Mereka_Menghubungi"
  | "Bertemu_Kebetulan";

export type Sentiment = "Positif" | "Netral" | "Perlu_Perhatian";

export type RelationshipLevel = "Erat" | "Aktif" | "Netral" | "Dingin" | "Putus";

export const CHANNELS: InteractionChannel[] = [
  "WhatsApp",
  "Tatap_Muka",
  "Email",
  "Telepon",
  "Video_Call",
  "Instagram_DM",
  "LinkedIn",
  "Event",
  "Lainnya",
];

export const CHANNEL_META: Record<string, { label: string; className: string }> = {
  Tatap_Muka: { label: "Tatap Muka", className: "bg-orange-500/15 text-orange-600" },
  WhatsApp: { label: "WhatsApp", className: "bg-emerald-500/15 text-emerald-600" },
  Email: { label: "Email", className: "bg-blue-500/15 text-blue-600" },
  Telepon: { label: "Telepon", className: "bg-teal-500/15 text-teal-600" },
  Video_Call: { label: "Video Call", className: "bg-violet-500/15 text-violet-600" },
  Instagram_DM: { label: "Instagram DM", className: "bg-pink-500/15 text-pink-600" },
  LinkedIn: { label: "LinkedIn", className: "bg-sky-500/15 text-sky-600" },
  Event: { label: "Event", className: "bg-amber-500/15 text-amber-600" },
  Lainnya: { label: "Lainnya", className: "bg-muted text-muted-foreground" },
};

export const DIRECTIONS: InteractionDirection[] = [
  "Kita_Menghubungi",
  "Mereka_Menghubungi",
  "Bertemu_Kebetulan",
];

export const DIRECTION_LABELS: Record<string, string> = {
  Kita_Menghubungi: "Kita menghubungi",
  Mereka_Menghubungi: "Mereka menghubungi",
  Bertemu_Kebetulan: "Bertemu kebetulan",
};

export const SENTIMENTS: Sentiment[] = ["Positif", "Netral", "Perlu_Perhatian"];

export const SENTIMENT_META: Record<string, { label: string; className: string }> = {
  Positif: { label: "Positif", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  Netral: { label: "Netral", className: "bg-muted text-muted-foreground border-border" },
  Perlu_Perhatian: {
    label: "Perlu Perhatian",
    className: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  },
};

export const RELATIONSHIP_LEVELS: RelationshipLevel[] = [
  "Erat",
  "Aktif",
  "Netral",
  "Dingin",
  "Putus",
];

export const LEVEL_META: Record<
  string,
  { label: string; badge: string; bar: string }
> = {
  Erat: {
    label: "Erat",
    badge: "bg-emerald-600/15 text-emerald-700 border-emerald-600/30",
    bar: "bg-emerald-600",
  },
  Aktif: {
    label: "Aktif",
    badge: "bg-emerald-400/15 text-emerald-600 border-emerald-400/30",
    bar: "bg-emerald-400",
  },
  Netral: {
    label: "Netral",
    badge: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
    bar: "bg-yellow-400",
  },
  Dingin: {
    label: "Dingin",
    badge: "bg-orange-500/15 text-orange-600 border-orange-500/30",
    bar: "bg-orange-500",
  },
  Putus: {
    label: "Putus",
    badge: "bg-red-500/15 text-red-600 border-red-500/30",
    bar: "bg-red-500",
  },
};

export type Interaction = {
  id: string;
  company_id: string | null;
  individual_id: string | null;
  people_id: string | null;
  interaction_date: string;
  interaction_time: string | null;
  channel: InteractionChannel | null;
  direction: InteractionDirection | null;
  summary: string;
  details: string | null;
  related_event_id: string | null;
  related_deal_id: string | null;
  outcome: string | null;
  next_step: string | null;
  next_step_date: string | null;
  sentiment: Sentiment | null;
  logged_by: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string | null;
};

export type RelationshipStatus = {
  target_id: string;
  name: string;
  relationship_level: RelationshipLevel | null;
  last_interaction_date: string | null;
  interactions_90d: number;
  total_interactions: number;
  days_since_last: number | null;
};

export type InteractionInput = {
  company_id?: string | null;
  individual_id?: string | null;
  people_id?: string | null;
  interaction_date: string;
  interaction_time?: string | null;
  channel?: InteractionChannel | null;
  direction?: InteractionDirection | null;
  summary: string;
  details?: string | null;
  related_event_id?: string | null;
  related_deal_id?: string | null;
  outcome?: string | null;
  next_step?: string | null;
  next_step_date?: string | null;
  sentiment?: Sentiment | null;
};

export async function createInteraction(input: InteractionInput) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("interactions")
    .insert({ ...input, logged_by: userData.user?.id ?? null } as never);
  if (error) throw error;
}

export async function updateInteraction(id: string, input: Partial<InteractionInput>) {
  const { error } = await supabase
    .from("interactions")
    .update({ ...input, updated_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function setInteractionArchived(id: string, archived: boolean) {
  const { error } = await supabase
    .from("interactions")
    .update({ is_archived: archived, updated_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw error;
}

/** Interaksi untuk satu individual. */
export async function fetchIndividualInteractions(individualId: string): Promise<Interaction[]> {
  const { data, error } = await supabase
    .from("interactions")
    .select("*")
    .eq("individual_id", individualId)
    .eq("is_archived", false)
    .order("interaction_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Interaction[];
}

/** Interaksi untuk company: langsung ke company atau ke kontak (people) miliknya. */
export async function fetchCompanyInteractions(
  companyId: string,
): Promise<{ items: Interaction[]; peopleNames: Record<string, string> }> {
  const { data: people, error: peopleError } = await supabase
    .from("people")
    .select("id, full_name")
    .eq("company_id", companyId);
  if (peopleError) throw peopleError;
  const peopleIds = (people ?? []).map((p) => p.id);
  const peopleNames: Record<string, string> = {};
  for (const p of people ?? []) peopleNames[p.id] = p.full_name;

  const filter = peopleIds.length
    ? `company_id.eq.${companyId},people_id.in.(${peopleIds.join(",")})`
    : `company_id.eq.${companyId}`;

  const { data, error } = await supabase
    .from("interactions")
    .select("*")
    .or(filter)
    .eq("is_archived", false)
    .order("interaction_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { items: (data ?? []) as unknown as Interaction[], peopleNames };
}

/** Status hubungan satu individual. */
export async function fetchIndividualStatus(
  individualId: string,
): Promise<RelationshipStatus | null> {
  const { data, error } = await supabase
    .from("individual_relationship_status")
    .select("*")
    .eq("individual_id", individualId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    target_id: row["individual_id"] as string,
    name: (row["full_name"] as string) ?? "",
    relationship_level: (row["relationship_level"] as RelationshipLevel) ?? null,
    last_interaction_date: (row["last_interaction_date"] as string) ?? null,
    interactions_90d: Number(row["interactions_90d"] ?? 0),
    total_interactions: Number(row["total_interactions"] ?? 0),
    days_since_last: row["days_since_last"] == null ? null : Number(row["days_since_last"]),
  };
}

export async function fetchCompanyStatus(companyId: string): Promise<RelationshipStatus | null> {
  const { data, error } = await supabase
    .from("company_relationship_status")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    target_id: row["company_id"] as string,
    name: (row["name"] as string) ?? "",
    relationship_level: (row["relationship_level"] as RelationshipLevel) ?? null,
    last_interaction_date: (row["last_interaction_date"] as string) ?? null,
    interactions_90d: Number(row["interactions_90d"] ?? 0),
    total_interactions: Number(row["total_interactions"] ?? 0),
    days_since_last: row["days_since_last"] == null ? null : Number(row["days_since_last"]),
  };
}

/** Batch: status semua individual (dipakai di grid, hindari N+1). */
export async function fetchAllIndividualStatuses(): Promise<Map<string, RelationshipStatus>> {
  const { data, error } = await supabase.from("individual_relationship_status").select("*");
  if (error) throw error;
  const map = new Map<string, RelationshipStatus>();
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    const key = row["individual_id"] as string;
    map.set(key, {
      target_id: key,
      name: (row["full_name"] as string) ?? "",
      relationship_level: (row["relationship_level"] as RelationshipLevel) ?? null,
      last_interaction_date: (row["last_interaction_date"] as string) ?? null,
      interactions_90d: Number(row["interactions_90d"] ?? 0),
      total_interactions: Number(row["total_interactions"] ?? 0),
      days_since_last: row["days_since_last"] == null ? null : Number(row["days_since_last"]),
    });
  }
  return map;
}

/** Batch: status semua company. */
export async function fetchAllCompanyStatuses(): Promise<Map<string, RelationshipStatus>> {
  const { data, error } = await supabase.from("company_relationship_status").select("*");
  if (error) throw error;
  const map = new Map<string, RelationshipStatus>();
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    const key = row["company_id"] as string;
    map.set(key, {
      target_id: key,
      name: (row["name"] as string) ?? "",
      relationship_level: (row["relationship_level"] as RelationshipLevel) ?? null,
      last_interaction_date: (row["last_interaction_date"] as string) ?? null,
      interactions_90d: Number(row["interactions_90d"] ?? 0),
      total_interactions: Number(row["total_interactions"] ?? 0),
      days_since_last: row["days_since_last"] == null ? null : Number(row["days_since_last"]),
    });
  }
  return map;
}

// --------------------------------------------------------------------------
// Dashboard hubungan
// --------------------------------------------------------------------------

export type UpcomingFollowup = {
  interaction_id: string;
  next_step: string | null;
  next_step_date: string;
  logged_by: string | null;
  previous_summary: string | null;
  target_name: string | null;
  target_type: string | null;
  target_link: string | null;
  days_from_today: number;
};

export async function fetchUpcomingFollowups(withinDays = 7): Promise<UpcomingFollowup[]> {
  const today = new Date();
  const end = new Date(today.getTime() + withinDays * 86400000);
  const { data, error } = await supabase
    .from("upcoming_followups")
    .select("*")
    .gte("next_step_date", today.toISOString().slice(0, 10))
    .lte("next_step_date", end.toISOString().slice(0, 10))
    .order("next_step_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as UpcomingFollowup[];
}

export type GoingCold = {
  target_type: string;
  target_id: string;
  target_name: string;
  category: string | null;
  last_interaction_date: string | null;
  days_since_last: number | null;
  level: string | null;
  link: string | null;
};

export async function fetchGoingCold(): Promise<GoingCold[]> {
  const { data, error } = await supabase
    .from("stakeholders_going_cold")
    .select("*")
    .order("days_since_last", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as GoingCold[];
}

/** Jumlah interaksi per bulan, 12 bulan terakhir. */
export async function fetchMonthlyLogActivity(): Promise<{ month: string; count: number }[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - 11);
  since.setDate(1);
  const { data, error } = await supabase
    .from("interactions")
    .select("interaction_date")
    .gte("interaction_date", since.toISOString().slice(0, 10));
  if (error) throw error;
  const buckets = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(since.getFullYear(), since.getMonth() + i, 1);
    buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
  }
  for (const row of (data ?? []) as { interaction_date: string }[]) {
    const key = row.interaction_date.slice(0, 7);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets, ([month, count]) => ({ month, count }));
}

/** Kontributor log bulan ini. */
export async function fetchTopLoggers(): Promise<{ user_id: string; count: number }[]> {
  const start = new Date();
  start.setDate(1);
  const { data, error } = await supabase
    .from("interactions")
    .select("logged_by")
    .gte("interaction_date", start.toISOString().slice(0, 10));
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { logged_by: string | null }[]) {
    if (!row.logged_by) continue;
    counts.set(row.logged_by, (counts.get(row.logged_by) ?? 0) + 1);
  }
  return Array.from(counts, ([user_id, count]) => ({ user_id, count })).sort(
    (a, b) => b.count - a.count,
  );
}

export async function countFollowupsToday(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from("upcoming_followups")
    .select("interaction_id", { count: "exact", head: true })
    .eq("next_step_date", today);
  if (error) throw error;
  return count ?? 0;
}

export async function countGoingCold(): Promise<number> {
  const { count, error } = await supabase
    .from("stakeholders_going_cold")
    .select("target_id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/** Heat map: kombinasi kategori/peran × tingkat hubungan. */
export type HeatCell = { category: string; level: RelationshipLevel; count: number };

export async function fetchRelationshipHeatmap(): Promise<HeatCell[]> {
  const [{ data: comp, error: e1 }, { data: ind, error: e2 }] = await Promise.all([
    supabase.from("company_relationship_status").select("stakeholder_category, relationship_level"),
    supabase.from("individual_relationship_status").select("primary_role, relationship_level"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const map = new Map<string, HeatCell>();
  const add = (category: string | null, level: string | null) => {
    if (!category || !level) return;
    const key = `${category}|${level}`;
    const cur = map.get(key);
    if (cur) cur.count += 1;
    else map.set(key, { category, level: level as RelationshipLevel, count: 1 });
  };
  for (const r of (comp ?? []) as Record<string, string | null>[])
    add(r["stakeholder_category"] ?? null, r["relationship_level"] ?? null);
  for (const r of (ind ?? []) as Record<string, string | null>[])
    add(r["primary_role"] ?? null, r["relationship_level"] ?? null);
  return Array.from(map.values());
}
