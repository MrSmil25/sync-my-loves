import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { relativeTime } from "@/lib/format";
import { faviconOf, fetchResourcePopularity, rLabel } from "@/lib/resources";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/resources/popular")({
  head: () => ({
    meta: [
      { title: "Alat Paling Populer — OrgTool" },
      {
        name: "description",
        content: "Peringkat alat dan aset organisasi yang paling sering dibuka dalam 30 hari terakhir.",
      },
      { property: "og:title", content: "Alat Paling Populer — OrgTool" },
      {
        property: "og:description",
        content: "Peringkat alat dan aset yang paling sering dibuka anggota dalam 30 hari terakhir.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PopularPage,
});

function PopularPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["resource-popularity"],
    queryFn: fetchResourcePopularity,
  });

  const top = rows[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alat &amp; Aset Populer</h1>
          <p className="text-sm text-muted-foreground">
            Berdasarkan jumlah klik 30 hari terakhir.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/resources">
            <ArrowLeft className="size-4" /> Kembali
          </Link>
        </Button>
      </header>

      {top && (top.total_klik_30h ?? 0) > 0 && (
        <div className="rounded-xl border bg-card p-4 text-sm">
          Alat paling banyak dipakai: <b>{top.title}</b>. {top.pengguna_unik_30h ?? 0} orang
          memakainya bulan ini.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Peringkat</th>
              <th className="px-3 py-2 text-left">Nama</th>
              <th className="px-3 py-2 text-left">Jenis</th>
              <th className="px-3 py-2 text-right">Klik 30 Hari</th>
              <th className="px-3 py-2 text-right">Pengguna Unik</th>
              <th className="px-3 py-2 text-left">Klik Terakhir</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const icon = faviconOf(r.url);
              return (
                <tr key={r.resource_id} className="border-t">
                  <td className="px-3 py-2 font-semibold">{i + 1}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      {icon && <img src={icon} alt="" className="size-4" />}
                      {r.title}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{rLabel(r.kind)}</td>
                  <td className="px-3 py-2 text-right">{r.total_klik_30h ?? 0}</td>
                  <td className="px-3 py-2 text-right">{r.pengguna_unik_30h ?? 0}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.klik_terakhir ? relativeTime(r.klik_terakhir) : "-"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Belum ada klik tercatat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
