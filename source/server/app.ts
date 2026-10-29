import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { MAX_MESSAGE_CHARS, messageLength } from "../shared/limits.ts";
import { ERROR_MESSAGES, type ErrorCode } from "../shared/strings.ts";
import { MAX_CANDIDATE_TURNS } from "./config.ts";
import type { ModelClient } from "./model/types.ts";
import { callFeedback } from "./session/feedback.ts";
import { callInterviewer } from "./session/interviewer.ts";
import type { SessionStore } from "./session/store.ts";
import type { EndReason, Session } from "./session/types.ts";

export interface AppDeps {
  modelClient: ModelClient;
  store: SessionStore;
  // The interviewer's system prompt (persona, scenario, rubric). Tests pass a stub.
  systemPrompt: string;
  // The feedback call's system prompt (feedback instructions, scenario, rubric).
  feedbackPrompt: string;
}

// Routes live here, separate from the Node listener in index.ts,
// so tests can call app.request() without starting a server.
// Dependencies are passed in so tests can use the mock client and a fake clock.
export function createApp({ modelClient, store, systemPrompt, feedbackPrompt }: AppDeps) {
  const app = new Hono().basePath("/api");

  const error = (code: ErrorCode) => ({ error: code, message: ERROR_MESSAGES[code] });

  const endInterview = (session: Session, reason: EndReason) => {
    session.status = "feedback_pending";
    session.endReason = reason;
  };

  // `busy` blocks a second message while a model call is in flight.
  // `abortCall` lets End interview cancel it.
  const withBusy = async <T>(
    session: Session,
    call: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> => {
    const controller = new AbortController();
    session.busy = true;
    session.abortCall = controller;
    try {
      return await call(controller.signal);
    } finally {
      session.busy = false;
      session.abortCall = null;
    }
  };

  // Where the session stands after a request, for the client to act on.
  const state = (session: Session) => ({
    turn: session.candidateTurns,
    status: session.status,
    endReason: session.endReason,
  });

  app.get("/health", (c) => c.json({ ok: true }));

  // Rejects an oversized body before it is read. A message at the limit is at most
  // 4 bytes per character, plus room for the JSON around it.
  app.use(
    "/sessions/*",
    bodyLimit({
      maxSize: MAX_MESSAGE_CHARS * 4 + 1024,
      onError: (c) => c.json(error("too_long"), 413),
    }),
  );

  // Start: create the session and get Bubo's opening reply.
  // If the opening fails twice there is nothing to grade, so the session is discarded.
  app.post("/sessions", async (c) => {
    const session = store.create();
    // No busy flag needed: the client has no session ID until this returns.
    const reply = await callInterviewer(modelClient, systemPrompt, session);

    if (reply === null) {
      store.delete(session.id);
      return c.json(error("start_failed"), 502);
    }
    session.transcript.push({ role: "assistant", content: reply });
    store.touch(session);
    return c.json({ sessionId: session.id, reply, ...state(session) }, 201);
  });

  // Send one candidate message and get Bubo's reply.
  app.post("/sessions/:id/turns", async (c) => {
    // Read the body first: no await may sit between the busy check and setting busy,
    // or two quick sends could both get through.
    const body = await c.req.json().catch(() => null);

    const session = store.get(c.req.param("id"));
    if (!session) return c.json(error("not_found"), 404);
    if (session.status !== "active") return c.json(error("interview_over"), 409);
    if (session.busy) return c.json(error("busy"), 409);

    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return c.json(error("empty_message"), 400);
    if (messageLength(message) > MAX_MESSAGE_CHARS) return c.json(error("too_long"), 400);

    session.transcript.push({ role: "user", content: message });
    session.candidateTurns++;
    store.touch(session);

    const reply = await withBusy(session, (signal) =>
      callInterviewer(modelClient, systemPrompt, session, signal),
    );
    store.touch(session);

    // The candidate pressed End interview while Bubo was replying: drop the reply.
    if (session.status !== "active") return c.json({ reply: null, ...state(session) });

    // Failed twice: end here. The unanswered message stays and counts as a turn.
    if (reply === null) {
      endInterview(session, "interviewer_failed");
      return c.json({ reply: null, message: ERROR_MESSAGES.interviewer_failed, ...state(session) });
    }

    session.transcript.push({ role: "assistant", content: reply });
    if (session.candidateTurns >= MAX_CANDIDATE_TURNS) endInterview(session, "turn_cap");
    return c.json({ reply, ...state(session) });
  });

  // End interview. Always allowed while active, even mid-reply (the client confirms first).
  // A reply in progress is cancelled so the dropped reply stops costing tokens.
  app.post("/sessions/:id/end", (c) => {
    const session = store.get(c.req.param("id"));
    if (!session) return c.json(error("not_found"), 404);
    if (session.status !== "active") return c.json(error("interview_over"), 409);

    endInterview(session, "candidate");
    session.abortCall?.abort();
    store.touch(session);
    return c.json(state(session));
  });

  // Write the feedback once the interview has ended. A failed call leaves the session in
  // feedback_failed, where this route can be called again. Idempotent once done: a repeat
  // request gets the stored feedback, with no model call.
  app.post("/sessions/:id/feedback", async (c) => {
    const session = store.get(c.req.param("id"));
    if (!session) return c.json(error("not_found"), 404);
    if (session.status === "active") return c.json(error("feedback_not_ready"), 409);
    if (session.feedback) {
      store.touch(session);
      return c.json({ feedback: session.feedback, ...state(session) });
    }
    // Also covers a dropped interviewer reply that hasn't settled yet after End interview.
    if (session.busy) return c.json(error("feedback_in_progress"), 409);

    const feedback = await withBusy(session, () => callFeedback(modelClient, feedbackPrompt, session));
    store.touch(session);

    if (feedback === null) {
      session.status = "feedback_failed";
      return c.json(error("feedback_failed"), 502);
    }
    session.feedback = feedback;
    session.status = "done";
    return c.json({ feedback, ...state(session) });
  });

  return app;
}
