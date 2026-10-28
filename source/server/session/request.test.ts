import { describe, expect, it } from "vitest";
import { MAX_CANDIDATE_TURNS, WRAP_UP_TURN } from "../config.ts";
import type { ChatMessage } from "../model/types.ts";
import {
  FINAL_TURN_MARKER,
  KICKOFF_MESSAGE,
  WRAP_UP_MARKER,
  buildInterviewerRequest,
  turnNote,
} from "./request.ts";

const opening: ChatMessage = { role: "assistant", content: "Hoo, hello. Let's design." };

// Opening reply, then `turns` candidate messages, each answered except the last.
function transcriptWithTurns(turns: number): ChatMessage[] {
  const transcript: ChatMessage[] = [opening];
  for (let turn = 1; turn <= turns; turn++) {
    if (turn > 1) transcript.push({ role: "assistant", content: `Reply ${turn - 1}` });
    transcript.push({ role: "user", content: `Message ${turn}` });
  }
  return transcript;
}

describe("turnNote", () => {
  it("states the turn out of the cap", () => {
    expect(turnNote(4)).toBe(`[Turn 4 of ${MAX_CANDIDATE_TURNS}]`);
  });

  it("adds the wrap-up marker on the wrap-up turn only", () => {
    expect(turnNote(WRAP_UP_TURN)).toBe(`[Turn ${WRAP_UP_TURN} of ${MAX_CANDIDATE_TURNS}] ${WRAP_UP_MARKER}`);
    expect(turnNote(WRAP_UP_TURN - 1)).not.toContain(WRAP_UP_MARKER);
    expect(turnNote(WRAP_UP_TURN + 1)).not.toContain(WRAP_UP_MARKER);
  });

  it("adds the final-turn marker on the last turn only", () => {
    expect(turnNote(MAX_CANDIDATE_TURNS)).toBe(
      `[Turn ${MAX_CANDIDATE_TURNS} of ${MAX_CANDIDATE_TURNS}] ${FINAL_TURN_MARKER}`,
    );
    for (let turn = 1; turn < MAX_CANDIDATE_TURNS; turn++) {
      expect(turnNote(turn)).not.toContain(FINAL_TURN_MARKER);
    }
  });
});

describe("buildInterviewerRequest", () => {
  it("sends only the kickoff for the opening call", () => {
    const request = buildInterviewerRequest("system prompt", []);

    expect(request).toEqual({
      kind: "interviewer",
      system: "system prompt",
      messages: [{ role: "user", content: KICKOFF_MESSAGE }],
    });
  });

  it("adds the turn note to each candidate message and leaves replies alone", () => {
    const transcript: ChatMessage[] = [
      opening,
      { role: "user", content: "Who sends notifications?" },
      { role: "assistant", content: "Good question." },
      { role: "user", content: "Then I'd start with ingest." },
    ];

    const { messages } = buildInterviewerRequest("s", transcript);

    expect(messages).toEqual([
      { role: "user", content: KICKOFF_MESSAGE },
      opening,
      { role: "user", content: `${turnNote(1)}\n\nWho sends notifications?` },
      { role: "assistant", content: "Good question." },
      { role: "user", content: `${turnNote(2)}\n\nThen I'd start with ingest.` },
    ]);
  });

  it("does not store request-only text in the transcript", () => {
    const transcript: ChatMessage[] = [opening, { role: "user", content: "Hi" }];

    buildInterviewerRequest("s", transcript);

    expect(transcript).toEqual([opening, { role: "user", content: "Hi" }]);
  });

  it("rebuilds earlier messages identically, so the cached prefix still matches", () => {
    const transcript: ChatMessage[] = [opening, { role: "user", content: "First" }];
    const before = buildInterviewerRequest("s", transcript).messages;

    transcript.push({ role: "assistant", content: "Go on." }, { role: "user", content: "Second" });
    const after = buildInterviewerRequest("s", transcript).messages;

    expect(after.slice(0, before.length)).toEqual(before);
  });

  it("marks the wrap-up turn and the final turn in the request", () => {
    const wrapUp = buildInterviewerRequest("s", transcriptWithTurns(WRAP_UP_TURN)).messages;
    expect(wrapUp.at(-1)?.content).toBe(`${turnNote(WRAP_UP_TURN)}\n\nMessage ${WRAP_UP_TURN}`);

    const final = buildInterviewerRequest("s", transcriptWithTurns(MAX_CANDIDATE_TURNS)).messages;
    expect(final.at(-1)?.content).toBe(
      `${turnNote(MAX_CANDIDATE_TURNS)}\n\nMessage ${MAX_CANDIDATE_TURNS}`,
    );
  });

  it("keeps the wrap-up marker on later calls, so the cached prefix still matches", () => {
    const before = buildInterviewerRequest("s", transcriptWithTurns(WRAP_UP_TURN)).messages;
    const after = buildInterviewerRequest("s", transcriptWithTurns(WRAP_UP_TURN + 1)).messages;

    expect(after.slice(0, before.length)).toEqual(before);
  });
});
