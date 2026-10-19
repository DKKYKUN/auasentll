import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, paramStatus, thresholdBreaches, validateTelemetry } from "./rules";

describe("aqua rules", () => {
  it("rejects pH above 14", () => {
    expect(validateTelemetry({ ph: 14.5, tds: 100, temperature: 25 }).valid).toBe(false);
  });
  it("rejects negative TDS", () => {
    expect(validateTelemetry({ ph: 7, tds: -1, temperature: 25 }).valid).toBe(false);
  });
  it("accepts a valid reading without device id", () => {
    const r = validateTelemetry({ ph: 7.1, tds: 230, temperature: 27.5 });
    expect(r.valid).toBe(true);
    if (r.valid) expect(Object.keys(r.data).sort()).toEqual(["ph", "tds", "temperature", "timestamp"]);
  });
  it("default ideal range is pH 6.5–8.5, TDS ≤ 500, suhu 15–35", () => {
    expect(paramStatus("ph", 6.4, DEFAULT_SETTINGS)).toBe("WASPADA");
    expect(paramStatus("ph", 8.5, DEFAULT_SETTINGS)).toBe("NORMAL");
    expect(paramStatus("tds", 501, DEFAULT_SETTINGS)).toBe("WASPADA");
    expect(paramStatus("temperature", 36, DEFAULT_SETTINGS)).toBe("WASPADA");
  });
  it("lists every breached threshold", () => {
    expect(thresholdBreaches({ ph: 9, tds: 600, temperature: 25, timestamp: "" }, DEFAULT_SETTINGS)).toHaveLength(2);
  });
});
