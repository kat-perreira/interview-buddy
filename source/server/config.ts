// Model settings live here so a model or limit change is a one-line edit.
// Values come from docs/spec.md (Limits) and docs/decisions.md; change those first.

export const MODEL_ID = "claude-haiku-5-5";

// The interview ends after Bubo replies to this many candidate messages.
export const MAX_CANDIDATE_TURNS = 12;

export const INTERVIEWER_MAX_TOKENS = 400;
export const FEEDBACK_MAX_TOKENS = 1500;

// Thinking is off so the whole max_tokens budget goes to the visible reply.
// Effort still shapes length and depth when thinking is off.
export const INTERVIEWER_EFFORT = "low";
export const FEEDBACK_EFFORT = "medium";

export const REQUEST_TIMEOUT_MS = 30_000; // 30 seconds

// Idle sessions expire after this long; the sweep frees their memory.
// Not a thinking-time allowance: pause check-ins handle pacing (docs/spec.md, Session Rules).
export const SESSION_TTL_MS = 30 * 60_000; // 30 minutes
export const SESSION_SWEEP_INTERVAL_MS = 60_000; // 1 minute

// A pause ends the interview at this limit. Paused sessions get a longer idle expiry
// so the sweep can't drop one before its pause limit is reached.
export const PAUSE_LIMIT_MS = 30 * 60_000; // 30 minutes
export const PAUSED_SESSION_TTL_MS = 35 * 60_000; // 35 minutes
