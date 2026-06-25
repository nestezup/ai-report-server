import assert from "node:assert/strict";
import { test } from "node:test";

import { app } from "../src/app.js";

test("GET /health returns service status", async () => {
  const response = await app.request("/health");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: "ai-report-server" });
});

test("GET /api/samples returns seeded sample metadata", async () => {
  const response = await app.request("/api/samples");
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.ok, true);
  assert.ok(body.samples.length >= 3);
  assert.ok(body.samples.every((sample) => sample.id && sample.title));
});

