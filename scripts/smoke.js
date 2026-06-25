const baseUrl = process.env.BASE_URL || "http://127.0.0.1:4174";

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  console.log(`${options?.method || "GET"} ${path} -> ${response.status}`);
  console.log(JSON.stringify(body, null, 2));
  if (!response.ok) process.exitCode = 1;
  return body;
}

await request("/health");
await request("/api/samples");
await request("/api/analyze", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ sampleId: "creator-weekly-brief" }),
});
await request("/api/reports", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ sampleId: "creator-weekly-brief" }),
});
await request("/api/reports");

