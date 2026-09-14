import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";

export type ActivityItem = {
  id: string;
  title: string;
  meta: string;
  to?: string;
  params?: Record<string, string>;
};

/**
 * Vertical timeline for dashboard activity. Items are derived from data the
 * dashboard already loads — this component never fetches anything.
 */
export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  return (
    <section className="dashboard-section dash-enter" aria-labelledby="activity-heading">
      <div className="dashboard-section-heading">
        <div>
          <p className="dashboard-section-kicker">TERBARU</p>
          <h2 id="activity-heading">Aktivitas Organisasi</h2>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="dashboard-activity-empty">
          <span className="dash-icon-bubble size-12 rounded-2xl">
            <Activity className="size-5" />
          </span>
          <p className="mt-4 font-semibold text-dash-navy">Belum ada aktivitas</p>
          <p className="mt-1 text-sm text-dash-muted">
            Organisasi akan berkembang seiring aktivitas berjalan.
          </p>
        </div>
      ) : (
        <div className="dashboard-timeline">
          <p className="dashboard-timeline-day">Hari ini</p>
          <ol>
            {items.map((item, i) => {
              const content = (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="dashboard-timeline-dot" />
                    {i < items.length - 1 && (
                      <span className="dashboard-timeline-line" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-6">
                    <p className="font-semibold text-dash-navy">{item.title}</p>
                    <p className="mt-0.5 text-sm text-dash-muted">{item.meta}</p>
                  </div>
                </div>
              );

              return (
                <li key={item.id}>
                  {item.to ? (
                    <Link
                      to={item.to}
                      {...(item.params ? { params: item.params } : {})}
                      className="dashboard-timeline-link"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="px-1">{content}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
