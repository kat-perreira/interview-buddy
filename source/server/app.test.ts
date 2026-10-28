import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { createMockModelClient } from "./model/mock.ts";
import { createSessionStore } from "./session/store.ts";

describe("GET /api/health", () => {
  it("responds ok", async () => {
    const app = createApp({ modelClient: createMockModelClient(), store: createSessionStore() });

    const res = await app.request("/api/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
