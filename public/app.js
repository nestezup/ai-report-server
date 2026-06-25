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

async function loadSamples() {
  const { samples } = await fetchJson("/api/samples");
  samplesEl.innerHTML = samples
    .map(
      (sample) => `
      <article class="card">
        <div>
          <p class="meta">${sample.source} / ${sample.tags.join(", ")}</p>
          <h3>${sample.title}</h3>
        </div>
        <button data-sample-id="${sample.id}">리포트 생성</button>
      </article>
    `,
    )
    .join("");
}

async function loadReports() {
  const { reports } = await fetchJson("/api/reports");
  reportsEl.innerHTML =
    reports.length === 0
      ? '<p class="empty">아직 생성된 리포트가 없습니다.</p>'
      : reports
          .map(
            (report) => `
      <a class="report-card" href="${report.url}">
        <strong>${report.title}</strong>
        <span>${report.summary}</span>
      </a>
    `,
          )
          .join("");
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
