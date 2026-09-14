import * as XLSX from "xlsx";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/lib/supabase-external";
import { fetchOrgSettings } from "@/lib/announcements";
import {
  fetchCategoryBreakdown,
  fetchMonthlyCashflow,
  fetchPeriodSummary,
  fetchWallets,
  type DateRange,
  type WalletFilter,
} from "@/lib/finance-summary";
import { fetchTransactions, type TransactionWithRelations } from "@/lib/transactions";
import {
  fetchCashBalance,
  fetchCashExpenses,
  fetchCollectionProgress,
  type CashExpense,
  type CollectionPayment,
  type CollectionProgress,
} from "@/lib/cash";
import { fetchBudgets, type BudgetRow } from "@/lib/budgets";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as unknown as { from: (table: string) => any };

const D = (v?: string | null) => (v ? format(new Date(v), "dd/MM/yyyy", { locale: idLocale }) : "");
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const num = (v: unknown) => Number(v ?? 0);
const today = () => format(new Date(), "yyyy-MM-dd");

const NO_DATA = "Tidak ada data";

function addSheet(
  wb: XLSX.WorkBook,
  name: string,
  rows: Record<string, unknown>[],
  header: string[],
  cols: number[],
) {
  const body = rows.length > 0 ? rows : [{ [header[0] as string]: NO_DATA }];
  const ws = XLSX.utils.json_to_sheet(body, { header });
  ws["!cols"] = cols.map((wch) => ({ wch }));
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = { font: { bold: true } };
  }
  XLSX.utils.book_append_sheet(wb, ws, name);
  return ws;
}

// ---------- Transaksi ----------

const TRX_HEADER = [
  "Tanggal",
  "Tipe",
  "Kategori",
  "Jumlah (Rp)",
  "Deskripsi",
  "Terkait",
  "Dicatat Oleh",
  "Visibilitas",
];
const TRX_COLS = [14, 14, 20, 16, 45, 30, 22, 18];

function relatedLabel(t: TransactionWithRelations): string {
  if (t.deals?.name) return `Deal: ${t.deals.name}`;
  if (t.events?.name) return `Event: ${t.events.name}`;
  if (t.fund_requests) return `Pengajuan: ${t.fund_requests.request_number ?? t.fund_requests.purpose}`;
  return "";
}

export function transactionRows(list: TransactionWithRelations[]) {
  return list.map((t) => ({
    Tanggal: D(t.transaction_date),
    Tipe: t.type === "Income" ? "Pemasukan" : "Pengeluaran",
    Kategori: t.category ?? "",
    "Jumlah (Rp)": num(t.amount_idr),
    Deskripsi: t.description ?? "",
    Terkait: relatedLabel(t),
    "Dicatat Oleh": t.profiles?.full_name ?? "",
    Visibilitas: t.visibility ?? "",
  }));
}

function withTrxSubtotal(list: TransactionWithRelations[]) {
  const rows = transactionRows(list);
  if (rows.length === 0) return rows;
  const masuk = list.filter((t) => t.type === "Income").reduce((s, t) => s + num(t.amount_idr), 0);
  const keluar = list.filter((t) => t.type === "Expense").reduce((s, t) => s + num(t.amount_idr), 0);
  const blank = { Tanggal: "", Tipe: "", Kategori: "", Deskripsi: "", Terkait: "", "Dicatat Oleh": "", Visibilitas: "" };
  rows.push({ ...blank, Kategori: "TOTAL PEMASUKAN", "Jumlah (Rp)": masuk } as never);
  rows.push({ ...blank, Kategori: "TOTAL PENGELUARAN", "Jumlah (Rp)": keluar } as never);
  rows.push({ ...blank, Kategori: "NET", "Jumlah (Rp)": masuk - keluar } as never);
  return rows;
}

// ---------- Data kas ----------

type PaymentJoined = CollectionPayment & {
  collections?: { title?: string | null; kind?: string | null } | null;
};

async function fetchPaidPayments(range?: DateRange): Promise<PaymentJoined[]> {
  let q = db
    .from("collection_payments")
    .select(
      "*, collections(*), profiles:member_id(id,full_name,division,photo_url), verifier:verified_by(id,full_name)",
    )
    .eq("status", "Lunas");
  if (range) {
    q = q.gte("verified_at", `${range.from}T00:00:00`).lte("verified_at", `${range.to}T23:59:59`);
  }
  const { data, error } = await q.order("verified_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PaymentJoined[];
}

const KAS_IN_HEADER = [
  "Tanggal Verifikasi",
  "Program",
  "Jenis",
  "Nama Anggota",
  "Divisi",
  "Jumlah (Rp)",
  "Diverifikasi Oleh",
];
const KAS_IN_COLS = [18, 30, 16, 25, 18, 16, 24];

function kasInRows(payments: PaymentJoined[]) {
  const rows = payments.map((p) => ({
    "Tanggal Verifikasi": D(p.verified_at),
    Program: p.collections?.title ?? "",
    Jenis: p.collections?.kind === "Kas_Rutin" ? "Kas Rutin" : "Pengumpulan",
    "Nama Anggota": p.profiles?.full_name ?? "",
    Divisi: p.profiles?.division ?? "",
    "Jumlah (Rp)": num(p.amount_paid),
    "Diverifikasi Oleh": p.verifier?.full_name ?? "",
  }));
  if (rows.length > 0) {
    rows.push({
      "Tanggal Verifikasi": "",
      Program: "SUBTOTAL",
      Jenis: "",
      "Nama Anggota": "",
      Divisi: "",
      "Jumlah (Rp)": rows.reduce((s, r) => s + Number(r["Jumlah (Rp)"]), 0),
      "Diverifikasi Oleh": "",
    });
  }
  return rows;
}

const KAS_OUT_HEADER = ["Tanggal", "Deskripsi", "Jumlah (Rp)", "Dicatat Oleh"];
const KAS_OUT_COLS = [14, 50, 16, 24];

function kasOutRows(expenses: CashExpense[]) {
  const rows = expenses.map((e) => ({
    Tanggal: D(e.expense_date),
    Deskripsi: e.description ?? "",
    "Jumlah (Rp)": num(e.amount_idr),
    "Dicatat Oleh": e.profiles?.full_name ?? "",
  }));
  if (rows.length > 0) {
    rows.push({
      Tanggal: "",
      Deskripsi: "SUBTOTAL",
      "Jumlah (Rp)": rows.reduce((s, r) => s + Number(r["Jumlah (Rp)"]), 0),
      "Dicatat Oleh": "",
    });
  }
  return rows;
}

const PROGRAM_HEADER = [
  "Judul",
  "Jenis",
  "Nominal per Orang (Rp)",
  "Total Target",
  "Sudah Lunas",
  "Belum",
  "Terkumpul (Rp)",
  "Persentase",
];
const PROGRAM_COLS = [30, 16, 22, 14, 14, 10, 18, 14];

function programRows(progress: CollectionProgress[]) {
  return progress.map((p) => {
    const total = num(p.total_tagihan);
    const lunas = num(p.total_lunas);
    return {
      Judul: p.title,
      Jenis: p.kind === "Kas_Rutin" ? "Kas Rutin" : "Pengumpulan",
      "Nominal per Orang (Rp)": num(p.amount_per_person),
      "Total Target": total,
      "Sudah Lunas": lunas,
      Belum: Math.max(0, total - lunas),
      "Terkumpul (Rp)": num(p.total_terkumpul),
      Persentase: `${total > 0 ? Math.round((lunas / total) * 100) : 0}%`,
    };
  });
}

// ---------- Export utama ----------

export type FinanceExportOptions = {
  range: DateRange;
  periodLabel: string;
  wallet: WalletFilter;
};

export async function exportFinanceReport(opts: FinanceExportOptions): Promise<void> {
  const { range, wallet } = opts;
  const includeOps = wallet === "all" || wallet === "ops";
  const includeKas = wallet === "all" || wallet === "kas";

  const [
    org,
    wallets,
    summary,
    transactions,
    payments,
    expenses,
    incomeBreak,
    expenseBreak,
    monthly,
    progress,
    budgets,
  ] = await Promise.all([
    fetchOrgSettings().catch(() => null),
    fetchWallets(),
    fetchPeriodSummary(range),
    includeOps ? fetchTransactions({ from: range.from, to: range.to }) : Promise.resolve([]),
    includeKas ? fetchPaidPayments(range) : Promise.resolve<PaymentJoined[]>([]),
    includeKas ? fetchCashExpenses(false) : Promise.resolve<CashExpense[]>([]),
    fetchCategoryBreakdown(range, "Income"),
    fetchCategoryBreakdown(range, "Expense"),
    fetchMonthlyCashflow(),
    includeKas ? fetchCollectionProgress() : Promise.resolve<CollectionProgress[]>([]),
    fetchBudgets().catch(() => [] as BudgetRow[]),
  ]);

  const orgName = org?.org_name ?? "Organisasi";
  const wb = XLSX.utils.book_new();

  // Sheet 1 — Ringkasan
  const info: (string | number)[][] = [
    [`Laporan Keuangan ${orgName}`],
    [`Periode: ${opts.periodLabel} (${D(range.from)} – ${D(range.to)})`],
    [`Dompet: ${wallet === "all" ? "Semua" : wallet === "ops" ? "Operasional" : "Kas"}`],
    [`Tanggal Export: ${D(new Date().toISOString())}`],
    [],
    ["SALDO SAAT INI"],
    ["Total Kekayaan Organisasi", rp(wallets.total_saldo)],
    ["Dompet Operasional", rp(wallets.ops_saldo), `Masuk: ${rp(wallets.ops_masuk_total)}`, `Keluar: ${rp(wallets.ops_keluar_total)}`],
    ["Dompet Kas", rp(wallets.kas_saldo), `Masuk: ${rp(wallets.kas_masuk_total)}`, `Keluar: ${rp(wallets.kas_keluar_total)}`],
    [],
    ["PERIODE TERPILIH"],
    ["Dompet", "Pemasukan", "Pengeluaran", "Net"],
    ["Operasional", rp(summary.ops_masuk), rp(summary.ops_keluar), rp(summary.ops_net)],
    ["Kas", rp(summary.kas_masuk), rp(summary.kas_keluar), rp(summary.kas_net)],
    ["Total", rp(summary.total_masuk), rp(summary.total_keluar), rp(summary.total_net)],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(info);
  wsInfo["!cols"] = [30, 24, 24, 24].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsInfo, "Ringkasan");

  // Sheet 2 — Transaksi Operasional
  addSheet(
    wb,
    "Transaksi Operasional",
    withTrxSubtotal([...transactions].reverse()),
    TRX_HEADER,
    TRX_COLS,
  );

  // Sheet 3 — Kas Masuk
  addSheet(wb, "Kas Masuk (Iuran)", kasInRows(payments), KAS_IN_HEADER, KAS_IN_COLS);

  // Sheet 4 — Kas Keluar
  const expInRange = expenses.filter(
    (e) => e.expense_date >= range.from && e.expense_date <= range.to,
  );
  addSheet(wb, "Kas Keluar", kasOutRows(expInRange), KAS_OUT_HEADER, KAS_OUT_COLS);

  // Sheet 5 — Rekap per Kategori
  const catHeader = ["Bagian", "Dompet", "Kategori", "Total (Rp)", "Persentase"];
  const filterWallet = <T extends { dompet: string }>(rows: T[]) =>
    rows.filter((r) =>
      wallet === "all" ? true : wallet === "ops" ? r.dompet === "Operasional" : r.dompet === "Kas",
    );
  const inRows = filterWallet(incomeBreak);
  const outRows = filterWallet(expenseBreak);
  const inTotal = inRows.reduce((s, r) => s + r.total, 0);
  const outTotal = outRows.reduce((s, r) => s + r.total, 0);
  const catRows = [
    ...inRows.map((r) => ({
      Bagian: "Pemasukan",
      Dompet: r.dompet,
      Kategori: r.category ?? "Lainnya",
      "Total (Rp)": r.total,
      Persentase: `${inTotal > 0 ? Math.round((r.total / inTotal) * 100) : 0}%`,
    })),
    ...outRows.map((r) => ({
      Bagian: "Pengeluaran",
      Dompet: r.dompet,
      Kategori: r.category ?? "Lainnya",
      "Total (Rp)": r.total,
      Persentase: `${outTotal > 0 ? Math.round((r.total / outTotal) * 100) : 0}%`,
    })),
  ];
  addSheet(wb, "Rekap per Kategori", catRows, catHeader, [16, 16, 26, 18, 14]);

  // Sheet 6 — Arus Bulanan (pivot bulan + dompet)
  const pivot = new Map<string, { bulan: string; dompet: string; masuk: number; keluar: number }>();
  for (const r of monthly) {
    if (wallet === "ops" && r.dompet !== "Operasional") continue;
    if (wallet === "kas" && r.dompet !== "Kas") continue;
    const key = `${r.bulan}|${r.dompet}`;
    const entry = pivot.get(key) ?? { bulan: r.bulan, dompet: r.dompet, masuk: 0, keluar: 0 };
    if (r.arah === "Income") entry.masuk += r.total;
    else entry.keluar += r.total;
    pivot.set(key, entry);
  }
  const monthlyRows = [...pivot.values()]
    .sort((a, b) => a.bulan.localeCompare(b.bulan) || a.dompet.localeCompare(b.dompet))
    .map((e) => ({
      Bulan: format(new Date(e.bulan), "MMMM yyyy", { locale: idLocale }),
      Dompet: e.dompet,
      "Pemasukan (Rp)": e.masuk,
      "Pengeluaran (Rp)": e.keluar,
      "Net (Rp)": e.masuk - e.keluar,
    }));
  addSheet(
    wb,
    "Arus Bulanan",
    monthlyRows,
    ["Bulan", "Dompet", "Pemasukan (Rp)", "Pengeluaran (Rp)", "Net (Rp)"],
    [18, 16, 18, 20, 18],
  );

  // Sheet 7 — Status Iuran per Program
  if (includeKas) {
    const ws = addSheet(wb, "Status Iuran per Program", programRows(progress), PROGRAM_HEADER, PROGRAM_COLS);
    const detail = payments.map((p) => ({
      Program: p.collections?.title ?? "",
      Nama: p.profiles?.full_name ?? "",
      Status: "Lunas",
      "Jumlah Dibayar (Rp)": num(p.amount_paid),
      Tanggal: D(p.verified_at),
    }));
    if (detail.length > 0) {
      const startRow = (progress.length > 0 ? progress.length : 1) + 3;
      XLSX.utils.sheet_add_aoa(ws, [["DETAIL PEMBAYARAN LUNAS"]], { origin: `A${startRow}` });
      XLSX.utils.sheet_add_json(ws, detail, { origin: `A${startRow + 1}` });
    }
  }

  // Sheet 8 — Anggaran
  if (budgets.length > 0) {
    const budgetRows = budgets.map((b) => {
      const alloc = num(b.allocated_idr);
      const spent = num(b.spent_idr);
      return {
        "Nama Anggaran": b.category,
        "Divisi/Event": b.division ?? (b.event_id ? "Event" : "Organisasi"),
        "Alokasi (Rp)": alloc,
        "Terpakai (Rp)": spent,
        "Sisa (Rp)": alloc - spent,
        "Persentase Terpakai": `${alloc > 0 ? Math.round((spent / alloc) * 100) : 0}%`,
        Status: spent > alloc ? "OVER" : (b.status ?? ""),
      };
    });
    addSheet(
      wb,
      "Anggaran",
      budgetRows,
      [
        "Nama Anggaran",
        "Divisi/Event",
        "Alokasi (Rp)",
        "Terpakai (Rp)",
        "Sisa (Rp)",
        "Persentase Terpakai",
        "Status",
      ],
      [28, 20, 18, 18, 18, 20, 14],
    );
  }

  XLSX.writeFile(wb, `Laporan-Keuangan_${today()}.xlsx`);
}

/** Export transaksi sesuai filter feed yang sedang aktif. */
export async function exportTransactions(
  rows: TransactionWithRelations[],
  range: DateRange,
): Promise<void> {
  const wb = XLSX.utils.book_new();
  addSheet(wb, "Transaksi", withTrxSubtotal([...rows].reverse()), TRX_HEADER, TRX_COLS);
  XLSX.writeFile(wb, `Transaksi_${range.from}_sd_${range.to}_${today()}.xlsx`);
}

/** Export data kas: ringkasan, iuran masuk, kas keluar, status program. */
export async function exportCashData(): Promise<void> {
  const [balance, payments, expenses, progress] = await Promise.all([
    fetchCashBalance(),
    fetchPaidPayments(),
    fetchCashExpenses(false),
    fetchCollectionProgress(),
  ]);

  const wb = XLSX.utils.book_new();
  const wsInfo = XLSX.utils.aoa_to_sheet([
    ["Ringkasan Kas"],
    [`Tanggal Export: ${D(new Date().toISOString())}`],
    [],
    ["Saldo Kas", rp(balance.saldo_kas)],
    ["Total Masuk", rp(balance.total_masuk)],
    ["Total Keluar", rp(balance.total_keluar)],
  ]);
  wsInfo["!cols"] = [{ wch: 24 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, "Ringkasan Kas");

  addSheet(wb, "Iuran Masuk", kasInRows(payments), KAS_IN_HEADER, KAS_IN_COLS);
  addSheet(wb, "Kas Keluar", kasOutRows(expenses), KAS_OUT_HEADER, KAS_OUT_COLS);
  addSheet(wb, "Status per Program", programRows(progress), PROGRAM_HEADER, PROGRAM_COLS);

  XLSX.writeFile(wb, `Data_Kas_${today()}.xlsx`);
}
