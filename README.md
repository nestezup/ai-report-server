# AI Report Server

Node 24, Hono, Claude Agent SDK, Notion MCP를 함께 사용하는 작은 AI 서버 튜터 레포입니다.

이 레포는 수강생이 그대로 제출하는 정답지가 아닙니다. 수강생이 자기 서비스를 만들 때 옆에 열어두고 참고하는 완성본이자 튜터입니다.

수업에서는 먼저 이 레포를 실행해 완성 흐름을 확인합니다. 그다음 AI에게 구조를 설명시키고, 필요한 부분을 참고하면서 자기 목적에 맞는 작은 AI 서버를 단계별로 만들어봅니다.

## 이 레포를 사용하는 방법

1. 먼저 완성본을 실행해서 전체 흐름을 봅니다.
2. AI에게 이 레포의 구조와 파일 역할을 설명하게 합니다.
3. 새 프로젝트를 만들거나 자기 프로젝트를 열고, 이 레포를 참고 자료로 둡니다.
4. 한 번에 전부 복사하지 않고, 지금 단계에 필요한 코드만 AI에게 요청합니다.
5. 매 단계 실행해서 화면과 서버 응답을 확인합니다.
6. 마지막에는 샘플 데이터를 자기 데이터와 서비스 목적에 맞게 바꿉니다.

핵심은 코드를 외우는 것이 아니라, 완성된 구조를 읽고 AI와 함께 자기 서비스로 바꾸는 감각을 익히는 것입니다.

## 수업에서 만드는 흐름

1. 홈 화면에서 샘플 자료를 선택합니다.
2. `/api/analyze`가 Agent SDK를 호출해 자료를 분석합니다.
3. `/api/notion/collect`가 미리 인증된 Notion MCP 도구로 자료를 수집합니다.
4. `/api/reports`가 분석 결과를 HTML 리포트로 저장합니다.
5. 설정을 켜면 같은 리포트를 Notion MCP로 Notion 페이지에도 적재합니다.
6. 홈 화면의 리포트 목록에 생성 결과가 쌓입니다.

## 준비물

- Node.js 24 이상
- Claude Code 또는 Claude Agent SDK를 사용할 수 있는 인증 상태
- Notion MCP 연결 상태

Notion MCP가 연결되어 있지 않아도 기본 실습은 mock 모드로 진행할 수 있습니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 다음 주소를 엽니다.

```txt
http://127.0.0.1:4174
```

## 테스트

```bash
npm test
```

## 실습용 모드

기본값은 mock 모드입니다. 이 모드에서는 실제 AI나 Notion 연결 없이도 전체 흐름을 확인할 수 있습니다.

```bash
npm run dev
```

실제 Agent SDK 분석을 사용하려면:

```bash
AI_MODE=real npm run dev
```

실제 Notion MCP 수집까지 사용하려면:

```bash
NOTION_MODE=real npm run dev
```

AI 분석과 Notion 자료 수집을 둘 다 켜려면:

```bash
AI_MODE=real NOTION_MODE=real npm run dev
```

생성된 리포트를 Notion 페이지에도 적재하려면 대상 Notion 페이지 URL을 지정합니다.
여기서 중요한 점은 Notion API 키를 직접 발급하거나 REST API를 직접 호출하지 않는다는 것입니다.
이미 인증되어 있는 Notion MCP 도구를 Agent SDK가 호출합니다.

```bash
AI_MODE=real \
NOTION_REPORTS_MODE=real \
NOTION_REPORT_PARENT_URL="https://app.notion.com/p/..." \
npm run dev
```

이 모드는 Notion MCP를 통해 Notion에 새 페이지를 만드는 쓰기 작업입니다. 수업에서는 강사가 준비한 테스트 페이지를 대상으로 먼저 확인하고, 수강생은 자기 워크스페이스에서 별도 테스트 페이지를 만든 뒤 사용합니다.

수업의 핵심은 다음 한 문장입니다.

```txt
복잡한 Notion 인증은 MCP가 맡고, 우리 서버는 미리 인증된 MCP 도구를 호출합니다.
```

## Notion MCP 도구명

Agent SDK의 `allowedTools`에는 Notion MCP의 전체 도구명을 넣습니다.

```js
allowedTools: [
  "mcp__notion__notion-fetch",
  "mcp__notion__notion-search",
  "mcp__notion__notion-query-data-sources",
  "mcp__notion__notion-query-database-view",
]
```

짧은 이름 `notion-fetch`는 사람이 읽기 쉬운 도구명이고, Agent SDK에서 허용할 때는 `mcp__notion__notion-fetch`처럼 긴 이름을 사용합니다.

## AI와 함께 읽을 때 사용할 프롬프트

```txt
이 프로젝트를 처음 보는 수강생 기준으로 설명해줘.
어떤 파일이 어떤 역할을 하는지 알려주고,
홈 화면에서 버튼을 눌렀을 때 서버, Agent SDK, Notion MCP, HTML 리포트가 어떤 순서로 연결되는지 설명해줘.
```

```txt
이 레포를 튜터처럼 참고해서 지금 단계에 필요한 최소 코드만 만들어줘.
아직 다음 단계 기능은 넣지 말고, 실행 확인이 가능한 상태로 만들어줘.
```

```txt
내가 만들 서비스는 [서비스 설명]이야.
이 레포의 구조를 참고해서 어떤 파일을 어떤 순서로 바꾸면 되는지 알려줘.
먼저 전체 계획을 짧게 잡고, 1단계부터 실행 가능한 코드로 진행해줘.
```

## 주요 파일

- `src/server.js`: 로컬 서버 시작
- `src/app.js`: API 라우트
- `src/agent.js`: Agent SDK 분석
- `src/notion.js`: Notion MCP 자료 수집
- `src/reports.js`: HTML 리포트 생성
- `src/db.js`: SQLite 샘플 데이터 저장
- `public/`: 홈 화면
- `data/sample-fixtures.json`: 수업용 더미 데이터

## 수업 운영 메모

이 레포는 정답지가 아니라 기준점입니다. 먼저 실행해서 완성 흐름을 본 뒤, AI에게 구조를 설명시키고, 작은 서버부터 단계별로 다시 구성하는 방식으로 사용합니다.

수강생에게는 “이 레포를 복사해서 끝내는 것”이 아니라 “이 레포를 튜터로 삼아 내 서비스를 만드는 것”이 목표라고 안내합니다.
