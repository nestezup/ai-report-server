import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";

import { analyzeSample } from "./agent.js";
import { getSample, listSamples, upsertSample } from "./db.js";
import { collectNotionSource } from "./notion.js";
import { createReport, listReports } from "./reports.js";

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

app.get("/api/reports", async (c) => {
  return c.json({ ok: true, reports: await listReports() });
});

app.post("/api/reports", async (c) => {
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
  const report = await createReport({ sample, analysis });
  return c.json({ ok: true, report, analysis });
});

app.post("/api/notion/collect", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const queryText = typeof body?.query === "string" ? body.query.trim() : "";
  const sample = await collectNotionSource({ queryText });
  const saved = await upsertSample(sample);
  return c.json({ ok: true, sample: saved });
});

app.use("/*", serveStatic({ root: "./public" }));
