const samplesEl = document.querySelector("#samples");
const reportsEl = document.querySelector("#reports");
const statusEl = document.querySelector("#status");
const activeJobs = new Set();

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function updateJobStatus(text) {
  if (activeJobs.size > 0) {
    setStatus(`${activeJobs.size}개 리포트 생성 중 / ${text}`);
    return;
  }
  setStatus(text);
}

function clear(element) {
  element.replaceChildren();
}

function createElement(tagName, { className, text, href, dataset } = {}) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  if (href) element.href = href;
  if (dataset) {
    for (const [key, value] of Object.entries(dataset)) {
      element.dataset[key] = value;
    }
  }
  return element;
}

async function loadSamples() {
  const { samples } = await fetchJson("/api/samples");
  clear(samplesEl);
  for (const sample of samples) {
    const card = createElement("article", { className: "card" });
    const body = createElement("div");
    body.append(
      createElement("p", { className: "meta", text: `${sample.source} / ${sample.tags.join(", ")}` }),
      createElement("h3", { text: sample.title }),
    );
    card.append(
      body,
      createElement("button", { text: "리포트 생성", dataset: { sampleId: sample.id } }),
      createElement("p", { className: "card-status", text: "대기 중" }),
    );
    samplesEl.append(card);
  }
}

async function loadReports() {
  const { reports } = await fetchJson("/api/reports");
  clear(reportsEl);
  if (reports.length === 0) {
    reportsEl.append(createElement("p", { className: "empty", text: "아직 생성된 리포트가 없습니다." }));
    return;
  }

  for (const report of reports) {
    const card = createElement("a", { className: "report-card", href: report.url });
    card.append(
      createElement("strong", { text: report.title }),
      createElement("span", { text: report.summary }),
    );
    if (report.notion?.status === "published") {
      card.append(createElement("span", { className: "notion-link", text: `Notion MCP 적재 완료: ${report.notion.title}` }));
    }
    reportsEl.append(card);
  }
}

samplesEl.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-sample-id]");
  if (!button) return;

  button.disabled = true;
  activeJobs.add(button.dataset.sampleId);
  const card = button.closest(".card");
  const cardStatus = card.querySelector(".card-status");
  card.classList.add("is-working");
  cardStatus.textContent = "Agent SDK 분석과 Notion MCP 적재를 실행 중입니다";
  updateJobStatus("Agent SDK와 Notion MCP가 작업 중입니다");
  try {
    const result = await fetchJson("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sampleId: button.dataset.sampleId }),
    });
    if (result.notion?.status === "published") {
      cardStatus.textContent = "완료 / Notion MCP 적재 검증됨";
      updateJobStatus("최근 작업 완료 / Notion MCP 적재 검증됨");
    } else if (result.notion?.status === "failed") {
      cardStatus.textContent = `리포트 완료 / Notion MCP 실패: ${result.notion.reason}`;
      updateJobStatus(`최근 작업 완료 / Notion MCP 실패: ${result.notion.reason}`);
    } else {
      cardStatus.textContent = "리포트 완료 / Notion MCP 적재 꺼짐";
      updateJobStatus("최근 작업 완료 / Notion MCP 적재 꺼짐");
    }
    await loadReports();
  } catch (error) {
    cardStatus.textContent = `실패: ${error.message}`;
    updateJobStatus(`실패: ${error.message}`);
  } finally {
    activeJobs.delete(button.dataset.sampleId);
    card.classList.remove("is-working");
    button.disabled = false;
    if (activeJobs.size === 0 && !cardStatus.textContent.startsWith("실패")) {
      setStatus(cardStatus.textContent);
    }
  }
});

document.querySelector("#refresh").addEventListener("click", async () => {
  await loadSamples();
  await loadReports();
});

document.querySelector("#collect-notion").addEventListener("click", async () => {
  setStatus("Notion MCP로 자료 가져오는 중");
  try {
    await fetchJson("/api/notion/collect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "다음 발행 콘텐츠 후보" }),
    });
    setStatus("Notion MCP 자료 가져오기 완료");
    await loadSamples();
  } catch (error) {
    setStatus(`자료 가져오기 실패: ${error.message}`);
  }
});

await loadSamples();
await loadReports();
