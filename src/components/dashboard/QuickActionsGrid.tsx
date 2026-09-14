import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, GraduationCap, LifeBuoy } from "lucide-react";

/**
 * Shortcuts to existing routes only — no new routes, no data access.
 */
export function QuickActionsGrid({ pendingLabel }: { pendingLabel: string }) {
  const actions = [
    {
      to: "/mentor-tasks",
      label: "Tugas dari pembina",
      description: pendingLabel,
      icon: GraduationCap,
    },
    {
      to: "/calendar",
      label: "Kalender",
      description: "Lihat agenda dan kegiatan",
      icon: CalendarDays,
    },
    {
      to: "/help-requests",
      label: "Request bantuan",
      description: "Hubungi divisi terkait",
      icon: LifeBuoy,
    },
  ] as const;
  return (
    <section className="dashboard-start">
      <h2 className="text-2xl font-semibold text-dash-navy">Mulai dari sini</h2>
      <div className="mt-3 grid lg:grid-cols-3">
        {actions.map((a) => (
          <Link key={a.label} to={a.to} className="dashboard-start-link group">
            <span className="dashboard-start-icon">
              <a.icon className="dashboard-action-icon size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-dash-navy">{a.label}</span>
              <span className="mt-0.5 block text-sm text-dash-muted">{a.description}</span>
            </span>
            <ArrowRight className="dashboard-row-arrow size-4" />
          </Link>
        ))}
      </div>
    </section>
  );
}
