import { serve } from "@hono/node-server";

import { app } from "./app.js";

const port = Number(process.env.PORT || 4174);
const requestedHostname = process.env.HOST || "127.0.0.1";
const hostname = ["127.0.0.1", "localhost", "::1"].includes(requestedHostname) ? requestedHostname : "127.0.0.1";

serve({ fetch: app.fetch, hostname, port }, (info) => {
  console.log(`AI report server listening on http://${hostname}:${info.port}`);
});
