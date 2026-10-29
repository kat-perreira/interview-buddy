import { describe, expect, it } from "vitest";
import { loadFeedbackPrompt, loadSystemPrompt } from "./prompts.ts";
import { FINAL_TURN_MARKER, WRAP_UP_MARKER } from "./session/request.ts";

describe("loadSystemPrompt", () => {
  const prompt = loadSystemPrompt();

  it("includes the persona, scenario, and rubric", () => {
    expect(prompt).toContain("# Interviewer persona");
    expect(prompt).toContain("## Pacing");
    expect(prompt).toContain("# Grading Rubric");
  });

  // No code links a marker to its rule; the text must match (docs/turn-requests.md).
  it("defines every turn marker the server sends", () => {
    expect(prompt).toContain(WRAP_UP_MARKER);
    expect(prompt).toContain(FINAL_TURN_MARKER);
  });
});

describe("loadFeedbackPrompt", () => {
  const prompt = loadFeedbackPrompt();

  it("includes the feedback instructions, scenario, and rubric", () => {
    expect(prompt).toContain("# Feedback writer");
    expect(prompt).toContain("## Pacing");
    expect(prompt).toContain("# Grading Rubric");
  });

  // Feedback is written in a plain voice, not as Bubo.
  it("leaves out the persona", () => {
    expect(prompt).not.toContain("# Interviewer persona");
  });
});
