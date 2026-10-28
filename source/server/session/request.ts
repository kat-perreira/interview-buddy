import { MAX_CANDIDATE_TURNS } from "../config.ts";
import type { ChatMessage, ModelRequest } from "../model/types.ts";

// Request-only text: added each time a call is built, never stored in the transcript.

// The API needs a user message first; the opening reply answers this one.
export const KICKOFF_MESSAGE = "[The candidate pressed Start. Open the interview.]";

export function turnNote(turn: number): string {
  return `[Turn ${turn} of ${MAX_CANDIDATE_TURNS}]`;
}

// Rebuilt from the transcript on every call. Earlier candidate messages get the same
// notes they had when first sent, so the prompt prefix matches the cached one.
export function buildInterviewerRequest(system: string, transcript: ChatMessage[]): ModelRequest {
  let turn = 0;
  const messages = transcript.map(
    (message): ChatMessage =>
      message.role === "user"
        ? { role: "user", content: `${turnNote(++turn)}\n\n${message.content}` }
        : message,
  );
  return {
    kind: "interviewer",
    system,
    messages: [{ role: "user", content: KICKOFF_MESSAGE }, ...messages],
  };
}
