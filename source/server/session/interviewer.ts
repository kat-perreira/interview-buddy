import { INTERVIEWER_MAX_TOKENS } from "../config.ts";
import type { ModelClient } from "../model/types.ts";
import { fitsUnderCap } from "./budget.ts";
import { callLabel, describeError, recordUsage } from "./calls.ts";
import { buildInterviewerRequest } from "./request.ts";
import type { Session } from "./types.ts";

// A failed reply is retried once (docs/spec.md, Failure Handling).
const MAX_ATTEMPTS = 2;

// Returns Bubo's reply, or null if every attempt failed. Errors, timeouts, refusals,
// and empty replies all count as failures. Usage from any attempt that reached the API
// counts toward the session, refusals and empty replies included: those tokens were billed.
// Failures are logged here only; what the candidate sees comes from shared/strings.ts.
// `signal` aborts when the candidate ends mid-reply. An aborted call returns null and isn't
// logged or retried. Its usage never arrives, so it isn't counted.
// The route checks the token cap before the first attempt; a retry after a billed attempt
// is checked here, and skipped if it no longer fits.
export async function callInterviewer(
  modelClient: ModelClient,
  system: string,
  session: Session,
  signal?: AbortSignal,
): Promise<string | null> {
  const request = buildInterviewerRequest(system, session.transcript, session);
  // The same request again, with a full-length reply. Set once an attempt is billed.
  let retryTokens: number | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // The candidate ended the interview during a failed attempt: don't pay for a retry.
    if (attempt > 1 && session.status !== "active") return null;
    if (retryTokens !== null && !fitsUnderCap(session, retryTokens)) {
      warn(session, attempt, "no retry, it would not fit under the token cap");
      return null;
    }
    try {
      const result = await modelClient.complete(request, { signal });
      recordUsage(session, "interviewer", result);
      retryTokens = (session.lastCall?.input ?? 0) + INTERVIEWER_MAX_TOKENS;
      const text = result.text.trim();
      if (result.stopReason === "refusal") warn(session, attempt, "refusal");
      else if (!text) warn(session, attempt, "empty reply");
      else {
        // Kept, since a cut-off reply still reads. Logged so it can be tuned.
        if (result.stopReason === "max_tokens") warn(session, attempt, "reply hit max_tokens");
        return text;
      }
    } catch (error) {
      if (signal?.aborted) return null;
      warn(session, attempt, describeError(error));
    }
  }
  return null;
}

// Console only for now (no monitoring yet). Never logs message text.
function warn(session: Session, attempt: number, reason: string): void {
  console.warn(
    `[interviewer] session ${session.id}, ${callLabel(session, "interviewer")}, attempt ${attempt} of ${MAX_ATTEMPTS}: ${reason}`,
  );
}
