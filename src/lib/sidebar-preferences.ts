export const MAX_SIDEBAR_SHORTCUTS = 9;

const DEFAULT_SHORTCUTS = ["/dashboard", "/workspace", "/calendar", "/letters", "/members"];

export type SidebarPreferenceItem = { to: string; label: string };

export type SidebarPreferences = {
  version: 1;
  pins: string[];
  visits: Record<string, number>;
  storageStatus: "available" | "session";
};

type StoredPreferences = Pick<SidebarPreferences, "version" | "pins" | "visits">;

export function sidebarStorageKey(accountId: string) {
  return `myroom:sidebar:v1:${encodeURIComponent(accountId)}`;
}

export function normalizeSidebarPreferences(
  raw: unknown,
  items: SidebarPreferenceItem[],
): StoredPreferences {
  const allowed = new Set(items.map((item) => item.to));
  const value = raw && typeof raw === "object" ? (raw as Partial<StoredPreferences>) : null;
  const candidates =
    value?.version === 1 && Array.isArray(value.pins) ? value.pins : DEFAULT_SHORTCUTS;
  const pins = [
    ...new Set(
      candidates.filter((path): path is string => typeof path === "string" && allowed.has(path)),
    ),
  ].slice(0, MAX_SIDEBAR_SHORTCUTS);
  const visits = Object.fromEntries(
    Object.entries(
      value?.version === 1 && value.visits && typeof value.visits === "object" ? value.visits : {},
    )
      .filter(([path, count]) => allowed.has(path) && Number.isSafeInteger(count) && count > 0)
      .map(([path, count]) => [path, Math.min(Number(count), 1_000_000)]),
  );
  return { version: 1, pins, visits };
}

export type SidebarPreferenceStore = ReturnType<typeof createSidebarPreferenceStore>;

export function createSidebarPreferenceStore(accountId: string, items: SidebarPreferenceItem[]) {
  const key = sidebarStorageKey(accountId);
  let storage: Storage | null = null;
  let raw: unknown = null;
  let storageStatus: SidebarPreferences["storageStatus"] = "session";
  try {
    storage = window.localStorage;
    raw = JSON.parse(storage.getItem(key) ?? "null");
    storageStatus = "available";
  } catch {
    storage = null;
  }
  let snapshot: SidebarPreferences = { ...normalizeSidebarPreferences(raw, items), storageStatus };
  const listeners = new Set<() => void>();

  function commit(next: StoredPreferences) {
    const clean = normalizeSidebarPreferences(next, items);
    try {
      storage?.setItem(key, JSON.stringify(clean));
      if (storage) storageStatus = "available";
    } catch {
      storageStatus = "session";
    }
    snapshot = { ...clean, storageStatus };
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    toggle(path: string) {
      if (!items.some((item) => item.to === path)) return false;
      if (snapshot.pins.includes(path)) {
        commit({ ...snapshot, pins: snapshot.pins.filter((pin) => pin !== path) });
        return true;
      }
      if (snapshot.pins.length >= MAX_SIDEBAR_SHORTCUTS) return false;
      commit({ ...snapshot, pins: [...snapshot.pins, path] });
      return true;
    },
    move(path: string, delta: -1 | 1) {
      const index = snapshot.pins.indexOf(path);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= snapshot.pins.length) return false;
      const pins = [...snapshot.pins];
      const current = pins[index];
      const next = pins[target];
      if (current === undefined || next === undefined) return false;
      pins[index] = next;
      pins[target] = current;
      commit({ ...snapshot, pins });
      return true;
    },
    visit(path: string) {
      if (!items.some((item) => item.to === path)) return;
      commit({
        ...snapshot,
        visits: {
          ...snapshot.visits,
          [path]: Math.min((snapshot.visits[path] ?? 0) + 1, 1_000_000),
        },
      });
    },
    reset() {
      commit({ ...snapshot, pins: DEFAULT_SHORTCUTS });
    },
  };
}

export function frequentUnpinned(items: SidebarPreferenceItem[], preferences: SidebarPreferences) {
  return items
    .filter((item) => !preferences.pins.includes(item.to) && (preferences.visits[item.to] ?? 0) > 0)
    .sort(
      (a, b) =>
        (preferences.visits[b.to] ?? 0) - (preferences.visits[a.to] ?? 0) ||
        a.label.localeCompare(b.label, "id"),
    )
    .slice(0, 5);
}
