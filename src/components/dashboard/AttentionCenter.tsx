import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  to: string;
  tone: "danger" | "warning" | "info" | "success";
};

export function AttentionCenter({ items }: { items: AttentionItem[] }) {
  return (
    <section className="dashboard-section dash-enter" aria-labelledby="attention-heading">
      <div className="dashboard-section-heading">
        <div>
          <p className="dashboard-section-kicker">PRIORITAS</p>
          <h2 id="attention-heading">Perlu Perhatian</h2>
        </div>
        {items.length > 0 && <span className="dashboard-section-count">{items.length}</span>}
      </div>

      <div className="dashboard-attention-list">
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            className="dashboard-attention-item group"
            data-tone={item.tone}
          >
            <span className="dashboard-attention-marker" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-dash-navy">{item.title}</span>
              <span className="mt-1 block text-sm text-dash-muted">{item.detail}</span>
            </span>
            <ArrowRight className="dashboard-row-arrow size-4" aria-hidden="true" />
          </Link>
        ))}

        {items.length === 0 && (
          <div className="dashboard-attention-safe">
            <span className="dashboard-safe-icon">
              <CheckCircle2 className="size-5" />
            </span>
            <div>
              <p className="font-semibold text-dash-navy">Semua aman</p>
              <p className="mt-1 text-sm text-dash-muted">
                Tidak ada tindakan yang membutuhkan perhatian.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
