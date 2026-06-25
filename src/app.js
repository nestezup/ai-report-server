import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";

import { analyzeSample } from "./agent.js";
import { getSample, listSamples } from "./db.js";

export const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "ai-report-server" }));

app.get("/api/samples", async (c) => {
  return c.json({ ok: true, samples: await listSamples() });
});

app.get("/api/samples/:id", async (c) => {
  const sample = await getSample(c.req.param("id"));
  if (!sample) {
    return c.json({ ok: false, error: "sample_not_found" }, 404);
  }
  return c.json({ ok: true, sample });
});

app.post("/api/analyze", async (c) => {
  const body = await c.req.json().catch(() => null);
  const sampleId = typeof body?.sampleId === "string" ? body.sampleId.trim() : "";
  if (!sampleId) {
    return c.json({ ok: false, error: "sample_id_required" }, 400);
  }

  const sample = await getSample(sampleId);
  if (!sample) {
    return c.json({ ok: false, error: "sample_not_found" }, 404);
  }

  const analysis = await analyzeSample(sample);
  return c.json({ ok: true, analysis });
});

app.use("/*", serveStatic({ root: "./public" }));
