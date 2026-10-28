// Model settings live here so a model or limit change is a one-line edit.
// Values come from docs/spec.md (Limits) and docs/decisions.md; change those first.

export const MODEL_ID = "claude-haiku-5-5";

export const INTERVIEWER_MAX_TOKENS = 400;
export const FEEDBACK_MAX_TOKENS = 1500;

// Thinking is off so the whole max_tokens budget goes to the visible reply.
// Effort still shapes length and depth when thinking is off.
export const INTERVIEWER_EFFORT = "low";
export const FEEDBACK_EFFORT = "medium";

export const REQUEST_TIMEOUT_MS = 30_000;
