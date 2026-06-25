import { query } from "@anthropic-ai/claude-agent-sdk";

function buildMockAnalysis(sample) {
  const tagLine = sample.tags.join(", ");
  return {
    sampleId: sample.id,
    title: sample.title,
    model: "mock-agent",
    summary: `${sample.title} 자료는 ${tagLine} 맥락에서 바로 실행할 수 있는 콘텐츠 흐름으로 정리할 수 있습니다.`,
    audience: "자료를 빠르게 이해하고 다음 발행 주제를 고르려는 실무자",
    contentIdeas: [
      `${sample.title}에서 반복되는 질문을 체크리스트로 바꾸기`,
      "실패했을 때 사용할 대안 데이터와 프롬프트 함께 제공하기",
      "결과 화면을 먼저 보여주고 단계별 요청으로 되짚기",
    ],
    nextActions: [
      "핵심 문제를 한 문장으로 압축합니다.",
      "수집 자료와 분석 요청을 분리합니다.",
      "HTML 리포트로 저장한 뒤 홈 목록에서 확인합니다.",
    ],
  };
}

function parseSdkText(messages) {
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

export async function analyzeSample(sample) {
  if ((process.env.AI_MODE || "mock") === "mock") {
    return buildMockAnalysis(sample);
  }

  const prompt = [
    "다음 자료를 콘텐츠 리포트로 분석해 주세요.",
    "반드시 JSON만 반환하세요.",
    "스키마: { summary: string, audience: string, contentIdeas: string[], nextActions: string[] }",
    "",
    `제목: ${sample.title}`,
    `태그: ${sample.tags.join(", ")}`,
    `본문: ${sample.body}`,
  ].join("\n");

  const messages = [];
  for await (const message of query({
    prompt,
    options: {
      maxTurns: 3,
      permissionMode: "default",
    },
  })) {
    messages.push(message);
  }

  const text = parseSdkText(messages);
  const parsed = JSON.parse(text);
  return {
    sampleId: sample.id,
    title: sample.title,
    model: "claude-agent-sdk",
    summary: parsed.summary,
    audience: parsed.audience,
    contentIdeas: parsed.contentIdeas,
    nextActions: parsed.nextActions,
  };
}

