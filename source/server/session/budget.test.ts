import { describe, expect, it } from "vitest";
import { MAX_MESSAGE_CHARS } from "../../shared/limits.ts";
import { FEEDBACK_RESERVE_TOKENS, INTERVIEWER_MAX_TOKENS, SESSION_TOKEN_CAP } from "../config.ts";
import { estimateTokens, estimateTurnCall, fitsUnderCap, turnsThatFit } from "./budget.ts";
import { createSessionStore } from "./store.ts";
import type { Session } from "./types.ts";

// Tokens an interviewer call may use while leaving the feedback reserve.
const ROOM = SESSION_TOKEN_CAP - FEEDBACK_RESERVE_TOKENS;
const GROWTH = INTERVIEWER_MAX_TOKENS + estimateTokens(MAX_MESSAGE_CHARS);

function session(fields: Partial<Session> = {}): Session {
  return Object.assign(createSessionStore().create(), fields);
}

describe("estimateTokens", () => {
  it("rounds characters ÷ 4 up", () => {
    expect(estimateTokens(0)).toBe(0);
    expect(estimateTokens(8)).toBe(2);
    expect(estimateTokens(9)).toBe(3);
  });
});

describe("fitsUnderCap", () => {
  it("allows a call that leaves exactly the reserve, and not one token more", () => {
    const s = session({ tokensUsed: 10_000 });

    expect(fitsUnderCap(s, ROOM - 10_000)).toBe(true);
    expect(fitsUnderCap(s, ROOM - 10_000 + 1)).toBe(false);
  });
});

describe("estimateTurnCall", () => {
  it("adds the previous input and reply, the new message, and a full-length reply", () => {
    const s = session({ lastCall: { input: 3000, output: 250 } });

    expect(estimateTurnCall(s, "x".repeat(400))).toBe(3000 + 250 + 100 + INTERVIEWER_MAX_TOKENS);
  });
});

describe("turnsThatFit", () => {
  const lastCall = { input: 5000, output: 300 };
  const message = "x".repeat(400);
  const call = estimateTurnCall(session({ lastCall }), message);
  // tokensUsed that leaves room for exactly `turns` worst-case turns, this one first.
  const usedFor = (turns: number) => {
    let total = 0;
    for (let turn = 0; turn < turns; turn++) total += call + turn * GROWTH;
    return ROOM - total;
  };

  it("counts this turn and worst-case later turns, up to 3", () => {
    expect(turnsThatFit(session({ lastCall, tokensUsed: 0 }), message)).toBe(3);
    expect(turnsThatFit(session({ lastCall, tokensUsed: usedFor(3) }), message)).toBe(3);
    expect(turnsThatFit(session({ lastCall, tokensUsed: usedFor(3) + 1 }), message)).toBe(2);
    expect(turnsThatFit(session({ lastCall, tokensUsed: usedFor(2) + 1 }), message)).toBe(1);
    expect(turnsThatFit(session({ lastCall, tokensUsed: usedFor(1) + 1 }), message)).toBe(0);
  });

  it("counts a longer message against this turn", () => {
    const s = session({ lastCall, tokensUsed: usedFor(1) });

    expect(turnsThatFit(s, message)).toBe(1);
    expect(turnsThatFit(s, `${message}xxxx`)).toBe(0);
  });
});
