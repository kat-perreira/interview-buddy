import {
  APIConnectionTimeoutError,
  APIUserAbortError,
  BadRequestError,
  InternalServerError,
} from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FEEDBACK_SCHEMA } from "../shared/feedback.ts";
import { ERROR_MESSAGES } from "../shared/strings.ts";
import { createApp } from "./app.ts";
import { MAX_MESSAGE_CHARS } from "../shared/limits.ts";
import { MAX_CANDIDATE_TURNS } from "./config.ts";
import { createMockModelClient, mockFeedback, type MockStep } from "./model/mock.ts";
import type { ModelClient } from "./model/types.ts";
import { KICKOFF_MESSAGE, turnNote } from "./session/request.ts";
import { createSessionStore } from "./session/store.ts";

const SYSTEM = "system prompt";
const FEEDBACK_SYSTEM = "feedback prompt";

// The SDK's real error classes (constructing one makes no API call).
const headers = () => new Headers({ "request-id": "req_123" });
const serverError = () => new InternalServerError(500, undefined, "Internal error", headers());
const timeoutError = () => new APIConnectionTimeoutError();

function setup(options: { steps?: MockStep[]; client?: ModelClient } = {}) {
  const mock = createMockModelClient({ steps: options.steps });
  const store = createSessionStore();
  const app = createApp({
    modelClient: options.client ?? mock,
    store,
    systemPrompt: SYSTEM,
    feedbackPrompt: FEEDBACK_SYSTEM,
  });
  return { app, store, mock };
}

type App = ReturnType<typeof setup>["app"];

function post(app: App, path: string, body?: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function start(app: App): Promise<string> {
  const res = await post(app, "/api/sessions");
  expect(res.status).toBe(201);
  return (await res.json()).sessionId;
}

const sendTurn = (app: App, id: string, message: string) =>
  post(app, `/api/sessions/${id}/turns`, { message });

const endInterview = (app: App, id: string) => post(app, `/api/sessions/${id}/end`);

const getFeedback = (app: App, id: string) => post(app, `/api/sessions/${id}/feedback`);

// Scripted feedback reply: valid by default.
const feedbackStep = (feedback: unknown = mockFeedback()): MockStep => ({ text: JSON.stringify(feedback) });

// Wraps the mock so a test can hold the next call open and finish it on cue.
function createHeldClient() {
  const mock = createMockModelClient();
  let held: Promise<void> | null = null;
  let release = () => {};
  const client: ModelClient = {
    async complete(request, options) {
      if (held) await held;
      return mock.complete(request, options);
    },
  };
  return {
    client,
    holdNext() {
      held = new Promise((resolve) => {
        release = () => {
          held = null;
          resolve();
        };
      });
    },
    release: () => release(),
  };
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

describe("GET /api/health", () => {
  it("responds ok", async () => {
    const { app } = setup();

    const res = await app.request("/api/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("POST /api/sessions", () => {
  it("creates a session with Bubo's opening reply", async () => {
    const { app, store, mock } = setup({ steps: [{ text: "Hoo, hello." }] });

    const res = await post(app, "/api/sessions");
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({ reply: "Hoo, hello.", turn: 0, status: "active", endReason: null });
    expect(mock.calls[0]).toEqual({
      kind: "interviewer",
      system: SYSTEM,
      messages: [{ role: "user", content: KICKOFF_MESSAGE }],
    });
    expect(store.get(body.sessionId)?.transcript).toEqual([
      { role: "assistant", content: "Hoo, hello." },
    ]);
  });

  it("retries a failed opening once", async () => {
    const { app, mock } = setup({ steps: [{ error: timeoutError() }, { text: "Hello." }] });

    const res = await post(app, "/api/sessions");

    expect(res.status).toBe(201);
    expect(mock.calls).toHaveLength(2);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("discards the session and asks to try again when the opening fails twice", async () => {
    const { app, store } = setup({
      steps: [{ error: timeoutError() }, { text: "", stopReason: "refusal" }],
    });

    const res = await post(app, "/api/sessions");

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "start_failed" });
    expect(store.size).toBe(0);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]?.[0]).toContain("opening, attempt 1 of 2: APIConnectionTimeoutError");
    expect(warn.mock.calls[1]?.[0]).toContain("opening, attempt 2 of 2: refusal");
  });
});

describe("POST /api/sessions/:id/turns", () => {
  it("adds the message, gets a reply, and stores both without request-only text", async () => {
    const { app, store, mock } = setup({ steps: [{ text: "Opening." }, { text: "Good question." }] });
    const id = await start(app);

    const res = await sendTurn(app, id, "  Who sends notifications?  ");

    expect(await res.json()).toEqual({
      reply: "Good question.",
      turn: 1,
      status: "active",
      endReason: null,
    });
    expect(mock.calls[1]?.messages.at(-1)?.content).toBe(`${turnNote(1)}\n\nWho sends notifications?`);
    expect(store.get(id)?.transcript).toEqual([
      { role: "assistant", content: "Opening." },
      { role: "user", content: "Who sends notifications?" },
      { role: "assistant", content: "Good question." },
    ]);
  });

  it("adds usage from each call to the session", async () => {
    const usage = { input: 100, output: 20, cacheWrite: 5, cacheRead: 50 };
    const { app, store } = setup({ steps: [{ text: "Opening.", usage }, { text: "Reply.", usage }] });
    const id = await start(app);

    await sendTurn(app, id, "Hello");

    expect(store.get(id)?.tokensUsed).toBe(2 * (100 + 20 + 5 + 50));
    expect(store.get(id)?.lastCall).toEqual({ input: 155, output: 20 });
  });

  it("rejects an empty message without a model call", async () => {
    const { app, mock } = setup();
    const id = await start(app);

    const res = await sendTurn(app, id, "   ");

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "empty_message" });
    expect(mock.calls).toHaveLength(1);
  });

  it("rejects a body that is not JSON", async () => {
    const { app } = setup();
    const id = await start(app);

    const res = await app.request(`/api/sessions/${id}/turns`, { method: "POST", body: "hi" });

    expect(res.status).toBe(400);
  });

  it("accepts a message at the length limit and rejects one past it", async () => {
    const { app, store } = setup();
    const id = await start(app);

    const atLimit = await sendTurn(app, id, "a".repeat(MAX_MESSAGE_CHARS));
    const pastLimit = await sendTurn(app, id, "a".repeat(MAX_MESSAGE_CHARS + 1));

    expect(atLimit.status).toBe(200);
    expect(pastLimit.status).toBe(400);
    expect(await pastLimit.json()).toMatchObject({ error: "too_long" });
    expect(store.get(id)?.candidateTurns).toBe(1);
  });

  it("counts characters, not UTF-16 units, toward the length limit", async () => {
    const { app } = setup();
    const id = await start(app);

    const res = await sendTurn(app, id, "🦉".repeat(MAX_MESSAGE_CHARS));

    expect(res.status).toBe(200);
  });

  it("rejects an oversized body before reading it", async () => {
    const { app, mock } = setup();
    const id = await start(app);

    const res = await sendTurn(app, id, "a".repeat(MAX_MESSAGE_CHARS * 10));

    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ error: "too_long" });
    expect(mock.calls).toHaveLength(1);
  });

  it("stores Bubo's reply without surrounding whitespace", async () => {
    const { app, store } = setup({ steps: [{ text: "\n\nHoo, hello.  \n" }] });

    const { sessionId } = await (await post(app, "/api/sessions")).json();

    expect(store.get(sessionId)?.transcript[0]?.content).toBe("Hoo, hello.");
  });

  it("returns not found for an unknown session", async () => {
    const { app } = setup();

    const res = await sendTurn(app, "no-such-session", "Hello");

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "not_found" });
  });

  it("rejects a second message while Bubo is replying", async () => {
    const held = createHeldClient();
    const { app, store } = setup({ client: held.client });
    const id = await start(app);

    held.holdNext();
    const first = sendTurn(app, id, "First");
    await vi.waitFor(() => expect(store.get(id)?.busy).toBe(true));
    const second = await sendTurn(app, id, "Second");
    held.release();

    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: "busy" });
    expect((await first).status).toBe(200);
    expect(store.get(id)?.candidateTurns).toBe(1);
    expect(store.get(id)?.busy).toBe(false);
  });

  it("ends with turn_cap after Bubo replies to the last turn", async () => {
    const { app } = setup();
    const id = await start(app);

    for (let turn = 1; turn < MAX_CANDIDATE_TURNS; turn++) {
      const body = await (await sendTurn(app, id, `Message ${turn}`)).json();
      expect(body).toMatchObject({ turn, status: "active" });
    }
    const last = await (await sendTurn(app, id, "Last message")).json();
    const afterCap = await sendTurn(app, id, "One more");

    expect(last).toMatchObject({
      turn: MAX_CANDIDATE_TURNS,
      status: "feedback_pending",
      endReason: "turn_cap",
    });
    expect(last.reply).toEqual(expect.any(String));
    expect(afterCap.status).toBe(409);
    expect(await afterCap.json()).toMatchObject({ error: "interview_over" });
  });

  it("retries a failed reply once", async () => {
    const { app } = setup({ steps: [{ text: "Opening." }, { error: serverError() }, { text: "Reply." }] });
    const id = await start(app);

    const body = await (await sendTurn(app, id, "Hello")).json();

    expect(body).toMatchObject({ reply: "Reply.", status: "active" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("turn 1, attempt 1 of 2: InternalServerError 500 (request req_123)");
  });

  it("ends with interviewer_failed after two failures, keeping the message as a turn", async () => {
    const { app, store } = setup({
      steps: [{ text: "Opening." }, { error: serverError() }, { text: "   " }],
    });
    const id = await start(app);

    const body = await (await sendTurn(app, id, "Hello")).json();

    expect(body).toEqual({
      reply: null,
      message: ERROR_MESSAGES.interviewer_failed,
      turn: 1,
      status: "feedback_pending",
      endReason: "interviewer_failed",
    });
    expect(store.get(id)?.transcript.at(-1)).toEqual({ role: "user", content: "Hello" });
    expect(warn.mock.calls[1]?.[0]).toContain("attempt 2 of 2: empty reply");
  });

  it("never logs message text, even when an API error quotes it", async () => {
    const quoted = new BadRequestError(400, { message: "invalid: secret design details" }, undefined, headers());
    const { app } = setup({ steps: [{ text: "Opening." }, { error: quoted }, { error: quoted }] });
    const id = await start(app);

    await sendTurn(app, id, "secret design details");

    expect(warn).toHaveBeenCalledTimes(2);
    for (const [line] of warn.mock.calls) expect(line).not.toContain("secret");
  });

  it("keeps a reply cut off at max_tokens and logs it", async () => {
    const { app } = setup({ steps: [{ text: "Opening." }, { text: "A long", stopReason: "max_tokens" }] });
    const id = await start(app);

    const body = await (await sendTurn(app, id, "Hello")).json();

    expect(body).toMatchObject({ reply: "A long", status: "active" });
    expect(warn.mock.calls[0]?.[0]).toContain("reply hit max_tokens");
  });
});

describe("POST /api/sessions/:id/end", () => {
  it("ends the interview for feedback", async () => {
    const { app } = setup();
    const id = await start(app);
    await sendTurn(app, id, "Hello");

    const res = await endInterview(app, id);

    expect(await res.json()).toEqual({
      turn: 1,
      status: "feedback_pending",
      endReason: "candidate",
    });
    expect((await sendTurn(app, id, "More")).status).toBe(409);
    expect((await endInterview(app, id)).status).toBe(409);
  });

  it("drops Bubo's reply when the candidate ends mid-reply", async () => {
    const held = createHeldClient();
    const { app, store } = setup({ client: held.client });
    const id = await start(app);

    held.holdNext();
    const turn = sendTurn(app, id, "Last thought");
    await vi.waitFor(() => expect(store.get(id)?.busy).toBe(true));
    const ended = await endInterview(app, id);
    held.release();
    const body = await (await turn).json();

    expect(ended.status).toBe(200);
    expect(body).toMatchObject({ reply: null, status: "feedback_pending", endReason: "candidate" });
    expect(store.get(id)?.transcript.at(-1)).toEqual({ role: "user", content: "Last thought" });
  });

  it("skips the retry when the candidate ends during a failed attempt", async () => {
    const mock = createMockModelClient({ steps: [{ text: "Opening." }] });
    let failHeldCall = () => {};
    let calls = 0;
    const client: ModelClient = {
      complete(request, options) {
        calls++;
        if (calls === 1) return mock.complete(request, options);
        return new Promise((_, reject) => (failHeldCall = () => reject(serverError())));
      },
    };
    const { app, store } = setup({ client });
    const id = await start(app);

    const turn = sendTurn(app, id, "Hello");
    await vi.waitFor(() => expect(store.get(id)?.busy).toBe(true));
    await endInterview(app, id);
    failHeldCall();
    await turn;

    // The held call ignored the abort and failed anyway; it isn't logged, since End cancelled it.
    expect(calls).toBe(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it("cancels the call in flight so the dropped reply stops costing tokens", async () => {
    const mock = createMockModelClient({ steps: [{ text: "Opening." }] });
    let signal: AbortSignal | undefined;
    const client: ModelClient = {
      complete(request, options) {
        if (mock.calls.length === 0) return mock.complete(request, options);
        signal = options?.signal;
        // Rejects the way the SDK does when its request is aborted.
        return new Promise((_, reject) =>
          signal?.addEventListener("abort", () => reject(new APIUserAbortError())),
        );
      },
    };
    const { app, store } = setup({ client });
    const id = await start(app);

    const turn = sendTurn(app, id, "Hello");
    await vi.waitFor(() => expect(store.get(id)?.busy).toBe(true));
    await endInterview(app, id);
    const body = await (await turn).json();

    expect(signal?.aborted).toBe(true);
    expect(body).toMatchObject({ reply: null, status: "feedback_pending", endReason: "candidate" });
    expect(store.get(id)).toMatchObject({ busy: false, abortCall: null });
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns not found for an unknown session", async () => {
    const { app } = setup();

    expect((await endInterview(app, "no-such-session")).status).toBe(404);
  });
});

describe("POST /api/sessions/:id/feedback", () => {
  // Plays the opening and one turn, then ends the interview with End Interview.
  async function endedSession(feedbackSteps: MockStep[] = [feedbackStep()]) {
    const ctx = setup({ steps: [{ text: "Opening." }, { text: "Reply." }, ...feedbackSteps] });
    const id = await start(ctx.app);
    await sendTurn(ctx.app, id, "Hello");
    await endInterview(ctx.app, id);
    return { ...ctx, id };
  }

  it("returns the feedback and marks the session done", async () => {
    const { app, id, store } = await endedSession();

    const res = await getFeedback(app, id);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      feedback: mockFeedback(),
      turn: 1,
      status: "done",
      endReason: "candidate",
    });
    expect(store.get(id)?.status).toBe("done");
  });

  it("sends the transcript as data with the feedback prompt and schema", async () => {
    const { app, id, mock } = await endedSession();

    await getFeedback(app, id);
    const request = mock.calls.at(-1);

    expect(request).toMatchObject({ kind: "feedback", system: FEEDBACK_SYSTEM, schema: FEEDBACK_SCHEMA });
    expect(request?.messages).toHaveLength(1);
    expect(request?.messages[0]?.content).toContain(
      "<transcript>\nInterviewer (Bubo): Opening.\n\nCandidate: Hello\n\nInterviewer (Bubo): Reply.\n</transcript>",
    );
  });

  it("adds the feedback call's usage to the session", async () => {
    const { app, id, store } = await endedSession([
      { ...feedbackStep(), usage: { input: 5_000, output: 700, cacheWrite: 0, cacheRead: 0 } },
    ]);
    const before = store.get(id)!.tokensUsed;

    await getFeedback(app, id);

    expect(store.get(id)!.tokensUsed).toBe(before + 5_700);
  });

  it("works after the turn cap ends the interview", async () => {
    const { app } = setup();
    const id = await start(app);
    for (let turn = 1; turn <= MAX_CANDIDATE_TURNS; turn++) await sendTurn(app, id, `Message ${turn}`);

    const res = await getFeedback(app, id);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "done", endReason: "turn_cap" });
  });

  it("works after the interviewer fails twice", async () => {
    const { app } = setup({
      steps: [{ text: "Opening." }, { error: serverError() }, { error: serverError() }, feedbackStep()],
    });
    const id = await start(app);
    await sendTurn(app, id, "Hello");

    const res = await getFeedback(app, id);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "done", endReason: "interviewer_failed" });
  });

  it("rejects a request while the interview is still going, without a model call", async () => {
    const { app, mock } = setup();
    const id = await start(app);

    const res = await getFeedback(app, id);

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "feedback_not_ready" });
    expect(mock.calls).toHaveLength(1);
  });

  it("returns the same feedback on a repeat request, without a model call", async () => {
    const { app, id, mock } = await endedSession();
    const first = await (await getFeedback(app, id)).json();

    const res = await getFeedback(app, id);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(first);
    expect(mock.calls).toHaveLength(3);
  });

  it("rejects a second request while the feedback is being written", async () => {
    const held = createHeldClient();
    const { app, store } = setup({ client: held.client });
    const id = await start(app);
    await endInterview(app, id);

    held.holdNext();
    const first = getFeedback(app, id);
    await vi.waitFor(() => expect(store.get(id)?.busy).toBe(true));
    const second = await getFeedback(app, id);
    held.release();

    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: "feedback_in_progress" });
    // The mock's canned feedback is valid, so the held call still succeeds.
    expect((await first).status).toBe(200);
  });

  it.each([
    ["the call fails", { error: timeoutError() }, "APIConnectionTimeoutError"],
    ["the model refuses", { text: "", stopReason: "refusal" }, "refusal"],
    ["the reply is cut off", { text: "{", stopReason: "max_tokens" }, "reply hit max_tokens"],
    ["the reply isn't JSON", { text: "Here is your feedback." }, "reply wasn't valid JSON"],
    ["a dimension is missing", feedbackStep({ ...mockFeedback(), dimensions: {} }), "reply was missing required fields"],
  ] as [string, MockStep, string][])("fails without retrying when %s", async (_, step, logged) => {
    const { app, id, store, mock } = await endedSession([step]);
    const callsBefore = mock.calls.length;

    const res = await getFeedback(app, id);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "feedback_failed", message: ERROR_MESSAGES.feedback_failed });
    expect(store.get(id)?.status).toBe("feedback_failed");
    expect(mock.calls.length).toBe(callsBefore + 1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain(`[feedback] session ${id}: ${logged}`);
  });

  it("can be asked again after a failure", async () => {
    const { app, id } = await endedSession([{ error: serverError() }, feedbackStep()]);
    await getFeedback(app, id);

    const res = await getFeedback(app, id);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "done" });
  });

  it("never logs message text, even when an API error quotes it", async () => {
    const quoted = new BadRequestError(400, { message: "invalid: secret design details" }, undefined, headers());
    const { app, id } = await endedSession([{ error: quoted }]);

    await getFeedback(app, id);

    for (const [line] of warn.mock.calls) expect(line).not.toContain("secret");
  });

  it("returns not found for an unknown session", async () => {
    const { app } = setup();

    expect((await getFeedback(app, "no-such-session")).status).toBe(404);
  });
});
