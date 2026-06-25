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
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export function normalizeNotionPayload(payload) {
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "Notion MCP 수집 자료";
  const tags = Array.isArray(payload.tags) && payload.tags.length > 0 ? payload.tags : ["notion"];
  const body = typeof payload.body === "string" && payload.body.trim() ? payload.body.trim() : "Notion MCP에서 제목만 수집되었습니다.";
  return { title, tags, body };
}

export function getNotionAllowedTools() {
  if (process.env.NOTION_ALLOWED_TOOLS) {
    return process.env.NOTION_ALLOWED_TOOLS.split(",").map((toolName) => toolName.trim()).filter(Boolean);
  }
  return [
    "mcp__notion__search",
    "mcp__notion__fetch",
    "mcp__notion__read_page",
    "mcp__notion__get_page",
    "mcp__notion__query_database",
    "mcp__notion__list_pages",
  ];
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
  for await (const message of query({
    prompt,
    options: {
      allowedTools: getNotionAllowedTools(),
      disallowedTools: [
        "mcp__notion__create_page",
        "mcp__notion__update_page",
        "mcp__notion__delete_page",
        "mcp__notion__append_block_children",
        "mcp__notion__create_database",
        "mcp__notion__update_database",
      ],
      maxTurns: 6,
      permissionMode: "dontAsk",
      settingSources: ["user", "project", "local"],
      strictMcpConfig: false,
    },
  })) {
    messages.push(message);
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
