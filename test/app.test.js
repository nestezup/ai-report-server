import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

import { app } from "../src/app.js";
import { normalizeNotionPayload, parseNotionJson } from "../src/notion.js";
import { analyzeSample, parseAgentJson } from "../src/agent.js";
import { createReport } from "../src/reports.js";

let suiteDir;

before(async () => {
  suiteDir = await mkdtemp(join(tmpdir(), "ai-report-suite-"));
  process.env.APP_DB_PATH = join(suiteDir, "app.db");
});

after(async () => {
  delete process.env.APP_DB_PATH;
  await rm(suiteDir, { recursive: true, force: true });
});

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

test("POST routes reject non-JSON content types", async () => {
  const response = await app.request("/api/analyze", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ sampleId: "creator-weekly-brief" }),
  });

  assert.equal(response.status, 415);
  assert.deepEqual(await response.json(), { ok: false, error: "content_type_must_be_application_json" });
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

test("createReport keeps all concurrent reports in the index", async () => {
  const reportDir = await mkdtemp(join(tmpdir(), "ai-report-concurrent-"));
  process.env.REPORTS_DIR = reportDir;

  try {
    const sample = {
      id: "concurrent-sample",
      title: "동시 생성 테스트",
      tags: ["test"],
      body: "본문",
    };
    const analysis = {
      model: "test",
      summary: "동시 생성 요약",
      audience: "테스터",
      contentIdeas: ["아이디어 A"],
      nextActions: ["액션 A"],
    };

    await Promise.all(Array.from({ length: 5 }, () => createReport({ sample, analysis })));
    const index = JSON.parse(await readFile(join(reportDir, "index.json"), "utf8"));
    assert.equal(index.length, 5);
  } finally {
    delete process.env.REPORTS_DIR;
    await rm(reportDir, { recursive: true, force: true });
  }
});

test("createReport recovers after a corrupt report index is repaired", async () => {
  const reportDir = await mkdtemp(join(tmpdir(), "ai-report-corrupt-"));
  process.env.REPORTS_DIR = reportDir;

  try {
    const sample = {
      id: "corrupt-index-sample",
      title: "손상 인덱스 테스트",
      tags: ["test"],
      body: "본문",
    };
    const analysis = {
      model: "test",
      summary: "손상 인덱스 요약",
      audience: "테스터",
      contentIdeas: ["아이디어 A"],
      nextActions: ["액션 A"],
    };

    await writeFile(join(reportDir, "index.json"), "{broken");
    await assert.rejects(() => createReport({ sample, analysis }), SyntaxError);

    await writeFile(join(reportDir, "index.json"), "[]");
    await createReport({ sample, analysis });
    const index = JSON.parse(await readFile(join(reportDir, "index.json"), "utf8"));
    assert.equal(index.length, 1);
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

test("parseNotionJson accepts fenced JSON from model responses", () => {
  const parsed = parseNotionJson('```json\n{"title":"테스트","tags":["notion"],"body":"본문"}\n```');
  assert.deepEqual(parsed, { title: "테스트", tags: ["notion"], body: "본문" });
});

test("normalizeNotionPayload fills required fields from sparse MCP output", () => {
  const normalized = normalizeNotionPayload({ title: "", tags: [], body: "  " });
  assert.deepEqual(normalized, {
    title: "Notion MCP 수집 자료",
    tags: ["notion"],
    body: "Notion MCP에서 제목만 수집되었습니다.",
  });
});

test("parseNotionJson rejects non-JSON MCP status text", () => {
  assert.throws(() => parseNotionJson("Notion MCP가 연결되어 있지 않습니다."), /Unexpected token/);
});

test("parseAgentJson accepts fenced JSON", () => {
  assert.deepEqual(parseAgentJson('```json\n{"summary":"요약","contentIdeas":["A"],"nextActions":["B"]}\n```'), {
    summary: "요약",
    contentIdeas: ["A"],
    nextActions: ["B"],
  });
});

test("analyzeSample real mode falls back when the agent returns unusable JSON", async () => {
  const sample = {
    id: "broken-agent",
    title: "깨진 에이전트 응답",
    tags: ["agent"],
    body: "테스트 본문",
  };
  const analysis = await analyzeSample(sample, {
    queryRunner: async function* () {
      yield {
        type: "assistant",
        message: { content: [{ type: "text", text: "JSON이 아닌 응답" }] },
      };
    },
  });
  assert.equal(analysis.sampleId, "broken-agent");
  assert.equal(analysis.model, "mock-agent-fallback");
  assert.ok(Array.isArray(analysis.contentIdeas));
});
