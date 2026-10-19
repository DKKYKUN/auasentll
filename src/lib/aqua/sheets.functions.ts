import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Reading } from "./rules";

export type TelemetryResponse = {
  configured: boolean;
  ok: boolean;
  message: string;
  rows: Reading[]; // oldest first
  checkedAt: string;
};

function toReading(r: Record<string, unknown>): Reading | null {
  const ph = Number(r.ph);
  const tds = Number(r.tds);
  const temperature = Number(r.temperature ?? r.suhu);
  const ts = r.timestamp ? new Date(String(r.timestamp)) : null;
  if (!ts || Number.isNaN(ts.getTime()) || [ph, tds, temperature].some((n) => Number.isNaN(n))) return null;
  return { timestamp: ts.toISOString(), ph, tds, temperature };
}

export const getTelemetry = createServerFn({ method: "GET" })
  .validator((d: { limit?: number }) => z.object({ limit: z.number().int().min(1).max(1000).optional() }).parse(d))
  .handler(async ({ data }): Promise<TelemetryResponse> => {
    const checkedAt = new Date().toISOString();
    const base = process.env.GOOGLE_SHEETS_WEBAPP_URL;
    if (!base) return { configured: false, ok: false, message: "Google Sheets belum dihubungkan.", rows: [], checkedAt };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(`${base}?action=history&limit=${data.limit ?? 200}`, { signal: controller.signal, redirect: "follow" });
      if (!res.ok) return { configured: true, ok: false, message: `Google Sheets merespon status ${res.status}.`, rows: [], checkedAt };
      const json = (await res.json()) as unknown;
      const list = Array.isArray(json) ? json : ((json as { rows?: unknown[] })?.rows ?? []);
      const rows = (list as Record<string, unknown>[])
        .map(toReading)
        .filter((r): r is Reading => r !== null)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      return { configured: true, ok: true, message: "Google Sheets terhubung.", rows, checkedAt };
    } catch (e) {
      const msg = (e as Error).name === "AbortError" ? "Google Sheets melebihi batas waktu." : "Gagal menghubungi Google Sheets.";
      return { configured: true, ok: false, message: msg, rows: [], checkedAt };
    } finally {
      clearTimeout(timer);
    }
  });
