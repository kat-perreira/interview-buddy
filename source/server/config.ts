// Model settings live here so a model or limit change is a one-line edit.
// Values come from docs/spec.md (Limits) and docs/decisions.md; change those first.

export const MODEL_ID = "claude-haiku-5-5";

// USD per million tokens, used only for the cost estimate in the server console.
// The Console's usage page is the real bill. Indexed by MODEL_ID, so a model with no
// prices here fails typecheck.
export const PRICE_PER_MTOK = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
}[MODEL_ID];

// The interview ends after Bubo replies to this many candidate messages.
export const MAX_CANDIDATE_TURNS = 12;
// Bubo's reply to this turn warns that the session is nearly up.
export const WRAP_UP_TURN = 10;

export const INTERVIEWER_MAX_TOKENS = 400;
export const FEEDBACK_MAX_TOKENS = 1500;

// Every call in a session counts toward the cap: input and output, cached or not.
// An interviewer call goes out only if this much is still left for the feedback call.
export const SESSION_TOKEN_CAP = 130_000;
export const FEEDBACK_RESERVE_TOKENS = 16_000;

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
