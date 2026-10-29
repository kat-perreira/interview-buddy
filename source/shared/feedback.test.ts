import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mockFeedback } from "../server/model/mock.ts";
import { FEEDBACK_SCHEMA, RATING_LABELS, RUBRIC_DIMENSIONS, parseFeedback } from "./feedback.ts";

const rubric = readFileSync(new URL("../../prompts/rubric.md", import.meta.url), "utf8");

// The code copies of the rubric must match the file the model reads.
describe("rubric copies", () => {
  it("lists the same dimensions as rubric.md, in order", () => {
    const fromRubric = [...rubric.matchAll(/^\| \d+\. ([^|]+?) \|/gm)].map((m) => m[1]);

    expect(RUBRIC_DIMENSIONS.map((d) => d.label)).toEqual(fromRubric);
  });

  it("uses the rating labels from rubric.md", () => {
    const scale = Object.entries(RATING_LABELS).map(([n, label]) => `${n} = ${label}`).join(", ");

    expect(rubric).toContain(scale);
  });
});

describe("FEEDBACK_SCHEMA", () => {
  it("requires every rubric dimension", () => {
    expect(FEEDBACK_SCHEMA.properties.dimensions.required).toEqual(RUBRIC_DIMENSIONS.map((d) => d.id));
  });
});

describe("parseFeedback", () => {
  const valid = mockFeedback();

  it("accepts complete feedback, including a not-observed dimension", () => {
    expect(parseFeedback(valid)).toEqual(valid);
    expect(Object.values(valid.dimensions).some((d) => d.rating === null)).toBe(true);
  });

  it("trims whitespace", () => {
    const parsed = parseFeedback({ ...valid, summary: "  Good session.  " });

    expect(parsed?.summary).toBe("Good session.");
  });

  it("keeps the first three items of a long list", () => {
    const parsed = parseFeedback({ ...valid, strengths: ["a", "b", "c", "d"] });

    expect(parsed?.strengths).toEqual(["a", "b", "c"]);
  });

  it.each([
    ["not an object", "feedback"],
    ["a missing summary", { ...valid, summary: "" }],
    ["a missing dimension", { ...valid, dimensions: { ...valid.dimensions, scaling: undefined } }],
    ["a rating off the scale", { ...valid, dimensions: { ...valid.dimensions, scaling: { rating: 5, evidence: "x" } } }],
    ["a rating with no evidence", { ...valid, dimensions: { ...valid.dimensions, scaling: { rating: 3, evidence: " " } } }],
    ["only one strength", { ...valid, strengths: ["one"] }],
    ["only one area to improve", { ...valid, improvements: ["one"] }],
    ["an empty list item", { ...valid, improvements: ["ok", ""] }],
    ["fewer than three practice steps", { ...valid, practiceSteps: ["one", "two"] }],
  ])("rejects %s", (_, value) => {
    expect(parseFeedback(value)).toBeNull();
  });
});
