import { createFileRoute } from "@tanstack/react-router";
import { validateTelemetry } from "@/lib/aqua/rules";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors } });
}

// Endpoint the sensor box POSTs to: { ph, tds, temperature }.
export const Route = createFileRoute("/api/public/telemetry")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const key = process.env.TELEMETRY_API_KEY;
        if (key && request.headers.get("x-api-key") !== key) return json({ error: "UNAUTHORIZED" }, 401);
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "INVALID_JSON" }, 400);
        }
        const v = validateTelemetry(body);
        if (!v.valid) return json({ error: "VALIDATION_FAILED", errors: v.errors }, 422);
        const base = process.env.GOOGLE_SHEETS_WEBAPP_URL;
        if (!base) return json({ error: "NOT_CONFIGURED", message: "Google Sheets belum dihubungkan." }, 503);
        try {
          const res = await fetch(base, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "append", ...v.data }),
            redirect: "follow",
          });
          if (!res.ok) return json({ error: "SHEETS_UNAVAILABLE" }, 502);
          return json({ status: "success", received: v.data }, 201);
        } catch {
          return json({ error: "SHEETS_UNAVAILABLE" }, 502);
        }
      },
    },
  },
});
