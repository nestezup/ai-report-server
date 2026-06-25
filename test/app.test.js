import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("POST /api/analyze returns an AI analysis for a seeded sample", async () => {
  const response = await app.request("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sampleId: "creator-weekly-brief" }),
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.analysis.sampleId, "creator-weekly-brief");
  assert.ok(body.analysis.summary.length > 20);
  assert.ok(body.analysis.contentIdeas.length >= 3);
});

test("POST /api/analyze rejects malformed requests", async () => {
  const response = await app.request("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sampleId: "" }),
  });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.deepEqual(body, { ok: false, error: "sample_id_required" });
});

test("POST /api/reports creates HTML report and updates report index", async () => {
  const reportDir = await mkdtemp(join(tmpdir(), "ai-report-test-"));
  process.env.REPORTS_DIR = reportDir;

  try {
    const response = await app.request("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sampleId: "local-shop-review" }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.match(body.report.url, /^\/reports\/.+\.html$/);

    const indexResponse = await app.request("/api/reports");
    const indexBody = await indexResponse.json();
    assert.equal(indexBody.ok, true);
    assert.equal(indexBody.reports.length, 1);
    assert.equal(indexBody.reports[0].sampleId, "local-shop-review");
  } finally {
    delete process.env.REPORTS_DIR;
    await rm(reportDir, { recursive: true, force: true });
  }
});

test("POST /api/notion/collect stores collected source without generating HTML", async () => {
  const reportDir = await mkdtemp(join(tmpdir(), "ai-report-notion-test-"));
  process.env.NOTION_MODE = "mock";
  process.env.REPORTS_DIR = reportDir;

  try {
    const response = await app.request("/api/notion/collect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "다음 주 발행 아이디어" }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.sample.source, "notion-mcp");
    assert.ok(body.sample.body.includes("자료 수집 단계"));

    const reportResponse = await app.request("/api/reports");
    const reportBody = await reportResponse.json();
    assert.equal(reportBody.reports.some((report) => report.sampleId === body.sample.id), false);
  } finally {
    delete process.env.NOTION_MODE;
    delete process.env.REPORTS_DIR;
    await rm(reportDir, { recursive: true, force: true });
  }
});
