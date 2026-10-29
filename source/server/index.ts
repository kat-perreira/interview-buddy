import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createApp } from "./app.ts";
import { SESSION_SWEEP_INTERVAL_MS } from "./config.ts";
import { createModelClient } from "./model/index.ts";
import { loadFeedbackPrompt, loadSystemPrompt } from "./prompts.ts";
import { createSessionStore } from "./session/store.ts";

// || rather than ??, so a blank PORT= falls back too (Number("") is 0, a random port).
const port = Number(process.env.PORT || 8787);

const store = createSessionStore();
store.startSweep(SESSION_SWEEP_INTERVAL_MS);

const root = new Hono();
root.route(
  "/",
  createApp({
    modelClient: createModelClient(),
    store,
    systemPrompt: loadSystemPrompt(),
    feedbackPrompt: loadFeedbackPrompt(),
  }),
);

// In dev, Vite serves the client and proxies /api here.
// In production, this server serves the built client from dist/.
if (process.env.NODE_ENV === "production") {
  root.use("/*", serveStatic({ root: "./dist" }));
}

serve({ fetch: root.fetch, port }, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`);
});
