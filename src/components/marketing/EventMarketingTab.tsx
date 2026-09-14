import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { formatDateID } from "@/lib/format";
import {
  fetchContentPlansByEvent,
  fetchDesignRequestsByEvent,
  label,
} from "@/lib/marketing";
import { ContentFormDialog } from "@/components/marketing/ContentFormDialog";
import { DesignRequestWizard } from "@/components/marketing/DesignRequestWizard";
import {
  ContentStatusBadge,
  DesignStatusBadge,
  PlatformChip,
  PriorityBadge,
  TypeBadge,
} from "@/components/marketing/MarketingBadges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Tab "Konten & Desain" pada detail event. Hanya menampilkan data terkait event ini. */
export function EventMarketingTab({ eventId }: { eventId: string }) {
  const [contentOpen, setContentOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);

  const { data: plans = [] } = useQuery({
    queryKey: ["event-content-plans", eventId],
    queryFn: () => fetchContentPlansByEvent(eventId),
  });
  const { data: requests = [] } = useQuery({
    queryKey: ["event-design-requests", eventId],
    queryFn: () => fetchDesignRequestsByEvent(eventId),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setContentOpen(true)}>
          <Plus className="mr-1.5 size-4" /> Rencana Konten untuk Event Ini
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDesignOpen(true)}>
          <Plus className="mr-1.5 size-4" /> Minta Desain untuk Event Ini
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rencana Konten ({plans.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {plans.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada rencana konten untuk event ini.</p>
          )}
          {plans.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
              <PlatformChip platform={p.platform} />
              <Link to="/content-calendar" className="font-medium hover:underline">
                {p.title}
              </Link>
              <span className="text-xs text-muted-foreground">{label(p.format)}</span>
              <span className="text-xs text-muted-foreground">
                {p.scheduled_date ? formatDateID(p.scheduled_date) : "Belum dijadwalkan"}
              </span>
              <ContentStatusBadge status={p.status} className="ml-auto" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permintaan Desain ({requests.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {requests.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada permintaan desain untuk event ini.</p>
          )}
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
              <Link to="/design-queue" className="font-medium hover:underline">
                {r.title}
              </Link>
              <TypeBadge value={r.design_type} />
              <PriorityBadge priority={r.priority} />
              <span className="text-xs text-muted-foreground">
                Butuh {formatDateID(r.needed_by)}
              </span>
              <DesignStatusBadge status={r.status} className="ml-auto" />
            </div>
          ))}
        </CardContent>
      </Card>

      <ContentFormDialog
        open={contentOpen}
        onOpenChange={setContentOpen}
        defaultEventId={eventId}
      />
      <DesignRequestWizard
        open={designOpen}
        onOpenChange={setDesignOpen}
        defaultEventId={eventId}
      />
    </div>
  );
}
