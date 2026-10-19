export type Reading = {
  timestamp: string;
  ph: number;
  tds: number;
  temperature: number;
};

export type Status = "NORMAL" | "WASPADA" | "ANOMALI" | "TIDAK CUKUP DATA";

export type Settings = {
  pollInterval: number;
  phMin: number;
  phMax: number;
  tdsMax: number;
  tempMin: number;
  tempMax: number;
  staleThresholdSec: number;
};

export const DEFAULT_SETTINGS: Settings = {
  pollInterval: 5000,
  phMin: 6.5,
  phMax: 8.5,
  tdsMax: 500,
  tempMin: 15,
  tempMax: 35,
  staleThresholdSec: 120,
};

/** Validates a payload sent by the sensor box. pH 0–14, TDS ≥ 0, suhu -10–100 °C. */
export function validateTelemetry(body: unknown):
  | { valid: true; data: Reading }
  | { valid: false; errors: string[] } {
  const errors: string[] = [];
  if (!body || typeof body !== "object") return { valid: false, errors: ["Payload harus JSON object."] };
  const b = body as Record<string, unknown>;
  const ph = Number(b.ph);
  const tds = Number(b.tds);
  const temperature = Number(b.temperature ?? b.suhu);
  if (b.ph === undefined || Number.isNaN(ph) || ph < 0 || ph > 14) errors.push("ph harus angka 0 - 14.");
  if (b.tds === undefined || Number.isNaN(tds) || tds < 0) errors.push("tds harus angka >= 0.");
  if (Number.isNaN(temperature) || temperature < -10 || temperature > 100)
    errors.push("temperature harus angka -10 - 100 °C.");
  let timestamp = new Date().toISOString();
  if (b.timestamp) {
    const t = new Date(String(b.timestamp));
    if (Number.isNaN(t.getTime())) errors.push("timestamp tidak valid (ISO 8601).");
    else timestamp = t.toISOString();
  }
  if (errors.length) return { valid: false, errors };
  return { valid: true, data: { ph, tds, temperature, timestamp } };
}

/** Threshold-only check for one reading (used alongside the ML score). */
export function thresholdBreaches(r: Reading, s: Settings): string[] {
  const out: string[] = [];
  if (r.ph < s.phMin) out.push(`pH ${r.ph.toFixed(2)} di bawah batas ${s.phMin}`);
  if (r.ph > s.phMax) out.push(`pH ${r.ph.toFixed(2)} di atas batas ${s.phMax}`);
  if (r.tds > s.tdsMax) out.push(`TDS ${Math.round(r.tds)} ppm melebihi ${s.tdsMax} ppm`);
  if (r.temperature < s.tempMin) out.push(`Suhu ${r.temperature.toFixed(1)}°C di bawah ${s.tempMin}°C`);
  if (r.temperature > s.tempMax) out.push(`Suhu ${r.temperature.toFixed(1)}°C di atas ${s.tempMax}°C`);
  return out;
}

export function paramStatus(kind: "ph" | "tds" | "temperature", v: number | null, s: Settings): Status {
  if (v === null || Number.isNaN(v)) return "TIDAK CUKUP DATA";
  if (kind === "ph") {
    if (v < s.phMin - 1 || v > s.phMax + 1) return "ANOMALI";
    if (v < s.phMin || v > s.phMax) return "WASPADA";
  } else if (kind === "tds") {
    if (v > s.tdsMax * 2) return "ANOMALI";
    if (v > s.tdsMax) return "WASPADA";
  } else {
    if (v < s.tempMin - 5 || v > s.tempMax + 5) return "ANOMALI";
    if (v < s.tempMin || v > s.tempMax) return "WASPADA";
  }
  return "NORMAL";
}
