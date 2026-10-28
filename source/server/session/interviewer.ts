import { totalTokens, type ModelClient, type TokenUsage } from "../model/types.ts";
import { buildInterviewerRequest } from "./request.ts";
import type { Session } from "./types.ts";

// A failed reply is retried once (docs/spec.md, Failure Handling).
const MAX_ATTEMPTS = 2;

// Returns Bubo's reply, or null if every attempt failed. Errors, timeouts, refusals,
// and empty replies all count as failures. Usage from any attempt that reached the API
// counts toward the session, refusals and empty replies included: those tokens were billed.
// Failures are logged here only; what the candidate sees comes from shared/strings.ts.
export async function callInterviewer(
  modelClient: ModelClient,
  system: string,
  session: Session,
): Promise<string | null> {
  const request = buildInterviewerRequest(system, session.transcript);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // The candidate ended the interview during a failed attempt: don't pay for a retry.
    if (attempt > 1 && session.status !== "active") return null;
    try {
      const result = await modelClient.complete(request);
      recordUsage(session, result.usage);
      const text = result.text.trim();
      if (result.stopReason === "refusal") warn(session, attempt, "refusal");
      else if (!text) warn(session, attempt, "empty reply");
      else {
        // Kept, since a cut-off reply still reads. Logged so it can be tuned.
        if (result.stopReason === "max_tokens") warn(session, attempt, "reply hit max_tokens");
        return text;
      }
    } catch (error) {
      warn(session, attempt, describeError(error));
    }
  }
  return null;
}

function recordUsage(session: Session, usage: TokenUsage): void {
  session.tokensUsed += totalTokens(usage);
  session.lastCall = { input: usage.input + usage.cacheWrite + usage.cacheRead, output: usage.output };
}

// Error class, HTTP status, and request ID only: API error messages can quote request content.
// The SDK's error classes don't set `name`, so the class comes from the constructor.
// The request ID lets Anthropic support trace a failed call.
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error";
  const { status, requestID } = error as { status?: unknown; requestID?: unknown };
  const parts = [error.constructor.name];
  if (typeof status === "number") parts.push(String(status));
  if (typeof requestID === "string") parts.push(`(request ${requestID})`);
  return parts.join(" ");
}

// Console only for now (no monitoring yet). Never logs message text.
function warn(session: Session, attempt: number, reason: string): void {
  const turn = session.candidateTurns === 0 ? "opening" : `turn ${session.candidateTurns}`;
  console.warn(
    `[interviewer] session ${session.id}, ${turn}, attempt ${attempt} of ${MAX_ATTEMPTS}: ${reason}`,
  );
}
