const samplesEl = document.querySelector("#samples");
const reportsEl = document.querySelector("#reports");
const statusEl = document.querySelector("#status");

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

function setStatus(text) {
  statusEl.textContent = text;
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
    reportsEl.append(card);
  }
}

samplesEl.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-sample-id]");
  if (!button) return;

  button.disabled = true;
  setStatus("AI 분석 중");
  try {
    await fetchJson("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sampleId: button.dataset.sampleId }),
    });
    setStatus("리포트 생성 완료");
    await loadReports();
  } catch (error) {
    setStatus(`실패: ${error.message}`);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#refresh").addEventListener("click", async () => {
  await loadSamples();
  await loadReports();
});

document.querySelector("#collect-notion").addEventListener("click", async () => {
  setStatus("Notion 자료 수집 중");
  try {
    await fetchJson("/api/notion/collect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "다음 발행 콘텐츠 후보" }),
    });
    setStatus("Notion 자료 수집 완료");
    await loadSamples();
  } catch (error) {
    setStatus(`수집 실패: ${error.message}`);
  }
});

await loadSamples();
await loadReports();
