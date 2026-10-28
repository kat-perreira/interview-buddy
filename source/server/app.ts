import { Hono } from "hono";

// Routes live here, separate from the Node listener in index.ts,
// so tests can call app.request() without starting a server.
export const app = new Hono().basePath("/api");

app.get("/health", (c) => c.json({ ok: true }));
