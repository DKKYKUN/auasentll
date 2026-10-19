import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS, thresholdBreaches, type Reading, type Settings, type Status } from "./rules";
import { getTelemetry } from "./sheets.functions";

export const MIN_SAMPLES = 10;

export type AiPoint = { score: number; status: Exclude<Status, "TIDAK CUKUP DATA"> };
export type AiResult = {
  points: AiPoint[];
  contrib: { feature: string; z: number }[];
  mean: number[];
  corr: number[][];
  anomaly_count: number;
  n_estimators: number;
  features: number;
  ms: number;
  analyzedAt: string;
};
export type Engine = { state: "loading" | "ready" | "error"; stage: string; progress: number; version?: string; error?: string };
export type Source = "sheets" | "demo";

type Ctx = {
  settings: Settings;
  setSettings: (s: Settings) => void;
  rows: Reading[];
  latest: Reading | null;
  source: Source | null;
  sheetsMessage: string;
  sheetsOk: boolean;
  lastSync: Date | null;
  paused: boolean;
  setPaused: (p: boolean) => void;
  refresh: () => void;
  engine: Engine;
  ai: AiResult | null;
  aiStatus: Status;
  scoredRows: (Reading & { score: number | null; status: Status })[];
};

const AquaCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "aqua_sentinel_settings_v2";

// ---- demo stream (used only while Google Sheets is not connected) ----
function demoReading(t: number, prev?: Reading): Reading {
  const base = prev ?? { ph: 7.2, tds: 240, temperature: 27, timestamp: "" };
  const drift = (v: number, target: number, k: number, noise: number) => v + (target - v) * k + (Math.random() - 0.5) * noise;
  let ph = drift(base.ph, 7.2, 0.15, 0.12);
  let tds = drift(base.tds, 245, 0.12, 12);
  let temperature = drift(base.temperature, 27 + Math.sin(t / 3.6e6) * 1.5, 0.2, 0.25);
  if (Math.random() < 0.04) {
    const pick = Math.floor(Math.random() * 3);
    if (pick === 0) ph += Math.random() > 0.5 ? 1.6 : -1.5;
    else if (pick === 1) tds += 320 + Math.random() * 200;
    else temperature += 6;
  }
  return { timestamp: new Date(t).toISOString(), ph: +ph.toFixed(2), tds: Math.max(0, Math.round(tds)), temperature: +temperature.toFixed(1) };
}
function seedDemo(n: number, stepMs: number): Reading[] {
  const out: Reading[] = [];
  const start = Date.now() - n * stepMs;
  for (let i = 0; i < n; i++) out.push(demoReading(start + i * stepMs, out[i - 1]));
  return out;
}

export function AquaProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [rows, setRows] = useState<Reading[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const [sheetsMessage, setSheetsMessage] = useState("Menghubungkan…");
  const [sheetsOk, setSheetsOk] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [paused, setPaused] = useState(false);
  const [engine, setEngine] = useState<Engine>({ state: "loading", stage: "Menyiapkan…", progress: 5 });
  const [ai, setAi] = useState<AiResult | null>(null);
  const [aiRows, setAiRows] = useState<Reading[]>([]);

  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);
  const pending = useRef<Map<number, Reading[]>>(new Map());
  const busy = useRef(false);
  const fetching = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettingsState({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  const setSettings = useCallback((s: Settings) => {
    setSettingsState(s);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, []);

  // Python ML engine
  useEffect(() => {
    const w = new Worker(new URL("./ai.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "stage") setEngine({ state: "loading", stage: m.stage, progress: m.progress });
      else if (m.type === "ready") setEngine({ state: "ready", stage: "Siap", progress: 100, version: m.version });
      else if (m.type === "result") {
        busy.current = false;
        const r = pending.current.get(m.id);
        pending.current.delete(m.id);
        if (r) {
          setAiRows(r);
          setAi({ ...m.result, analyzedAt: new Date().toISOString() });
        }
      } else if (m.type === "error") {
        busy.current = false;
        if (m.id === undefined) setEngine({ state: "error", stage: "Gagal", progress: 0, error: m.message });
        else setEngine((en) => (en.state === "ready" ? en : { state: "error", stage: "Gagal", progress: 0, error: m.message }));
      }
    };
    w.postMessage({ type: "init" });
    return () => w.terminate();
  }, []);

  const poll = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const res = await getTelemetry({ data: { limit: 200 } });
      if (!res.configured) {
        setSource("demo");
        setSheetsOk(false);
        setSheetsMessage(res.message);
        setRows((prev) => {
          const base = prev.length ? prev : seedDemo(60, settings.pollInterval);
          const next = [...base, demoReading(Date.now(), base[base.length - 1])];
          return next.slice(-200);
        });
      } else {
        setSource("sheets");
        setSheetsOk(res.ok);
        setSheetsMessage(res.message);
        if (res.ok) setRows(res.rows.slice(-200));
      }
      setLastSync(new Date());
    } catch {
      setSheetsOk(false);
      setSheetsMessage("Koneksi ke server terputus.");
    } finally {
      fetching.current = false;
    }
  }, [settings.pollInterval]);

  useEffect(() => {
    if (paused) return;
    poll();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, settings.pollInterval);
    return () => clearInterval(id);
  }, [poll, paused, settings.pollInterval]);

  // Send to Python whenever data or thresholds change
  useEffect(() => {
    const w = workerRef.current;
    if (!w || engine.state !== "ready" || rows.length < MIN_SAMPLES || busy.current) return;
    busy.current = true;
    const id = ++reqId.current;
    pending.current.set(id, rows);
    w.postMessage({ type: "analyze", id, rows, thresholds: settings });
  }, [rows, settings, engine.state]);

  const scoredRows = useMemo(() => {
    const map = new Map<string, AiPoint>();
    if (ai) aiRows.forEach((r, i) => ai.points[i] && map.set(r.timestamp, ai.points[i]));
    return rows.map((r) => {
      const p = map.get(r.timestamp);
      const fallback: Status = thresholdBreaches(r, settings).length ? "WASPADA" : "NORMAL";
      return { ...r, score: p?.score ?? null, status: p?.status ?? (rows.length < MIN_SAMPLES ? "TIDAK CUKUP DATA" : fallback) };
    });
  }, [rows, ai, aiRows, settings]);

  const latest = rows.length ? rows[rows.length - 1] : null;
  const aiStatus: Status = scoredRows.length ? scoredRows[scoredRows.length - 1].status : "TIDAK CUKUP DATA";

  const value: Ctx = {
    settings, setSettings, rows, latest, source, sheetsMessage, sheetsOk, lastSync, paused, setPaused,
    refresh: poll, engine, ai, aiStatus, scoredRows,
  };
  return <AquaCtx.Provider value={value}>{children}</AquaCtx.Provider>;
}

export function useAqua() {
  const c = useContext(AquaCtx);
  if (!c) throw new Error("useAqua must be used inside AquaProvider");
  return c;
}
