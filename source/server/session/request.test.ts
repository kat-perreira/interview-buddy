import { describe, expect, it } from "vitest";
import { MAX_CANDIDATE_TURNS } from "../config.ts";
import type { ChatMessage } from "../model/types.ts";
import { KICKOFF_MESSAGE, buildInterviewerRequest, turnNote } from "./request.ts";

const opening: ChatMessage = { role: "assistant", content: "Hoo, hello. Let's design." };

describe("turnNote", () => {
  it("states the turn out of the cap", () => {
    expect(turnNote(4)).toBe(`[Turn 4 of ${MAX_CANDIDATE_TURNS}]`);
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
});
