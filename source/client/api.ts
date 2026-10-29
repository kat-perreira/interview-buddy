import { parseFeedback, type Feedback } from "../shared/feedback.ts";
import { ERROR_MESSAGES } from "../shared/strings.ts";

export type StartResult =
  | { ok: true; sessionId: string; reply: string }
  | { ok: false; message: string };

// `ended` means the interview is over and input should lock. `reply` is null when Bubo
// failed twice (`message` says so) or End interview dropped the reply. On a failure,
// `feedbackNext` means the interview had already ended but the session is still there,
// so feedback can still be asked for.
export type TurnResult =
  | { ok: true; reply: string | null; ended: boolean; message: string | null }
  | { ok: false; message: string; ended: boolean; feedbackNext: boolean };

// `error` is the server's error code, or null when the request got no usable answer.
export type EndResult = { ok: true } | { ok: false; message: string; error: string | null };

// `error` is the server's error code, or null when the request got no usable answer.
export type FeedbackResult =
  | { ok: true; feedback: Feedback }
  | { ok: false; message: string; error: string | null };

// Request errors that mean the session can't take more turns.
const ENDED_ERRORS = new Set(["not_found", "interview_over"]);

// Feedback errors that another request could get past.
const RETRYABLE_FEEDBACK_ERRORS = new Set(["feedback_failed", "feedback_in_progress"]);
// Spec, Failure Handling: after this many failed Retry feedback attempts, also offer a new
// interview. Retry feedback stays.
export const RETRIES_BEFORE_NEW_INTERVIEW = 3;

// After feedback_in_progress, ask once more on our own after this long.
export const REASK_DELAY_MS = 3000;

// True when asking for feedback again could succeed: the call failed or was still running,
// or the request got no usable answer.
export function canRetryFeedback(error: string | null): boolean {
  return error === null || RETRYABLE_FEEDBACK_ERRORS.has(error);
}

// Calls below never throw: failures come back as a message to show, the server's own
// when it sent one, otherwise the fallback.

// Starts a session and returns Bubo's opening.
export async function startSession(): Promise<StartResult> {
  try {
    const res = await fetch("/api/sessions", { method: "POST" });
    const body = await res.json();
    if (res.ok) {
      if (typeof body?.sessionId === "string" && typeof body.reply === "string") {
        return { ok: true, sessionId: body.sessionId, reply: body.reply };
      }
    } else if (typeof body?.message === "string") {
      return { ok: false, message: body.message };
    }
  } catch {
    // Network error or a body that isn't JSON: fall through to the generic message.
  }
  return { ok: false, message: ERROR_MESSAGES.start_failed };
}

// Sends one candidate message and returns Bubo's reply.
export async function sendTurn(sessionId: string, message: string): Promise<TurnResult> {
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/turns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const body = await res.json();
    if (res.ok) {
      if (
        (typeof body?.reply === "string" || body?.reply === null) &&
        typeof body.status === "string"
      ) {
        return {
          ok: true,
          reply: body.reply,
          ended: body.status !== "active",
          message: typeof body.message === "string" ? body.message : null,
        };
      }
    } else if (typeof body?.message === "string") {
      return {
        ok: false,
        message: body.message,
        ended: ENDED_ERRORS.has(body.error),
        feedbackNext: body.error === "interview_over",
      };
    }
  } catch {
    // Network error or a body that isn't JSON: fall through to the generic message.
  }
  return { ok: false, message: ERROR_MESSAGES.send_failed, ended: false, feedbackNext: false };
}

// Ends the interview (End interview, after the candidate confirms).
export async function endSession(sessionId: string): Promise<EndResult> {
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/end`, {
      method: "POST",
    });
    if (res.ok) return { ok: true };
    const body = await res.json();
    if (typeof body?.message === "string") {
      return {
        ok: false,
        message: body.message,
        error: typeof body.error === "string" ? body.error : null,
      };
    }
  } catch {
    // Network error or a body that isn't JSON: fall through to the generic message.
  }
  return { ok: false, message: ERROR_MESSAGES.end_failed, error: null };
}

// Asks for the feedback once the interview has ended. Safe to call again after a failure.
export async function requestFeedback(sessionId: string): Promise<FeedbackResult> {
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/feedback`, {
      method: "POST",
    });
    const body = await res.json();
    if (res.ok) {
      const feedback = parseFeedback(body?.feedback);
      if (feedback) return { ok: true, feedback };
    } else if (typeof body?.message === "string") {
      return {
        ok: false,
        message: body.message,
        error: typeof body.error === "string" ? body.error : null,
      };
    }
  } catch {
    // Network error or a body that isn't JSON: fall through to the generic message.
  }
  return { ok: false, message: ERROR_MESSAGES.feedback_failed, error: null };
}
