import { totalTokens, type TokenUsage } from "../model/types.ts";
import type { Session } from "./types.ts";

// Helpers shared by the interviewer and feedback calls.

export function recordUsage(session: Session, usage: TokenUsage): void {
  session.tokensUsed += totalTokens(usage);
  session.lastCall = { input: usage.input + usage.cacheWrite + usage.cacheRead, output: usage.output };
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
