import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Flame } from "lucide-react";
import { LEVEL_META, type RelationshipStatus } from "@/lib/interactions";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Badge tingkat hubungan dengan tooltip ringkas. */
export function RelationshipBadge({
  status,
  className = "",
}: {
  status?: RelationshipStatus | null | undefined;
  className?: string;
}) {
  const level = status?.relationship_level ?? null;
  const hasLog = !!status?.last_interaction_date;
  const meta = level ? LEVEL_META[level] : undefined;

  const badge = hasLog && meta ? (
    <Badge variant="outline" className={`${meta.badge} ${className}`}>
      {level === "Erat" && <Flame className="size-3" />}
      {meta.label}
    </Badge>
  ) : (
    <Badge variant="outline" className={`bg-muted text-muted-foreground ${className}`}>
      Belum ada log
    </Badge>
  );

  const tooltip = hasLog
    ? `Terakhir hubungi: ${format(new Date(status!.last_interaction_date!), "d MMMM yyyy", {
        locale: localeId,
      })} · ${status!.interactions_90d} interaksi 90 hari terakhir`
    : "Belum ada interaksi tercatat";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{badge}</span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
