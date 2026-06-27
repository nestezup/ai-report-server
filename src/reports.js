import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultReportsDir = join(rootDir, "public", "reports");
let indexWriteQueue = Promise.resolve();

export function getReportsDir() {
  return process.env.REPORTS_DIR || defaultReportsDir;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

async function readIndex(reportsDir = getReportsDir()) {
  try {
    const raw = await readFile(join(reportsDir, "index.json"), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return [];
  }
}

async function writeIndex(reports, reportsDir = getReportsDir()) {
  await mkdir(reportsDir, { recursive: true });
  const indexPath = join(reportsDir, "index.json");
  const tempPath = join(reportsDir, `.index.${process.pid}.${Date.now()}.tmp`);
  await writeFile(tempPath, `${JSON.stringify(reports, null, 2)}\n`);
  await rename(tempPath, indexPath);
}

function renderReportHtml({ sample, analysis, createdAt }) {
  const contentIdeas = Array.isArray(analysis.contentIdeas) ? analysis.contentIdeas : [];
  const nextActions = Array.isArray(analysis.nextActions) ? analysis.nextActions : [];
  const ideas = contentIdeas.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const actions = nextActions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(sample.title)} 리포트</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body class="report-page">
  <main class="report-shell">
    <a class="back-link" href="/">홈으로</a>
    <p class="eyebrow">AI 콘텐츠 리포트</p>
    <h1>${escapeHtml(sample.title)}</h1>
    <p class="summary">${escapeHtml(analysis.summary)}</p>
    <section>
      <h2>대상 독자</h2>
      <p>${escapeHtml(analysis.audience)}</p>
    </section>
    <section>
      <h2>콘텐츠 아이디어</h2>
      <ol>${ideas}</ol>
    </section>
    <section>
      <h2>다음 작업</h2>
      <ol>${actions}</ol>
    </section>
    <footer>생성 시각: ${escapeHtml(createdAt)} / 모델: ${escapeHtml(analysis.model)}</footer>
  </main>
</body>
</html>
`;
}

export async function listReports() {
  const reports = await readIndex();
  return reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createReport({ sample, analysis }) {
  const reportsDir = getReportsDir();
  await mkdir(reportsDir, { recursive: true });

  const createdAt = new Date().toISOString();
  const slug = `${createdAt.replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}-${slugify(sample.id || sample.title)}.html`;
  const html = renderReportHtml({ sample, analysis, createdAt });
  await writeFile(join(reportsDir, slug), html);

  const report = {
    id: basename(slug, ".html"),
    sampleId: sample.id,
    title: sample.title,
    summary: analysis.summary,
    url: `/reports/${slug}`,
    createdAt,
  };

  const writeTask = indexWriteQueue.catch(() => undefined).then(async () => {
    const nextIndex = [report, ...(await readIndex(reportsDir)).filter((item) => item.id !== report.id)];
    await writeIndex(nextIndex, reportsDir);
  });
  indexWriteQueue = writeTask.catch(() => undefined);
  await writeTask;

  return report;
}

export async function updateReportNotionResult(reportId, notion) {
  const reportsDir = getReportsDir();
  const writeTask = indexWriteQueue.catch(() => undefined).then(async () => {
    const reports = await readIndex(reportsDir);
    const nextIndex = reports.map((item) => (item.id === reportId ? { ...item, notion } : item));
    await writeIndex(nextIndex, reportsDir);
  });
  indexWriteQueue = writeTask.catch(() => undefined);
  await writeTask;
}
