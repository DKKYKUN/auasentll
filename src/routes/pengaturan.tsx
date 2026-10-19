import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardTitle, PageHeader } from "@/components/aqua/ui";
import { useAqua } from "@/lib/aqua/store";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/aqua/rules";

export const Route = createFileRoute("/pengaturan")({
  head: () => ({
    meta: [
      { title: "Pengaturan — Aqua Sentinel" },
      { name: "description", content: "Atur ambang batas pH, TDS, suhu dan interval pembaruan data." },
      { property: "og:title", content: "Pengaturan — Aqua Sentinel" },
      { property: "og:description", content: "Atur ambang batas pH, TDS, suhu dan interval pembaruan." },
    ],
  }),
  component: SettingsPage,
});

const FIELDS: { key: keyof Settings; label: string; step: number; scale?: number }[] = [
  { key: "phMin", label: "pH minimum", step: 0.1 },
  { key: "phMax", label: "pH maksimum", step: 0.1 },
  { key: "tdsMax", label: "TDS maksimum (ppm)", step: 10 },
  { key: "tempMin", label: "Suhu minimum (°C)", step: 0.5 },
  { key: "tempMax", label: "Suhu maksimum (°C)", step: 0.5 },
  { key: "pollInterval", label: "Interval pembaruan (detik)", step: 1, scale: 1000 },
  { key: "staleThresholdSec", label: "Data dianggap lama setelah (detik)", step: 10 },
];

function SettingsPage() {
  const { settings, setSettings } = useAqua();
  const [form, setForm] = useState(settings);
  useEffect(() => setForm(settings), [settings]);

  return (
    <div>
      <PageHeader title="Pengaturan" sub="Ambang batas dipakai untuk status Waspada & peringatan" />
      <Card className="max-w-2xl">
        <CardTitle title="Ambang Batas & Pembaruan" />
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                type="number"
                step={f.step}
                value={f.scale ? form[f.key] / f.scale : form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) * (f.scale ?? 1) })}
              />
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-2">
          <Button
            onClick={() => {
              if (form.phMin >= form.phMax || form.tempMin >= form.tempMax || form.pollInterval < 2000) {
                toast.error("Periksa kembali: nilai minimum harus lebih kecil dari maksimum, interval minimal 2 detik.");
                return;
              }
              setSettings(form);
              toast.success("Pengaturan disimpan");
            }}
          >
            <Save />Simpan
          </Button>
          <Button variant="outline" onClick={() => { setSettings(DEFAULT_SETTINGS); toast("Dikembalikan ke bawaan"); }}><RotateCcw />Bawaan</Button>
        </div>
      </Card>
    </div>
  );
}
