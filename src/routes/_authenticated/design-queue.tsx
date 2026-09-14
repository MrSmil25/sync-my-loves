import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { AlertTriangle, Inbox, Palette, Plus } from "lucide-react";
import { toast } from "sonner";
import { useMyProfile, useProfiles } from "@/hooks/useProfile";
import { formatDateID } from "@/lib/format";
import {
  DESIGN_BOARD_STATUSES,
  DESIGN_TYPES,
  PRIORITIES,
  canRejectDesign,
  daysFromToday,
  fetchContentPlans,
  fetchDesignRequests,
  fetchDesignWorkload,
  isKrd,
  label,
  takeDesignRequest,
  updateDesignRequest,
  type DesignRequest,
  type DesignStatus,
} from "@/lib/marketing";
import { DesignRequestWizard } from "@/components/marketing/DesignRequestWizard";
import { DesignRequestDetailDialog } from "@/components/marketing/DesignRequestDetailDialog";
import {
  DesignStatusBadge,
  PersonChip,
  PriorityBadge,
  TypeBadge,
} from "@/components/marketing/MarketingBadges";
import { ArchiveToggle } from "@/components/archive/ArchiveToggle";
import { ArchiveMenu } from "@/components/archive/ArchiveMenu";
import { ArchivedBadge } from "@/components/archive/ArchivedBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/design-queue")({
  head: () => ({
    meta: [
      { title: "Antrean Desain — OrgTool" },
      {
        name: "description",
        content:
          "Antrean permintaan desain organisasi: minta desain, ambil pekerjaan, kirim hasil, dan pantau beban desainer.",
      },
      { property: "og:title", content: "Antrean Desain — OrgTool" },
      {
        property: "og:description",
        content: "Antrean permintaan desain organisasi dan beban kerja tim desain.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DesignQueuePage,
});

const ALL = "__all__";

/** Perpindahan status yang boleh lewat drag (tanpa input tambahan). */
const DRAG_ALLOWED: Record<string, DesignStatus[]> = {
  Diambil: ["Dikerjakan"],
  Dikerjakan: ["Review"],
  Revisi: ["Dikerjakan", "Review"],
};

function RequestCard({
  request,
  nameOf,
  contentTitle,
  draggable,
  canTake,
  onTake,
  onOpen,
}: {
  request: DesignRequest;
  nameOf: (id?: string | null) => string;
  contentTitle?: string | null;
  draggable: boolean;
  canTake: boolean;
  onTake: () => void;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: request.id,
    disabled: !draggable,
  });
  const sisa = daysFromToday(request.needed_by);
  const late = sisa !== null && sisa < 0 && request.status !== "Selesai";
  const soon = sisa !== null && sisa >= 0 && sisa <= 3 && request.status !== "Selesai";
  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={`space-y-2 rounded-xl border bg-card p-3 shadow-sm ${
        request.is_archived ? "opacity-50" : ""
      } ${late ? "border-destructive/50" : ""} ${isDragging ? "opacity-60 shadow-lg" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className={`min-w-0 flex-1 text-left text-sm font-semibold leading-snug ${
            draggable ? "cursor-grab active:cursor-grabbing" : ""
          } ${request.is_archived ? "line-through opacity-60" : ""}`}
          {...listeners}
          {...attributes}
        >
          {request.title}
        </button>
        <ArchiveMenu
          table="design_requests"
          recordId={request.id}
          recordName={request.title}
          isArchived={request.is_archived}
          itemDivision={request.requester_division}
          invalidateKeys={["design-requests"]}
        />
      </div>
      {request.is_archived && <ArchivedBadge />}
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={request.priority} />
        <TypeBadge value={request.design_type} />
        {(request.revision_count ?? 0) > 0 && (
          <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-800">
            Revisi ke-{request.revision_count}
          </span>
        )}
      </div>
      {contentTitle && (
        <span className="inline-flex max-w-full items-center truncate rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-800">
          Dari kalender: {contentTitle}
        </span>
      )}
      <p
        className={`text-[11px] ${
          late
            ? "font-semibold text-destructive"
            : soon
              ? "font-semibold text-orange-600"
              : "text-muted-foreground"
        }`}
      >
        Butuh {formatDateID(request.needed_by)}
        {sisa !== null && (sisa < 0 ? ` · telat ${Math.abs(sisa)} hari` : ` · sisa ${sisa} hari`)}
      </p>
      <div className="flex items-center justify-between">
        <PersonChip name={nameOf(request.requested_by)} />
        {request.designer_id && (
          <span className="text-[10px] text-muted-foreground">→ {nameOf(request.designer_id)}</span>
        )}
      </div>
      {canTake && (
        <Button size="sm" className="w-full" onClick={onTake}>
          Ambil
        </Button>
      )}
    </div>
  );
}

function BoardColumn({ status, children }: { status: DesignStatus; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-40 flex-1 flex-col gap-2 rounded-xl border border-dashed p-2 ${
        isOver ? "border-primary bg-secondary" : "border-border bg-muted/40"
      }`}
    >
      {children}
    </div>
  );
}

function DesignQueuePage() {
  const queryClient = useQueryClient();
  const { data: profile } = useMyProfile();
  const { data: profiles = [] } = useProfiles();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [view, setView] = useState<"papan" | "daftar">("papan");
  const [scope, setScope] = useState<"semua" | "saya" | "permintaanku">("semua");
  const [type, setType] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [designerFilter, setDesignerFilter] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detail, setDetail] = useState<DesignRequest | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["design-requests", includeArchived],
    queryFn: () => fetchDesignRequests(includeArchived),
  });
  const { data: workload = [] } = useQuery({
    queryKey: ["design-workload"],
    queryFn: fetchDesignWorkload,
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["content-plans", false],
    queryFn: () => fetchContentPlans(false),
  });

  const division = (profile as { division?: string | null } | undefined)?.division ?? null;
  const krd = isKrd(division) || canRejectDesign(profile?.role, division);

  const nameOf = useMemo(() => {
    const map = new Map(profiles.map((p) => [p.id, p.full_name as string]));
    return (id?: string | null) => (id ? (map.get(id) ?? "-") : "-");
  }, [profiles]);

  const contentTitleOf = useMemo(() => {
    const map = new Map(plans.map((p) => [p.id, p.title]));
    return (id?: string | null) => (id ? (map.get(id) ?? null) : null);
  }, [plans]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["design-requests"] });
    queryClient.invalidateQueries({ queryKey: ["design-workload"] });
  };

  const take = useMutation({
    mutationFn: (id: string) => takeDesignRequest(id),
    onSuccess: () => {
      invalidate();
      toast.success("Permintaan diambil. Selamat berkarya!");
    },
    onError: (e: Error) => toast.error("Gagal mengambil: " + e.message),
  });

  const move = useMutation({
    mutationFn: ({ id, next }: { id: string; next: DesignStatus }) =>
      updateDesignRequest(id, { status: next }),
    onSuccess: () => {
      invalidate();
      toast.success("Status permintaan diperbarui.");
    },
    onError: (e: Error) => toast.error("Gagal memindahkan: " + e.message),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const filtered = useMemo(
    () =>
      requests.filter((r) => {
        if (type !== ALL && r.design_type !== type) return false;
        if (priority !== ALL && r.priority !== priority) return false;
        if (scope === "saya" && r.designer_id !== profile?.id) return false;
        if (scope === "permintaanku" && r.requested_by !== profile?.id) return false;
        if (designerFilter && r.designer_id !== designerFilter) return false;
        return true;
      }),
    [requests, type, priority, scope, profile?.id, designerFilter],
  );

  const rejected = filtered.filter((r) => r.status === "Ditolak");
  const aktif = requests.filter(
    (r) => !["Selesai", "Ditolak"].includes(r.status) && !r.is_archived,
  ).length;
  const menungguDiambil = requests.filter((r) => r.status === "Baru" && !r.designer_id).length;
  const lewatTenggat = workload.reduce((sum, w) => sum + (w.lewat_tenggat ?? 0), 0);

  function canDrag(r: DesignRequest) {
    if (r.is_archived) return false;
    const isDesigner = r.designer_id === profile?.id;
    return (isDesigner || canRejectDesign(profile?.role, division)) && !!DRAG_ALLOWED[r.status];
  }

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const next = e.over?.id ? (String(e.over.id) as DesignStatus) : null;
    if (!next) return;
    const r = filtered.find((x) => x.id === id);
    if (!r || r.status === next) return;
    if (!canDrag(r) || !(DRAG_ALLOWED[r.status] ?? []).includes(next)) {
      toast.error("Perpindahan ini perlu dilakukan dari detail permintaan.");
      return;
    }
    move.mutate({ id, next });
  }

  function cardFor(r: DesignRequest) {
    return (
      <RequestCard
        key={r.id}
        request={r}
        nameOf={nameOf}
        contentTitle={contentTitleOf(r.content_plan_id)}
        draggable={canDrag(r)}
        canTake={krd && r.status === "Baru" && !r.designer_id && !r.is_archived}
        onTake={() => take.mutate(r.id)}
        onOpen={() => setDetail(r)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Antrean Desain</h1>
          <p className="text-sm text-muted-foreground">
            Semua permintaan desain organisasi dalam satu antrean.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ArchiveToggle
            id="design-archive"
            checked={includeArchived}
            onCheckedChange={setIncludeArchived}
          />
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="size-4" /> Minta Desain
          </Button>
        </div>
      </header>

      {/* Ringkasan antrean */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Inbox className="size-4 text-primary" /> Antrean saat ini
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            <b>{aktif}</b> permintaan aktif · <b>{menungguDiambil}</b> menunggu diambil
          </p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            lewatTenggat > 0 ? "border-destructive/40 bg-destructive/5" : "bg-card"
          }`}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle
              className={`size-4 ${lewatTenggat > 0 ? "text-destructive" : "text-muted-foreground"}`}
            />{" "}
            Lewat tenggat
          </p>
          <p
            className={`mt-1 text-xs ${
              lewatTenggat > 0 ? "font-semibold text-destructive" : "text-muted-foreground"
            }`}
          >
            {lewatTenggat} permintaan
          </p>
        </div>
        {designerFilter && (
          <button
            type="button"
            onClick={() => setDesignerFilter(null)}
            className="rounded-xl border bg-card p-4 text-left text-sm hover:bg-accent/40"
          >
            Filter desainer: <b>{nameOf(designerFilter)}</b>
            <span className="block text-xs text-muted-foreground">Klik untuk hapus filter</span>
          </button>
        )}
      </div>

      {/* Beban kerja desainer */}
      {workload.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {workload.map((w) => {
            const jumlah = w.sedang_dikerjakan ?? 0;
            const tone =
              jumlah >= 7
                ? "text-destructive"
                : jumlah >= 4
                  ? "text-orange-600"
                  : "text-emerald-600";
            return (
              <button
                key={w.designer_id ?? w.full_name}
                type="button"
                onClick={() => setDesignerFilter(w.designer_id ?? null)}
                className={`rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent/40 ${
                  designerFilter && designerFilter === w.designer_id ? "border-primary" : ""
                }`}
              >
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Palette className="size-4 text-primary" /> {w.full_name ?? "-"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sedang dikerjakan: <b className={tone}>{jumlah}</b> · Selesai:{" "}
                  <b>{w.total_selesai ?? 0}</b>
                </p>
                {(w.lewat_tenggat ?? 0) > 0 && (
                  <p className="mt-1 text-xs font-semibold text-destructive">
                    {w.lewat_tenggat} lewat tenggat
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-card p-1">
          {(["papan", "daftar"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                view === v ? "bg-secondary text-primary" : "text-muted-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua permintaan</SelectItem>
            <SelectItem value="saya">Tugas desain saya</SelectItem>
            <SelectItem value="permintaanku">Permintaan saya</SelectItem>
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Jenis" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua Jenis</SelectItem>
            {DESIGN_TYPES.map((t) => (<SelectItem key={t} value={t}>{label(t)}</SelectItem>))}
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Prioritas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua Prioritas</SelectItem>
            {PRIORITIES.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Memuat antrean…</p>}

      {view === "papan" ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {DESIGN_BOARD_STATUSES.map((s) => {
              const items = filtered.filter((r) => r.status === s);
              return (
                <div key={s} className="flex w-64 shrink-0 flex-col">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {label(s)}
                    </p>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <BoardColumn status={s}>{items.map(cardFor)}</BoardColumn>
                </div>
              );
            })}
          </div>
        </DndContext>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <div key={r.id} className="space-y-1">
              {cardFor(r)}
              <DesignStatusBadge status={r.status} className="ml-1" />
            </div>
          ))}
          {filtered.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">Belum ada permintaan desain.</p>
          )}
        </div>
      )}

      {rejected.length > 0 && view === "papan" && (
        <div className="rounded-xl border bg-card p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Ditolak ({rejected.length})
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rejected.map(cardFor)}
          </div>
        </div>
      )}

      <DesignRequestWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      <DesignRequestDetailDialog request={detail} onOpenChange={(v) => !v && setDetail(null)} />
    </div>
  );
}
