import { serve } from "@hono/node-server";

import { app } from "./app.js";

const port = Number(process.env.PORT || 4174);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`AI report server listening on http://127.0.0.1:${info.port}`);
});

