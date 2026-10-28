import type { ChatMessage } from "../model/types.ts";

// active → feedback_pending → done. A failed feedback call moves to feedback_failed,
// where only a feedback retry is allowed (docs/spec.md, Failure Handling).
export type SessionStatus = "active" | "feedback_pending" | "feedback_failed" | "done";

export type EndReason =
  | "candidate"
  | "turn_cap"
  | "token_cap"
  | "paused_too_long"
  | "interviewer_failed";

export interface Session {
  id: string;
  status: SessionStatus;
  endReason: EndReason | null;
  // What the candidate saw, opening reply included. Request-only text (the kickoff
  // message, turn instructions) is added when building each call, never stored here.
  transcript: ChatMessage[];
  // Candidate messages sent. The opening reply is not a turn.
  candidateTurns: number;
  // Sum of totalTokens(usage) across every call, feedback included.
  tokensUsed: number;
  // The previous call's input side (input + cache write + cache read) and output,
  // for the reserve estimate before the next call.
  lastCall: { input: number; output: number } | null;
  // A model call is in flight; blocks a second message from interleaving.
  busy: boolean;
  // When the candidate paused, or null if not paused. Paused sessions expire later.
  pausedAt: number | null;
  lastActiveAt: number;
}
