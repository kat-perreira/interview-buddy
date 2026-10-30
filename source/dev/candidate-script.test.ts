import { describe, expect, it } from "vitest";
import { MAX_CANDIDATE_TURNS } from "../server/config.ts";
import { MAX_MESSAGE_CHARS, messageLength } from "../shared/limits.ts";
import { CANDIDATE_SCRIPT } from "./candidate-script.ts";

describe("CANDIDATE_SCRIPT", () => {
  it("has one answer per turn, each one the server would accept", () => {
    expect(CANDIDATE_SCRIPT).toHaveLength(MAX_CANDIDATE_TURNS);
    for (const answer of CANDIDATE_SCRIPT) {
      expect(answer.trim()).not.toBe("");
      expect(messageLength(answer)).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
    }
  });

  it("never sets off a mock failure path", () => {
    expect(CANDIDATE_SCRIPT.join(" ")).not.toContain("[mock:");
  });
});
