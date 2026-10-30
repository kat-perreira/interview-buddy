import { MAX_MESSAGE_CHARS, messageLength } from "../../shared/limits.ts";
import { FEEDBACK_RESERVE_TOKENS, INTERVIEWER_MAX_TOKENS, SESSION_TOKEN_CAP } from "../config.ts";
import type { Session } from "./types.ts";

// The token check before each interviewer call (docs/spec.md, Limits; docs/decisions.md,
// 2026-10-28). Estimates are rough on purpose: the feedback reserve has room for the error.

// Rough English estimate: about four characters per token.
export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

// True if a call this size still leaves the feedback reserve under the cap.
export function fitsUnderCap(session: Session, callTokens: number): boolean {
  return session.tokensUsed + callTokens + FEEDBACK_RESERVE_TOKENS <= SESSION_TOKEN_CAP;
}

// The next turn's call: everything the previous call sent plus its reply (both resent now),
// the new message, and a reply that uses all of max_tokens.
export function estimateTurnCall(session: Session, message: string): number {
  const last = session.lastCall ?? { input: 0, output: 0 };
  return last.input + last.output + estimateTokens(messageLength(message)) + INTERVIEWER_MAX_TOKENS;
}

// Each later call resends the reply before it and adds one message.
const MAX_GROWTH_PER_TURN = INTERVIEWER_MAX_TOKENS + estimateTokens(MAX_MESSAGE_CHARS);

// How many turns fit, this one included, counting up to 3: the markers only care about 0
// (end now), 1 (final turn), and 2 (wrap-up). Later turns are assumed to be worst case,
// with full-length messages and replies, so the count errs low: the interview may end a turn early, but not past the cap.
export function turnsThatFit(session: Session, message: string): number {
  const call = estimateTurnCall(session, message);
  let total = 0;
  for (let turn = 0; turn < 3; turn++) {
    total += call + turn * MAX_GROWTH_PER_TURN;
    if (!fitsUnderCap(session, total)) return turn;
  }
  return 3;
}
