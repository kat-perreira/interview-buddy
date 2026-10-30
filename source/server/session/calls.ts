import { PRICE_PER_MTOK } from "../config.ts";
import { totalTokens, type CallKind, type ModelResult, type TokenUsage } from "../model/types.ts";
import type { Session } from "./types.ts";

// Helpers shared by the interviewer and feedback calls.

// Also logs one line per call, for tracking spend and checking that caching works.
// Counts only, never message text.
export function recordUsage(session: Session, kind: CallKind, result: ModelResult): void {
  const { usage } = result;
  const cost = estimateCost(usage);
  session.tokensUsed += totalTokens(usage);
  session.estimatedCost += cost;
  session.lastCall = { input: usage.input + usage.cacheWrite + usage.cacheRead, output: usage.output };
  console.log(
    `[usage] session ${session.id}, ${callLabel(session, kind)}: ${usage.input} input, ` +
      `${usage.cacheWrite} cache write, ${usage.cacheRead} cache read, ${usage.output} output, ` +
      `${result.stopReason}, ~$${cost.toFixed(6)} (session ~$${session.estimatedCost.toFixed(6)})`,
  );
}

export function estimateCost(usage: TokenUsage): number {
  const dollars =
    usage.input * PRICE_PER_MTOK.input +
    usage.output * PRICE_PER_MTOK.output +
    usage.cacheWrite * PRICE_PER_MTOK.cacheWrite +
    usage.cacheRead * PRICE_PER_MTOK.cacheRead;
  return dollars / 1_000_000;
}

// "opening", "turn 3", or "feedback".
export function callLabel(session: Session, kind: CallKind): string {
  if (kind === "feedback") return "feedback";
  return session.candidateTurns === 0 ? "opening" : `turn ${session.candidateTurns}`;
}

// Error class, HTTP status, and request ID only: API error messages can quote request content.
// The SDK's error classes don't set `name`, so the class comes from the constructor.
// The request ID lets Anthropic support trace a failed call.
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error";
  const { status, requestID } = error as { status?: unknown; requestID?: unknown };
  const parts = [error.constructor.name];
  if (typeof status === "number") parts.push(String(status));
  if (typeof requestID === "string") parts.push(`(request ${requestID})`);
  return parts.join(" ");
}
