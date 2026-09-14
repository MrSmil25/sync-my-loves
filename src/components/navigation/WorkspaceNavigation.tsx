import { Link } from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ElementType,
} from "react";
import { ArrowDown, ArrowUp, Grid3X3, Pin, PinOff, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  createSidebarPreferenceStore,
  frequentUnpinned,
  MAX_SIDEBAR_SHORTCUTS,
} from "@/lib/sidebar-preferences";

export type WorkspaceNavItem = { to: string; label: string; icon: ElementType; badge?: number };
export type WorkspaceNavSection = { key: string; label: string; items: WorkspaceNavItem[] };

function isActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function WorkspaceNavigation({
  accountId,
  pathname,
  sections,
}: {
  accountId: string;
  pathname: string;
  sections: WorkspaceNavSection[];
}) {
  const items = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const store = useMemo(() => createSidebarPreferenceStore(accountId, items), [accountId, items]);
  const preferences = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const itemMap = useMemo(() => new Map(items.map((item) => [item.to, item])), [items]);
  const pins = preferences.pins.flatMap((path) => {
    const item = itemMap.get(path);
    return item ? [item] : [];
  });

  useEffect(() => {
    store.visit(pathname);
  }, [pathname, store]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredSections = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("id");
    if (!needle) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          `${section.label} ${item.label}`.toLocaleLowerCase("id").includes(needle),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [query, sections]);

  const suggestions = frequentUnpinned(items, preferences).flatMap((item) => {
    const full = itemMap.get(item.to);
    return full ? [full] : [];
  });

  function closeAndVisit(path: string) {
    store.visit(path);
    setOpen(false);
  }

  return (
    <>
      <TooltipProvider delayDuration={180}>
        <aside className="workspace-rail" aria-label="Pintasan utama">
          <div className="workspace-rail-scroll">
            {pins.map((item) => (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.to}
                    aria-label={item.label}
                    aria-current={isActive(pathname, item.to) ? "page" : undefined}
                    onClick={() => store.visit(item.to)}
                    className="workspace-rail-link"
                    data-active={isActive(pathname, item.to)}
                  >
                    <item.icon className="size-5" />
                    {item.badge && item.badge > 0 ? (
                      <span className="workspace-rail-badge">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    ) : null}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={12}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="workspace-rail-link shrink-0"
                aria-label="Buka semua menu"
                onClick={() => setOpen(true)}
              >
                <Grid3X3 className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12}>
              Lainnya
            </TooltipContent>
          </Tooltip>
        </aside>

        <nav className="workspace-mobile-nav" aria-label="Navigasi utama mobile">
          {pins.slice(0, 4).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => store.visit(item.to)}
              className="workspace-mobile-link"
              data-active={isActive(pathname, item.to)}
            >
              <item.icon className="size-5" />
              <span>{item.label === "Ruang Kerja Saya" ? "Ruang Kerja" : item.label}</span>
            </Link>
          ))}
          <Button
            variant="ghost"
            className="workspace-mobile-link"
            aria-label="Buka semua menu"
            onClick={() => setOpen(true)}
          >
            <Grid3X3 className="size-5" />
            <span>Lainnya</span>
          </Button>
        </nav>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="workspace-menu-dialog gap-0 p-0 sm:max-w-3xl"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            searchRef.current?.focus();
          }}
        >
          <DialogHeader className="border-b p-5 pr-12 text-left">
            <DialogTitle>Semua menu</DialogTitle>
            <DialogDescription>
              Buka modul yang tersedia untuk akunmu atau atur pintasan.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="menu" className="min-h-0">
            <div className="border-b px-5 pt-4">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="menu" className="flex-1 sm:flex-none">
                  Menu
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex-1 sm:flex-none">
                  Atur sidebar
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="menu" className="m-0 max-h-[min(68vh,680px)] overflow-y-auto p-5">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-9"
                  placeholder="Cari menu"
                  aria-label="Cari menu"
                />
              </label>
              {pins.length > 0 && !query && (
                <section className="mt-5">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                    Pintasanmu
                  </h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {pins.map((item) => (
                      <MenuLink
                        key={item.to}
                        item={item}
                        pathname={pathname}
                        onVisit={closeAndVisit}
                      />
                    ))}
                  </div>
                </section>
              )}
              {suggestions.length > 0 && !query && (
                <section className="mt-6">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                    Sering kamu buka
                  </h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {suggestions.map((item) => (
                      <MenuLink
                        key={item.to}
                        item={item}
                        pathname={pathname}
                        onVisit={closeAndVisit}
                      />
                    ))}
                  </div>
                </section>
              )}
              <div className="mt-6 space-y-6">
                {filteredSections.map((section) => (
                  <section key={section.key}>
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                      {section.label}
                    </h3>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {section.items.map((item) => (
                        <MenuLink
                          key={item.to}
                          item={item}
                          pathname={pathname}
                          onVisit={closeAndVisit}
                        />
                      ))}
                    </div>
                  </section>
                ))}
                {filteredSections.length === 0 && (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Menu tidak ditemukan.
                  </p>
                )}
              </div>
            </TabsContent>
            <TabsContent
              value="settings"
              className="m-0 max-h-[min(68vh,680px)] overflow-y-auto p-5"
            >
              <SidebarCustomizer
                sections={sections}
                items={items}
                preferences={preferences}
                store={store}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MenuLink({
  item,
  pathname,
  onVisit,
}: {
  item: WorkspaceNavItem;
  pathname: string;
  onVisit: (path: string) => void;
}) {
  return (
    <Link
      to={item.to}
      onClick={() => onVisit(item.to)}
      className="workspace-menu-link"
      data-active={isActive(pathname, item.to)}
    >
      <span className="workspace-menu-icon">
        <item.icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge && item.badge > 0 ? (
        <span className="rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function SidebarCustomizer({
  sections,
  items,
  preferences,
  store,
}: {
  sections: WorkspaceNavSection[];
  items: WorkspaceNavItem[];
  preferences: ReturnType<typeof createSidebarPreferenceStore>["getSnapshot"] extends () => infer T
    ? T
    : never;
  store: ReturnType<typeof createSidebarPreferenceStore>;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const map = new Map(items.map((item) => [item.to, item]));
  const full = preferences.pins.length >= MAX_SIDEBAR_SHORTCUTS;
  const notify = (message: string) => toast.success(message);
  const toggle = (item: WorkspaceNavItem) => {
    const pinned = preferences.pins.includes(item.to);
    if (store.toggle(item.to))
      notify(pinned ? `${item.label} dilepas dari sidebar` : `${item.label} disematkan`);
    requestAnimationFrame(() => headingRef.current?.focus());
  };
  const option = (item: WorkspaceNavItem) => {
    const pinned = preferences.pins.includes(item.to);
    return (
      <div className="workspace-shortcut-option" key={item.to}>
        <item.icon className="size-4" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${pinned ? "Lepas" : "Sematkan"} ${item.label}`}
          aria-pressed={pinned}
          disabled={full && !pinned}
          onClick={() => toggle(item)}
        >
          {pinned ? <PinOff /> : <Pin />}
        </Button>
      </div>
    );
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 ref={headingRef} tabIndex={-1} className="font-semibold outline-none">
          Sidebar pilihanmu
        </h3>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold" aria-live="polite">
          {preferences.pins.length} / {MAX_SIDEBAR_SHORTCUTS}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Pilih hingga 9 menu. Lainnya selalu tersedia di posisi terakhir.
      </p>
      <ol className="mt-4 space-y-2">
        {preferences.pins.map((path, index) => {
          const item = map.get(path);
          if (!item) return null;
          return (
            <li key={path} className="workspace-shortcut-option">
              <span className="w-5 text-center text-xs text-muted-foreground">{index + 1}</span>
              <item.icon className="size-4" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Naikkan ${item.label}`}
                disabled={index === 0}
                onClick={() => store.move(path, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Turunkan ${item.label}`}
                disabled={index === preferences.pins.length - 1}
                onClick={() => store.move(path, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Lepas ${item.label}`}
                onClick={() => toggle(item)}
              >
                <PinOff />
              </Button>
            </li>
          );
        })}
      </ol>
      {preferences.pins.length === 0 && (
        <p className="mt-4 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          Belum ada pintasan. Semua menu tetap bisa dibuka lewat Lainnya.
        </p>
      )}
      <p className="mt-3 text-sm text-muted-foreground" role="status">
        {full
          ? "9 pintasan terisi. Lepas satu untuk menggantinya."
          : `${MAX_SIDEBAR_SHORTCUTS - preferences.pins.length} tempat masih tersedia.`}
      </p>
      <Button
        variant="ghost"
        className="mt-2"
        onClick={() => {
          store.reset();
          notify("Susunan bawaan dipulihkan");
          requestAnimationFrame(() => headingRef.current?.focus());
        }}
      >
        <RotateCcw /> Pulihkan susunan bawaan
      </Button>
      <div className="mt-6 space-y-5">
        {sections.map((section) => (
          <section key={section.key}>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">
              {section.label}
            </h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">{section.items.map(option)}</div>
          </section>
        ))}
      </div>
      <p className="mt-6 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        {preferences.storageStatus === "session"
          ? "Browser membatasi penyimpanan. Perubahan hanya berlaku sementara pada sesi ini."
          : "Pilihan dan riwayat penggunaan tersimpan untuk akun ini di browser ini."}
      </p>
    </div>
  );
}
