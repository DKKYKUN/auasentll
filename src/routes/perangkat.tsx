import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Droplets, FlaskConical, Sheet, Thermometer, BrainCircuit } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, PageHeader } from "@/components/aqua/ui";
import { useAqua } from "@/lib/aqua/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/perangkat")({
  head: () => ({
    meta: [
      { title: "Perangkat IoT — Aqua Sentinel" },
      { name: "description", content: "Status sensor pH, TDS, DS18B20, Google Sheets, dan alamat pengiriman data." },
      { property: "og:title", content: "Perangkat IoT — Aqua Sentinel" },
      { property: "og:description", content: "Status sensor dan alamat pengiriman data." },
    ],
  }),
  component: Devices,
});

function Devices() {
  const { latest, settings, source, sheetsOk, sheetsMessage, engine, lastSync } = useAqua();
  const age = latest ? (Date.now() - new Date(latest.timestamp).getTime()) / 1000 : null;
  const fresh = age !== null && age <= settings.staleThresholdSec;
  const sensorState = source === "demo" ? "Simulasi" : fresh ? "Aktif" : latest ? "Data lama" : "Belum ada data";
  const sensorTone = source === "demo" ? "warn" : fresh ? "normal" : "danger";
  const [endpoint, setEndpoint] = useState("/api/public/telemetry");
  useEffect(() => setEndpoint(`${window.location.origin}/api/public/telemetry`), []);

  const sensors = [
    { name: "Sensor pH", icon: FlaskConical, value: latest ? latest.ph.toFixed(2) : "—", desc: "Tingkat keasaman air" },
    { name: "Sensor TDS", icon: Droplets, value: latest ? `${Math.round(latest.tds)} ppm` : "—", desc: "Jumlah zat terlarut" },
    { name: "Sensor Suhu DS18B20", icon: Thermometer, value: latest ? `${latest.temperature.toFixed(1)} °C` : "—", desc: "Suhu air" },
  ];
  const services = [
    { name: "Google Sheets", icon: Sheet, state: source === "demo" ? "Belum dihubungkan" : sheetsOk ? "Terhubung" : "Error", tone: source === "demo" ? "warn" : sheetsOk ? "normal" : "danger", desc: sheetsMessage },
    { name: "Mesin AI Python", icon: BrainCircuit, state: engine.state === "ready" ? "Aktif" : engine.state === "error" ? "Gagal" : "Memuat", tone: engine.state === "ready" ? "normal" : engine.state === "error" ? "danger" : "warn", desc: engine.version ?? engine.stage },
  ];

  return (
    <div>
      <PageHeader title="Perangkat IoT" sub="Status sensor dan layanan yang terhubung" />
      <div className="grid gap-4 md:grid-cols-3">
        {sensors.map((s, i) => (
          <Card key={s.name} className="lift" delay={i * 70}>
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-accent p-2.5 text-accent-foreground"><s.icon className="h-5 w-5" /></div>
              <Badge tone={sensorTone} text={sensorState} />
            </div>
            <p className="mt-4 text-sm font-bold">{s.name}</p>
            <p className="text-xs text-muted-foreground">{s.desc}</p>
            <p className="mt-3 font-display text-2xl font-extrabold">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{age !== null ? `Pembacaan ${Math.max(0, Math.round(age))} detik lalu` : "Belum ada pembacaan"}</p>
          </Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {services.map((s, i) => (
          <Card key={s.name} delay={220 + i * 70}>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-accent p-2.5 text-accent-foreground"><s.icon className="h-5 w-5" /></div>
              <div className="flex-1">
                <p className="text-sm font-bold">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
              <Badge tone={s.tone} text={s.state} />
            </div>
          </Card>
        ))}
      </div>
      <Card className="mt-4" delay={360}>
        <CardTitle title="Alamat Pengiriman Data" sub="Kirim data sensor ke alamat ini dengan metode POST (format JSON)" />
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted p-3 font-mono text-xs">
          <span className="rounded bg-brand px-2 py-0.5 font-bold text-primary-foreground">POST</span>
          <span className="flex-1 break-all">{endpoint}</span>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(endpoint); toast.success("Alamat disalin"); }}><Copy />Salin</Button>
        </div>
        <pre className="mt-3 overflow-auto rounded-xl bg-tooltip p-4 text-xs text-tooltip-foreground">{`{ "ph": 7.12, "tds": 245, "temperature": 27.4 }`}</pre>
        <p className="mt-3 text-xs text-muted-foreground">Sinkron terakhir: {lastSync ? lastSync.toLocaleTimeString("id-ID") : "—"}</p>
      </Card>
    </div>
  );
}

function Badge({ tone, text }: { tone: string; text: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", tone === "normal" ? "bg-normal-soft text-normal" : tone === "warn" ? "bg-warn-soft text-warn" : "bg-danger-soft text-danger")}>
      <span className={cn("h-1.5 w-1.5 rounded-full pulse-dot", tone === "normal" ? "bg-normal" : tone === "warn" ? "bg-warn" : "bg-danger")} />
      {text}
    </span>
  );
}
