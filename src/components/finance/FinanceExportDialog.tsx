import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportFinanceReport } from "@/lib/finance-export";
import type { DateRange, WalletFilter } from "@/lib/finance-summary";

type ExportPeriod = "this-month" | "last-month" | "this-quarter" | "this-year" | "custom";

const PERIOD_LABELS: Record<ExportPeriod, string> = {
  "this-month": "Bulan Ini",
  "last-month": "Bulan Lalu",
  "this-quarter": "Kuartal Ini",
  "this-year": "Tahun Ini",
  custom: "Kustom",
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function rangeFor(key: ExportPeriod, custom: DateRange): DateRange {
  const now = new Date();
  if (key === "this-month")
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  if (key === "last-month")
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  if (key === "this-quarter")
    return {
      from: iso(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)),
      to: iso(now),
    };
  if (key === "this-year") return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
  return custom;
}

export function FinanceExportDialog() {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<ExportPeriod>("this-month");
  const [wallet, setWallet] = useState<WalletFilter>("all");
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await exportFinanceReport({
        range: rangeFor(period, { from, to }),
        periodLabel: PERIOD_LABELS[period],
        wallet,
      });
      toast.success("File berhasil diunduh");
      setOpen(false);
    } catch (e) {
      toast.error("Gagal menyiapkan file: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="size-4" /> Export Laporan Keuangan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Laporan Keuangan</DialogTitle>
          <DialogDescription>
            Pilih periode dan dompet. File berisi data yang boleh Anda lihat saja.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Periode</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as ExportPeriod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIOD_LABELS) as ExportPeriod[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {PERIOD_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {period === "custom" && (
            <div className="flex gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Dari</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sampai</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Dompet</Label>
            <Select value={wallet} onValueChange={(v) => setWallet(v as WalletFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="ops">Operasional</SelectItem>
                <SelectItem value="kas">Kas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={run} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Menyiapkan file…
              </>
            ) : (
              <>
                <Download className="size-4" /> Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
