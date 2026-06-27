import assert from "node:assert/strict";
import { test } from "node:test";

import { getNotionAllowedTools, normalizeNotionPayload, parseNotionJson, publishReportToNotion } from "../src/notion.js";

test("parseNotionJson accepts fenced JSON from model responses", () => {
  const parsed = parseNotionJson('```json\n{"title":"테스트","tags":["notion"],"body":"본문"}\n```');
  assert.deepEqual(parsed, { title: "테스트", tags: ["notion"], body: "본문" });
});

test("parseNotionJson accepts embedded fenced JSON from MCP status responses", () => {
  const parsed = parseNotionJson('상태 확인\n```json\n{"title":"테스트","tags":["notion"],"body":"본문"}\n```');
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

test("getNotionAllowedTools ignores wildcard and mutating env tools", () => {
  process.env.NOTION_ALLOWED_TOOLS =
    "mcp__notion__*,mcp__notion__notion-search,mcp__notion__notion-update-page,mcp__notion__notion-fetch";
  try {
    assert.deepEqual(getNotionAllowedTools(), ["mcp__notion__notion-search", "mcp__notion__notion-fetch"]);
  } finally {
    delete process.env.NOTION_ALLOWED_TOOLS;
  }
});

test("publishReportToNotion skips unless real report publishing is configured", async () => {
  const result = await publishReportToNotion({
    sample: { id: "sample", title: "샘플", tags: ["test"], body: "본문" },
    analysis: { model: "test", summary: "요약", audience: "독자", contentIdeas: [], nextActions: [] },
    report: { url: "/reports/sample.html" },
  });

  assert.deepEqual(result, { status: "skipped", reason: "notion_reports_not_configured" });
});

test("publishReportToNotion creates a Notion page when configured", async () => {
  process.env.NOTION_REPORTS_MODE = "real";
  process.env.NOTION_REPORT_PARENT_URL = "https://www.notion.so/example-parent";

  try {
    const result = await publishReportToNotion({
      sample: { id: "sample", title: "샘플", tags: ["test"], body: "본문" },
      analysis: {
        model: "claude-agent-sdk",
        summary: "요약",
        audience: "독자",
        contentIdeas: ["아이디어"],
        nextActions: ["액션"],
      },
      report: { url: "/reports/sample.html", createdAt: "2026-06-27T00:00:00.000Z" },
      queryRunner: async function* () {
        yield {
          type: "assistant",
          message: {
            content: [
              {
                type: "text",
                text: '```json\n{"status":"published","url":"https://www.notion.so/report-page","title":"샘플 리포트","verified":true}\n```',
              },
            ],
          },
        };
      },
    });

    assert.deepEqual(result, {
      status: "published",
      url: "https://www.notion.so/report-page",
      title: "샘플 리포트",
      verified: true,
    });
  } finally {
    delete process.env.NOTION_REPORTS_MODE;
    delete process.env.NOTION_REPORT_PARENT_URL;
  }
});
