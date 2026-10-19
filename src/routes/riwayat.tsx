import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, StatusPill, fmtDateTime } from "@/components/aqua/ui";
import { useAqua } from "@/lib/aqua/store";
import type { Status } from "@/lib/aqua/rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/riwayat")({
  head: () => ({
    meta: [
      { title: "Riwayat & Laporan — Aqua Sentinel" },
      { name: "description", content: "Telusuri riwayat pengukuran pH, TDS, suhu dan unduh laporannya." },
      { property: "og:title", content: "Riwayat & Laporan — Aqua Sentinel" },
      { property: "og:description", content: "Telusuri riwayat pengukuran dan unduh laporannya." },
    ],
  }),
  component: History,
});

const FILTERS: (Status | "SEMUA")[] = ["SEMUA", "NORMAL", "WASPADA", "ANOMALI"];

function History() {
  const { scoredRows } = useAqua();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("SEMUA");
  const list = useMemo(() => [...scoredRows].reverse().filter((r) => filter === "SEMUA" || r.status === filter), [scoredRows, filter]);

  const stats = useMemo(() => {
    const n = scoredRows.length || 1;
    const avg = (k: "ph" | "tds" | "temperature") => scoredRows.reduce((s, r) => s + r[k], 0) / n;
    return { ph: avg("ph"), tds: avg("tds"), temp: avg("temperature"), anom: scoredRows.filter((r) => r.status === "ANOMALI").length };
  }, [scoredRows]);

  const exportCsv = () => {
    const head = "waktu,ph,tds_ppm,suhu_c,skor_ai,status\n";
    const body = [...scoredRows].map((r) => `${r.timestamp},${r.ph},${r.tds},${r.temperature},${r.score ?? ""},${r.status}`).join("\n");
    const url = URL.createObjectURL(new Blob([head + body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `aqua-sentinel-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Riwayat & Laporan"
        sub="Seluruh pengukuran beserta hasil klasifikasi AI"
        right={
          <div className="no-print flex gap-2">
            <Button variant="outline" onClick={() => window.print()}><Printer />Cetak / PDF</Button>
            <Button onClick={exportCsv}><Download />Unduh Excel (CSV)</Button>
          </div>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        {[
          ["Rata-rata pH", stats.ph.toFixed(2)],
          ["Rata-rata TDS", `${Math.round(stats.tds)} ppm`],
          ["Rata-rata Suhu", `${stats.temp.toFixed(1)} °C`],
          ["Total Anomali", `${stats.anom}`],
        ].map(([k, v], i) => (
          <Card key={k} delay={i * 60} className="p-4">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="font-display text-2xl font-extrabold">{v}</p>
          </Card>
        ))}
      </div>
      <Card delay={240} className="p-0">
        <div className="no-print flex flex-wrap gap-2 border-b border-border p-4">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1 text-xs font-semibold transition-all", filter === f ? "bg-brand text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent")}>
              {f === "SEMUA" ? "Semua" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
          <span className="ml-auto self-center text-xs text-muted-foreground">{list.length} baris</span>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground backdrop-blur">
              <tr>{["Waktu", "pH", "TDS (ppm)", "Suhu (°C)", "Skor AI", "Status"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.timestamp} className="border-t border-border/60 transition-colors hover:bg-accent/40">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtDateTime(r.timestamp)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.ph.toFixed(2)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{Math.round(r.tds)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.temperature.toFixed(1)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.score?.toFixed(3) ?? "—"}</td>
                  <td className="px-4 py-2.5"><StatusPill status={r.status} /></td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Belum ada data.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
