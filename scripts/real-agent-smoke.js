import { getSample } from "../src/db.js";
import { analyzeSample } from "../src/agent.js";
import { collectNotionSource } from "../src/notion.js";

const sample = await getSample("creator-weekly-brief");
const analysis = await analyzeSample(sample);
console.log("real agent analysis smoke");
console.log(JSON.stringify({ summary: analysis.summary, ideas: analysis.contentIdeas?.length }, null, 2));

if (process.env.NOTION_MODE === "real") {
  const notion = await collectNotionSource({ queryText: "최근 콘텐츠 메모 한 건의 제목과 본문 일부" });
  console.log("real notion mcp smoke");
  console.log(JSON.stringify({ title: notion.title, bodyLength: notion.body.length }, null, 2));
}

