import { describe, expect, it, vi } from "vitest";
import { createModelClient } from "./index.ts";
import { parseFeedback } from "../../shared/feedback.ts";
import {
  MOCK_FAIL,
  MOCK_FEEDBACK_FAIL,
  MOCK_FEEDBACK_FAIL_ONCE,
  MOCK_REFUSE,
  createMockModelClient,
  mockFeedback,
} from "./mock.ts";
import type { ModelRequest } from "./types.ts";
import { MAX_CANDIDATE_TURNS, WRAP_UP_TURN } from "../config.ts";
import { KICKOFF_MESSAGE, turnNote } from "../session/request.ts";

function request(content: string, kind: ModelRequest["kind"] = "interviewer"): ModelRequest {
  return { kind, system: "abcd", messages: [{ role: "user", content }] };
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

    const result = await client.complete(request("x"), { onText: (d) => deltas.push(d) });

    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.join("")).toBe(result.text);
  });

  it("falls back to a canned reply when the script runs out", async () => {
    const client = createMockModelClient();

    const result = await client.complete(request("hello"));

    expect(result.text).toContain("No API call was made");
    expect(result.stopReason).toBe("end_turn");
  });

  it("shows the call number and the turn it got in the canned reply, without brackets", async () => {
    const client = createMockModelClient();

    const opening = await client.complete(request(KICKOFF_MESSAGE));
    const wrapUp = await client.complete(request(`${turnNote(WRAP_UP_TURN)}\n\nhello`));

    expect(opening.text).toContain("(call 1 since server start): opening,");
    expect(wrapUp.text).toContain(
      `(call 2 since server start): turn ${WRAP_UP_TURN} of ${MAX_CANDIDATE_TURNS}, Wrap-up,`,
    );
    expect(wrapUp.text).not.toContain("[");
  });

  it("logs one [mock] line per call with its outcome when log is on", async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: string) => lines.push(line));
    const client = createMockModelClient({
      steps: [{ error: new Error("boom") }, { text: "", stopReason: "refusal" }],
      log: true,
    });

    await expect(client.complete(request(`${turnNote(1)}\n\nhi`))).rejects.toThrow();
    await client.complete(request("transcript", "feedback"));
    spy.mockRestore();

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\[mock\] call 1: interviewer, turn 1 of \d+, ~\d+ input tokens, error$/);
    expect(lines[1]).toMatch(/^\[mock\] call 2: feedback, transcript, ~\d+ input tokens, refusal$/);
  });

  it("logs an aborted stream as aborted", async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: string) => lines.push(line));
    const client = createMockModelClient({ steps: [{ text: "a long reply" }], delayMs: 1_000, log: true });
    const controller = new AbortController();

    const call = client.complete(request("x"), { signal: controller.signal });
    controller.abort();
    await expect(call).rejects.toBeDefined();
    spy.mockRestore();

    expect(lines).toEqual([expect.stringMatching(/, aborted$/)]);
  });

  it("fails or refuses on the dev trigger phrases", async () => {
    const client = createMockModelClient();

    await expect(client.complete(request(`please ${MOCK_FAIL}`))).rejects.toThrow();
    expect((await client.complete(request(MOCK_REFUSE))).stopReason).toBe("refusal");
  });

  it("returns valid feedback JSON for a feedback call", async () => {
    const client = createMockModelClient();

    const result = await client.complete(request("transcript", "feedback"));

    expect(parseFeedback(JSON.parse(result.text))).toEqual(mockFeedback());
  });

  // The feedback call sees the whole transcript, so an earlier [mock:fail] is in it.
  it("fails feedback only on its own trigger phrase", async () => {
    const client = createMockModelClient();

    await expect(client.complete(request(MOCK_FAIL, "feedback"))).resolves.toBeDefined();
    await expect(client.complete(request(MOCK_FEEDBACK_FAIL, "feedback"))).rejects.toThrow();
  });

  it("fails feedback once per transcript on the fail-once trigger", async () => {
    const client = createMockModelClient();
    const first = request(`Session A ${MOCK_FEEDBACK_FAIL_ONCE}`, "feedback");
    const other = request(`Session B ${MOCK_FEEDBACK_FAIL_ONCE}`, "feedback");

    await expect(client.complete(first)).rejects.toThrow();
    await expect(client.complete(first)).resolves.toBeDefined();
    await expect(client.complete(other)).rejects.toThrow();
  });

  it("rejects when the signal aborts mid-reply", async () => {
    const client = createMockModelClient({ steps: [{ text: "a long reply" }], delayMs: 1_000 });
    const controller = new AbortController();

    const call = client.complete(request("x"), { signal: controller.signal });
    controller.abort();

    await expect(call).rejects.toThrow();
  });

  it("rejects at once when the signal is already aborted", async () => {
    const client = createMockModelClient({ steps: [{ text: "reply" }], delayMs: 1_000 });
    const controller = new AbortController();
    controller.abort();

    await expect(client.complete(request("x"), { signal: controller.signal })).rejects.toThrow();
  });
});

describe("createModelClient", () => {
  it("returns the mock when MODEL_CLIENT=mock", () => {
    expect(createModelClient({ MODEL_CLIENT: "mock" })).toHaveProperty("calls");
  });
});
