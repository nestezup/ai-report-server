import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";

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

app.use("/*", serveStatic({ root: "./public" }));

