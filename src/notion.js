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
      allowedTools: ["mcp__notion__*"],
      maxTurns: 6,
      permissionMode: "dontAsk",
      settingSources: ["user", "project", "local"],
      strictMcpConfig: false,
    },
  })) {
    messages.push(message);
  }

  const parsed = parseNotionJson(parseText(messages));
  return {
    id: buildSampleId(parsed.title),
    title: parsed.title,
    source: "notion-mcp",
    tags: Array.isArray(parsed.tags) ? parsed.tags : ["notion"],
    body: parsed.body,
  };
}
