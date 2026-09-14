import { Link } from "@tanstack/react-router";
import { ArrowRight, Landmark, Receipt } from "lucide-react";
import { formatRupiah } from "@/lib/format";

export function FinancialSnapshot({
  balance,
  monthExpense,
}: {
  balance: number | undefined;
  monthExpense: number | undefined;
}) {
  return (
    <section className="dashboard-finance dash-enter" aria-labelledby="finance-heading">
      <div className="dashboard-section-heading">
        <div>
          <p className="dashboard-section-kicker">KEUANGAN</p>
          <h2 id="finance-heading">Ringkasan Keuangan</h2>
        </div>
        <Link to="/transactions" className="dashboard-text-link group">
          Lihat Keuangan <ArrowRight className="dashboard-row-arrow size-4" />
        </Link>
      </div>

      <div className="dashboard-finance-grid">
        <div>
          <span className="dashboard-finance-icon">
            <Landmark className="size-4" />
          </span>
          <p>Saldo saat ini</p>
          <strong>{balance === undefined ? "…" : formatRupiah(balance)}</strong>
        </div>
        <div>
          <span className="dashboard-finance-icon">
            <Receipt className="size-4" />
          </span>
          <p>Pengeluaran bulan ini</p>
          <strong>{monthExpense === undefined ? "…" : formatRupiah(monthExpense)}</strong>
        </div>
      </div>
    </section>
  );
}
