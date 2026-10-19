import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { BrainCircuit, Cpu, Lightbulb, TriangleAlert } from "lucide-react";
import { Card, CardTitle, PageHeader, StatusPill, tooltipStyle, usePalette } from "@/components/aqua/ui";
import { MIN_SAMPLES, useAqua } from "@/lib/aqua/store";
import { thresholdBreaches } from "@/lib/aqua/rules";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "AI Deteksi Anomali — Aqua Sentinel" },
      { name: "description", content: "Isolation Forest Python (scikit-learn) berjalan langsung di browser untuk deteksi dini anomali air." },
      { property: "og:title", content: "AI Deteksi Anomali — Aqua Sentinel" },
      { property: "og:description", content: "Isolation Forest Python (scikit-learn) berjalan langsung di browser." },
    ],
  }),
  component: AiPage,
});

const advice = {
  NORMAL: "Kondisi air berada pada pola stabil. Lakukan pembersihan sensor secara rutin.",
  WASPADA: "Ada parameter yang mendekati/melewati batas ideal. Pantau tren grafik lebih sering.",
  ANOMALI: "Pola pengukuran menyimpang kuat dari kebiasaan. Periksa sampel air & kalibrasi sensor, lanjutkan uji laboratorium bila perlu.",
  "TIDAK CUKUP DATA": `Model membutuhkan minimal ${MIN_SAMPLES} pengukuran untuk belajar pola.`,
} as const;

function AiPage() {
  const { engine, ai, aiStatus, scoredRows, latest, settings, rows } = useAqua();
  const c = usePalette();
  const breaches = latest ? thresholdBreaches(latest, settings) : [];
  const scatter = scoredRows.map((r) => ({ x: r.ph, y: r.tds, z: r.temperature, status: r.status }));
  const labels = ["pH", "TDS", "Suhu"];

  return (
    <div>
      <PageHeader title="AI Deteksi Anomali" sub="Python + scikit-learn Isolation Forest, dijalankan langsung di dalam web" right={<StatusPill status={aiStatus} className="text-sm" />} />

      {engine.state !== "ready" && (
        <Card className="mb-4">
          <div className="flex items-center gap-3">
            <Cpu className={`h-5 w-5 ${engine.state === "error" ? "text-danger" : "text-primary animate-spin"}`} />
            <div className="flex-1">
              <p className="text-sm font-semibold">{engine.state === "error" ? "Mesin AI gagal dimuat" : engine.stage}</p>
              <p className="text-xs text-muted-foreground">{engine.error ?? "Pemuatan pertama ±10–20 detik, selanjutnya lebih cepat."}</p>
              {engine.state === "loading" && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-brand transition-all duration-700" style={{ width: `${engine.progress}%` }} /></div>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-brand text-primary-foreground lg:col-span-1" delay={0}>
          <BrainCircuit className="h-6 w-6 float-y" />
          <p className="mt-4 text-xs opacity-90">Status saat ini</p>
          <p className="font-display text-4xl font-extrabold">{aiStatus === "TIDAK CUKUP DATA" ? "Belajar…" : aiStatus}</p>
          <p className="mt-3 text-sm opacity-95">{advice[aiStatus]}</p>
          <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
            <Stat k="Skor terakhir" v={scoredRows.at(-1)?.score?.toFixed(4) ?? "—"} />
            <Stat k="Sampel" v={`${rows.length}`} />
            <Stat k="Pohon (trees)" v={`${ai?.n_estimators ?? 150}`} />
            <Stat k="Waktu analisis" v={ai ? `${ai.ms} ms` : "—"} />
          </div>
        </Card>

        <Card className="lg:col-span-2" delay={80}>
          <CardTitle title="Alasan & Peringatan" sub="Faktor yang paling memengaruhi hasil" />
          <div className="space-y-3">
            {ai?.contrib.map((f, i) => (
              <div key={f.feature} className="rise-in" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="flex justify-between text-xs"><span className="font-medium">{f.feature}</span><span className="text-muted-foreground">penyimpangan {f.z}σ</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, f.z * 30)}%`, background: f.z > 2.5 ? c.danger : f.z > 1.5 ? c.warn : c.normal }} />
                </div>
              </div>
            )) ?? <p className="text-sm text-muted-foreground">Menunggu hasil model…</p>}
            <div className="mt-4 space-y-2">
              {breaches.length ? (
                breaches.map((b) => (
                  <p key={b} className="flex items-center gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn"><TriangleAlert className="h-4 w-4" />{b}</p>
                ))
              ) : (
                <p className="flex items-center gap-2 rounded-lg bg-normal-soft px-3 py-2 text-xs text-normal"><Lightbulb className="h-4 w-4" />Semua parameter dalam rentang ambang.</p>
              )}
            </div>
            <p className="pt-2 text-[11px] text-muted-foreground">
              Hasil deteksi adalah indikasi awal untuk pemeriksaan lanjut, bukan penentu keamanan air. pH, TDS, dan suhu tidak dapat mendeteksi bakteri.
            </p>
          </div>
        </Card>

        <Card className="lg:col-span-2" delay={140}>
          <CardTitle title="Peta Multi-Sensor" sub="pH vs TDS, ukuran titik = suhu, warna = status AI" />
          <div className="h-72">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid stroke={c.grid} />
                <XAxis dataKey="x" name="pH" type="number" domain={["auto", "auto"]} tick={{ fontSize: 10, fill: c.muted }} />
                <YAxis dataKey="y" name="TDS" type="number" domain={["auto", "auto"]} tick={{ fontSize: 10, fill: c.muted }} width={40} />
                <ZAxis dataKey="z" range={[30, 160]} name="Suhu" />
                <Tooltip {...tooltipStyle} />
                <Scatter data={scatter}>
                  {scatter.map((p, i) => <Cell key={i} fill={p.status === "ANOMALI" ? c.danger : p.status === "WASPADA" ? c.warn : c.normal} fillOpacity={0.75} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card delay={200}>
          <CardTitle title="Korelasi Parameter" sub="Hubungan antar sensor (Pearson)" />
          <div className="grid grid-cols-4 gap-1 text-center text-xs">
            <span />
            {labels.map((l) => <span key={l} className="font-semibold text-muted-foreground">{l}</span>)}
            {labels.map((r, i) => (
              <Fragment key={r}>
                <span className="self-center font-semibold text-muted-foreground">{r}</span>
                {labels.map((_, j) => {
                  const v = ai?.corr[i]?.[j] ?? 0;
                  return (
                    <span key={`${i}${j}`} className="rounded-lg py-3 font-semibold transition-all" style={{ background: `color-mix(in oklch, ${v >= 0 ? c.ph : c.temp} ${Math.round(Math.abs(v) * 70)}%, transparent)` }}>
                      {ai ? v.toFixed(2) : "—"}
                    </span>
                  );
                })}
              </Fragment>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">Engine: {engine.version ?? "memuat…"}</p>
        </Card>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-primary-foreground/15 p-2">
      <p className="opacity-80">{k}</p>
      <p className="font-display text-sm font-bold">{v}</p>
    </div>
  );
}
