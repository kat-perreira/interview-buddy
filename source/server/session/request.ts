import { MAX_CANDIDATE_TURNS, WRAP_UP_TURN } from "../config.ts";
import type { ChatMessage, ModelRequest } from "../model/types.ts";
import type { Session } from "./types.ts";

// Request-only text: added each time a call is built, never stored in the transcript.

// The API needs a user message first; the opening reply answers this one.
export const KICKOFF_MESSAGE = "[The candidate pressed Start. Open the interview.]";

// Markers only flag the turn. What Bubo does with each is written in persona.md.
export const WRAP_UP_MARKER = "[Wrap-up]";
export const FINAL_TURN_MARKER = "[Final turn]";

// Which turns get a marker. The token check only ever moves one to the newest turn.
export type MarkerTurns = Pick<Session, "wrapUpTurn" | "finalTurn">;
export const DEFAULT_MARKER_TURNS: MarkerTurns = {
  wrapUpTurn: WRAP_UP_TURN,
  finalTurn: MAX_CANDIDATE_TURNS,
};

// Depends only on the turn number and the marker turns, which never change for a turn
// already sent, so a marked turn keeps its marker when rebuilt.
export function turnNote(turn: number, markers: MarkerTurns = DEFAULT_MARKER_TURNS): string {
  const note = `[Turn ${turn} of ${MAX_CANDIDATE_TURNS}]`;
  // Final wins if the two ever coincide: the close is the one that must happen.
  if (turn === markers.finalTurn) return `${note} ${FINAL_TURN_MARKER}`;
  if (turn === markers.wrapUpTurn) return `${note} ${WRAP_UP_MARKER}`;
  return note;
}

// Rebuilt from the transcript on every call. Earlier candidate messages get the same
// notes they had when first sent, so the prompt prefix matches the cached one.
export function buildInterviewerRequest(
  system: string,
  transcript: ChatMessage[],
  markers: MarkerTurns = DEFAULT_MARKER_TURNS,
): ModelRequest {
  let turn = 0;
  const messages = transcript.map(
    (message): ChatMessage =>
      message.role === "user"
        ? { role: "user", content: `${turnNote(++turn, markers)}\n\n${message.content}` }
        : message,
  );
  return {
    kind: "interviewer",
    system,
    messages: [{ role: "user", content: KICKOFF_MESSAGE }, ...messages],
  };
}
