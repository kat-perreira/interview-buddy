import { FEEDBACK_SCHEMA, parseFeedback, type Feedback } from "../../shared/feedback.ts";
import { MAX_CANDIDATE_TURNS } from "../config.ts";
import type { ModelClient, ModelRequest } from "../model/types.ts";
import { describeError, recordUsage } from "./calls.ts";
import type { EndReason, Session } from "./types.ts";

// Request-only facts about how the interview ended. What to do with them is in feedback.md.
function endNote(reason: EndReason | null, turns: number): string {
  const after = `after ${turns} of ${MAX_CANDIDATE_TURNS} candidate turns`;
  switch (reason) {
    case "turn_cap":
      return `The interview reached its ${MAX_CANDIDATE_TURNS}-turn limit.`;
    case "candidate":
      return `The candidate ended the interview ${after}.`;
    case "token_cap":
      return `The interview reached its length limit ${after}.`;
    case "paused_too_long":
      return `The interview ended ${after}, when a pause ran past its limit.`;
    case "interviewer_failed":
      return `The interview ended early ${after}, because of a technical problem on our side. The candidate's last message got no reply.`;
    default:
      return `The interview ended ${after}.`;
  }
}

// The transcript goes in as one labeled block of data, not as a conversation to continue,
// so the model grades it instead of replying as Bubo. A closing tag typed by the candidate
// is defanged so it can't end the block early.
export function buildFeedbackRequest(system: string, session: Session): ModelRequest {
  const transcript = session.transcript
    .map((m) => `${m.role === "assistant" ? "Interviewer (Bubo)" : "Candidate"}: ${m.content}`)
    .map((line) => line.replace(/<\/\s*transcript\s*>/gi, "<\\/transcript>"))
    .join("\n\n");
  return {
    kind: "feedback",
    system,
    messages: [
      {
        role: "user",
        content: `<transcript>\n${transcript}\n</transcript>\n\n${endNote(session.endReason, session.candidateTurns)}`,
      },
    ],
    schema: FEEDBACK_SCHEMA,
  };
}

// Returns the feedback, or null if the call failed. One attempt only: the candidate
// retries from the feedback screen (docs/spec.md, Failure Handling). Usage counts even
// when the reply can't be used, since it was billed. Never logs message text.
export async function callFeedback(
  modelClient: ModelClient,
  system: string,
  session: Session,
): Promise<Feedback | null> {
  try {
    const result = await modelClient.complete(buildFeedbackRequest(system, session));
    recordUsage(session, result.usage);
    if (result.stopReason === "refusal") return fail(session, "refusal");
    if (result.stopReason === "max_tokens") return fail(session, "reply hit max_tokens");
    const json = parseJson(result.text);
    if (json === undefined) return fail(session, "reply wasn't valid JSON");
    return parseFeedback(json) ?? fail(session, "reply was missing required fields");
  } catch (error) {
    return fail(session, describeError(error));
  }
}

// Undefined if the text isn't JSON (JSON can't encode undefined, so it's unambiguous).
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Console only for now (no monitoring yet).
function fail(session: Session, reason: string): null {
  console.warn(`[feedback] session ${session.id}: ${reason}`);
  return null;
}
