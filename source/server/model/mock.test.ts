import { describe, expect, it } from "vitest";
import { createModelClient } from "./index.ts";
import { MOCK_FAIL, MOCK_REFUSE, createMockModelClient } from "./mock.ts";
import type { ModelRequest } from "./types.ts";

function request(content: string): ModelRequest {
  return { kind: "interviewer", system: "abcd", messages: [{ role: "user", content }] };
}

describe("createMockModelClient", () => {
  it("plays scripted steps in order and records each request", async () => {
    const client = createMockModelClient({ steps: [{ text: "first" }, { text: "second" }] });

    expect((await client.complete(request("a"))).text).toBe("first");
    expect((await client.complete(request("b"))).text).toBe("second");
    expect(client.calls.map((c) => c.messages[0]?.content)).toEqual(["a", "b"]);
  });

  it("estimates usage from text, with thinking adding output tokens", async () => {
    const client = createMockModelClient({ steps: [{ text: "12345678", thinkingTokens: 300 }] });

    // system "abcd" + message "efgh" = 8 chars = 2 tokens; reply 8 chars = 2 tokens.
    const result = await client.complete(request("efgh"));

    expect(result.usage).toEqual({ input: 2, output: 302, cacheWrite: 0, cacheRead: 0 });
  });

  it("lets a step set usage exactly", async () => {
    const client = createMockModelClient({
      steps: [{ text: "hi", usage: { input: 90_000, cacheRead: 5_000 } }],
    });

    const result = await client.complete(request("x"));

    expect(result.usage).toMatchObject({ input: 90_000, cacheRead: 5_000 });
  });

  it("rejects on an error step", async () => {
    const client = createMockModelClient({ steps: [{ error: new Error("timeout") }] });

    await expect(client.complete(request("x"))).rejects.toThrow("timeout");
  });

  it("returns a refusal with no text", async () => {
    const client = createMockModelClient({ steps: [{ text: "ignored", stopReason: "refusal" }] });

    const result = await client.complete(request("x"));

    expect(result).toMatchObject({ text: "", stopReason: "refusal" });
  });

  it("streams deltas that add up to the full reply", async () => {
    const client = createMockModelClient({ steps: [{ text: "Tell me about fan-out." }] });
    const deltas: string[] = [];

    const result = await client.complete(request("x"), (d) => deltas.push(d));

    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.join("")).toBe(result.text);
  });

  it("falls back to a canned reply when the script runs out", async () => {
    const client = createMockModelClient();

    const result = await client.complete(request("hello"));

    expect(result.text).toContain("No API call was made");
    expect(result.stopReason).toBe("end_turn");
  });

  it("fails or refuses on the dev trigger phrases", async () => {
    const client = createMockModelClient();

    await expect(client.complete(request(`please ${MOCK_FAIL}`))).rejects.toThrow();
    expect((await client.complete(request(MOCK_REFUSE))).stopReason).toBe("refusal");
  });
});

describe("createModelClient", () => {
  it("returns the mock when MODEL_CLIENT=mock", () => {
    expect(createModelClient({ MODEL_CLIENT: "mock" })).toHaveProperty("calls");
  });
});
