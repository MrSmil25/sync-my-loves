import type { ElementType } from "react";

/**
 * Presentational stat card for the dashboard. No data fetching — values are
 * passed in by the dashboard route exactly as before.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  valueClassName = "",
}: {
  label: string;
  value: string | number;
  icon: ElementType;
  valueClassName?: string;
}) {
  return (
    <div className="dashboard-pulse-card group">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-dash-muted">{label}</p>
        <span className="dash-icon-bubble shrink-0 group-hover:-translate-y-0.5">
          <Icon className="size-4" />
        </span>
      </div>

      <p className={`mt-3 text-3xl font-semibold break-words ${valueClassName}`}>{value}</p>
    </div>
  );
}
