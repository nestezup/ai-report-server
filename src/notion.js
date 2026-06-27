import { query } from "@anthropic-ai/claude-agent-sdk";

function parseText(messages) {
  const chunks = [];
  for (const message of messages) {
    if (message.type === "assistant" && Array.isArray(message.message?.content)) {
      for (const content of message.message.content) {
        if (content.type === "text") chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

function buildSampleId(title) {
  return `notion-${title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54)}`;
}

export function parseNotionJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) return JSON.parse(fenced[1]);

  const embeddedFence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (embeddedFence) return JSON.parse(embeddedFence[1]);

  return JSON.parse(trimmed);
}

export function normalizeNotionPayload(payload) {
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "Notion MCP 수집 자료";
  const tags = Array.isArray(payload.tags) && payload.tags.length > 0 ? payload.tags : ["notion"];
  const body = typeof payload.body === "string" && payload.body.trim() ? payload.body.trim() : "Notion MCP에서 제목만 수집되었습니다.";
  return { title, tags, body };
}

function normalizePublishPayload(payload) {
  if (payload?.status === "published" && payload.verified === true && typeof payload.url === "string" && payload.url.trim()) {
    return {
      status: "published",
      url: payload.url.trim(),
      title: typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "Notion 리포트",
      verified: true,
    };
  }

  return {
    status: "failed",
    reason: typeof payload?.reason === "string" && payload.reason.trim() ? payload.reason.trim() : "notion_publish_failed",
  };
}

function normalizePublishText(text, fallbackTitle) {
  try {
    return normalizePublishPayload(parseNotionJson(text));
  } catch {
    const notionUrl = text.match(/https:\/\/(?:www\.)?notion\.so\/[^\s)\]]+/)?.[0];
    if (notionUrl) {
      return {
        status: "published",
        url: notionUrl,
        title: fallbackTitle,
        verified: true,
      };
    }
    return { status: "failed", reason: "notion_publish_returned_non_json" };
  }
}

export function getNotionAllowedTools() {
  const safeToolPattern = /^mcp__notion__[a-z0-9_-]+$/i;
  const unsafeActionPattern = /(create|update|delete|append|write|patch|insert|remove)/i;
  if (process.env.NOTION_ALLOWED_TOOLS) {
    return process.env.NOTION_ALLOWED_TOOLS
      .split(",")
      .map((toolName) => toolName.trim())
      .filter((toolName) => safeToolPattern.test(toolName) && !unsafeActionPattern.test(toolName));
  }
  return [
    "mcp__notion__notion-fetch",
    "mcp__notion__notion-search",
    "mcp__notion__notion-query-data-sources",
    "mcp__notion__notion-query-database-view",
    "mcp__notion__notion-get-comments",
  ];
}

export async function publishReportToNotion({ sample, analysis, report, queryRunner = query }) {
  if ((process.env.NOTION_REPORTS_MODE || "mock") !== "real" || !process.env.NOTION_REPORT_PARENT_URL) {
    return { status: "skipped", reason: "notion_reports_not_configured" };
  }

  const prompt = [
    "Notion MCP를 사용해서 아래 AI 리포트를 Notion 페이지로 적재해 주세요.",
    "반드시 대상 Notion URL 아래에 새 페이지를 만드는 작업만 수행하세요.",
    "대상 URL은 일반 페이지, 데이터베이스, 데이터베이스 뷰 URL일 수 있습니다.",
    "페이지를 만든 뒤에는 반드시 notion-fetch로 방금 만든 페이지를 다시 조회해 실제 생성 여부를 검증하세요.",
    `대상 Notion URL: ${process.env.NOTION_REPORT_PARENT_URL}`,
    "반드시 JSON만 반환하세요.",
    "스키마: { status: \"published\", url: string, title: string, verified: true } 또는 { status: \"failed\", reason: string }",
    "",
    `제목: ${sample.title} 리포트`,
    `원본 자료 ID: ${sample.id}`,
    `태그: ${sample.tags.join(", ")}`,
    `생성 시각: ${report.createdAt}`,
    `로컬 리포트 경로: ${report.url}`,
    `모델: ${analysis.model}`,
    "",
    `요약: ${analysis.summary}`,
    `대상 독자: ${analysis.audience}`,
    "콘텐츠 아이디어:",
    ...analysis.contentIdeas.map((item, index) => `${index + 1}. ${item}`),
    "다음 작업:",
    ...analysis.nextActions.map((item, index) => `${index + 1}. ${item}`),
  ].join("\n");

  const messages = [];
  try {
    for await (const message of queryRunner({
      prompt,
      options: {
        allowedTools: ["mcp__notion__notion-create-pages", "mcp__notion__notion-fetch"],
        disallowedTools: [
          "mcp__notion__notion-update-page",
          "mcp__notion__notion-move-pages",
          "mcp__notion__notion-duplicate-page",
          "mcp__notion__notion-create-database",
          "mcp__notion__notion-update-data-source",
          "mcp__notion__notion-create-view",
          "mcp__notion__notion-update-view",
          "mcp__notion__notion-create-comment",
        ],
        maxTurns: 8,
        permissionMode: "dontAsk",
        settingSources: ["user", "project", "local"],
        strictMcpConfig: false,
      },
    })) {
      messages.push(message);
    }
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "notion_publish_failed",
    };
  }

  return normalizePublishText(parseText(messages), `${sample.title} 리포트`);
}

export async function collectNotionSource({ queryText }) {
  if ((process.env.NOTION_MODE || "mock") === "mock") {
    const title = "Notion MCP 수집 샘플";
    return {
      id: buildSampleId(title),
      title,
      source: "notion-mcp",
      tags: ["notion", "mcp", "collected"],
      body: [
        "Notion 연결이 불안정할 때도 수업 흐름을 유지하기 위한 수집 샘플입니다.",
        "자료 수집 단계에서는 HTML을 만들지 않고 제목, 태그, 본문만 정리합니다.",
        "분석과 리포트 생성은 기존 /api/analyze, /api/reports 흐름에서 처리합니다.",
        queryText ? `수집 요청: ${queryText}` : "수집 요청: 최근 콘텐츠 메모",
      ].join("\n"),
    };
  }

  const prompt = [
    "Notion MCP만 사용해서 자료를 수집해 주세요.",
    "분석하거나 HTML을 만들지 마세요.",
    "반드시 JSON만 반환하세요.",
    "스키마: { title: string, tags: string[], body: string }",
    `수집 요청: ${queryText || "최근 콘텐츠 메모 한 건을 찾아 제목과 핵심 본문을 가져오기"}`,
  ].join("\n");

  const messages = [];
  try {
    for await (const message of query({
      prompt,
      options: {
        allowedTools: getNotionAllowedTools(),
        disallowedTools: [
          "mcp__notion__notion-create-pages",
          "mcp__notion__notion-update-page",
          "mcp__notion__notion-move-pages",
          "mcp__notion__notion-duplicate-page",
          "mcp__notion__notion-create-database",
          "mcp__notion__notion-update-data-source",
          "mcp__notion__notion-create-view",
          "mcp__notion__notion-update-view",
          "mcp__notion__notion-create-comment",
        ],
        maxTurns: 12,
        permissionMode: "dontAsk",
        settingSources: ["user", "project", "local"],
        strictMcpConfig: false,
      },
    })) {
      messages.push(message);
    }
  } catch (error) {
    return {
      id: buildSampleId("Notion MCP 수집 실패"),
      title: "Notion MCP 수집 실패",
      source: "notion-mcp",
      tags: ["notion", "mcp-warning"],
      body: `Notion MCP 호출 중 오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
    };
  }

  const text = parseText(messages);
  let parsed;
  try {
    parsed = parseNotionJson(text);
  } catch {
    parsed = {
      title: "Notion MCP 수집 상태 확인",
      tags: ["notion", "mcp-warning"],
      body: text || "Notion MCP에서 JSON 자료를 반환하지 않았습니다.",
    };
  }
  const { title, tags, body } = normalizeNotionPayload(parsed);
  return {
    id: buildSampleId(title),
    title,
    source: "notion-mcp",
    tags,
    body,
  };
}
