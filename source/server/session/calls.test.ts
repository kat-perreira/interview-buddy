import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { PRICE_PER_MTOK } from "../config.ts";
import type { ModelResult } from "../model/types.ts";
import { estimateCost, recordUsage } from "./calls.ts";
import { createSessionStore } from "./store.ts";

const million = 1_000_000;

describe("estimateCost", () => {
  it("prices each kind of token at its own rate", () => {
    const none = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };

    expect(estimateCost({ ...none, input: million })).toBeCloseTo(PRICE_PER_MTOK.input);
    expect(estimateCost({ ...none, output: million })).toBeCloseTo(PRICE_PER_MTOK.output);
    expect(estimateCost({ ...none, cacheWrite: million })).toBeCloseTo(PRICE_PER_MTOK.cacheWrite);
    expect(estimateCost({ ...none, cacheRead: million })).toBeCloseTo(PRICE_PER_MTOK.cacheRead);
  });
});

describe("recordUsage", () => {
  let log: MockInstance<typeof console.log>;
  beforeEach(() => {
    log = vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    log.mockRestore();
  });

  const result: ModelResult = {
    text: "Secret reply text",
    stopReason: "end_turn",
    usage: { input: 50, output: 200, cacheWrite: 0, cacheRead: 3000 },
  };

  it("adds tokens and cost to the session and keeps the last call", () => {
    const session = createSessionStore().create();

    recordUsage(session, "interviewer", result);
    recordUsage(session, "interviewer", result);

    expect(session.tokensUsed).toBe(2 * 3250);
    expect(session.estimatedCost).toBeCloseTo(2 * estimateCost(result.usage));
    expect(session.lastCall).toEqual({ input: 3050, output: 200 });
  });

  it("logs counts, the call, and costs, never message text", () => {
    const session = createSessionStore().create();
    session.candidateTurns = 3;

    recordUsage(session, "interviewer", result);
    recordUsage(session, "feedback", result);

    const [turnLine, feedbackLine] = log.mock.calls.map(([line]) => String(line));
    expect(turnLine).toMatch(
      new RegExp(
        `^\\[usage\\] session ${session.id}, turn 3: 50 input, 0 cache write, 3000 cache read, ` +
          `200 output, end_turn, ~\\$\\d\\.\\d{6} \\(session ~\\$\\d\\.\\d{6}\\)$`,
      ),
    );
    expect(feedbackLine).toContain(`session ${session.id}, feedback:`);
    expect(log.mock.calls.join(" ")).not.toContain("Secret");
  });
});
