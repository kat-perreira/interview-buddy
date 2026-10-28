import { Hono } from "hono";
import type { ModelClient } from "./model/types.ts";
import type { SessionStore } from "./session/store.ts";

export interface AppDeps {
  modelClient: ModelClient;
  store: SessionStore;
}

// Routes live here, separate from the Node listener in index.ts,
// so tests can call app.request() without starting a server.
// Dependencies are passed in so tests can use the mock client and a fake clock.
// Session routes (next plan tasks) will use `deps`.
export function createApp(deps: AppDeps) {
  const app = new Hono().basePath("/api");

  app.get("/health", (c) => c.json({ ok: true }));

  return app;
}
