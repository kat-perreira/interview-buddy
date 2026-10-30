import { RUBRIC_DIMENSIONS, type Feedback } from "../../shared/feedback.ts";
import type { ModelClient, ModelRequest, StopReason, TokenUsage } from "./types.ts";

// One scripted reply. `thinkingTokens` adds to output usage without adding text,
// the way thinking does on the real API.
export type MockStep =
  | { text: string; stopReason?: StopReason; thinkingTokens?: number; usage?: Partial<TokenUsage> }
  | { error: Error };

export interface MockModelClient extends ModelClient {
  calls: ModelRequest[];
}

// Typing one of these as the candidate in dev mock mode triggers the failure paths.
// Feedback has its own trigger: the feedback call sees the whole transcript, so a
// [mock:fail] that ended the interview would otherwise fail its feedback too.
// [mock:feedback-fail-once] fails only the first feedback call for a transcript, so a
// retry succeeds.
export const MOCK_FAIL = "[mock:fail]";
export const MOCK_REFUSE = "[mock:refuse]";
export const MOCK_FEEDBACK_FAIL = "[mock:feedback-fail]";
export const MOCK_FEEDBACK_FAIL_ONCE = "[mock:feedback-fail-once]";
// Every call whose request holds this, anywhere, reports this many more input tokens, as if
// a long document stayed in the conversation. Brings the token cap within a few turns.
export const MOCK_HEAVY = "[mock:heavy]";
export const MOCK_HEAVY_TOKENS = 12_000;

// `log` prints one [mock] line per call to the server console (dev mock mode only).
export function createMockModelClient(
  options: { steps?: MockStep[]; delayMs?: number; log?: boolean } = {},
): MockModelClient {
  const steps = [...(options.steps ?? [])];
  const calls: ModelRequest[] = [];

  return {
    calls,
    async complete(request, { onText, signal } = {}) {
      calls.push(request);
      signal?.throwIfAborted();
      const requestText = request.system + request.messages.map((m) => m.content).join("");
      const heavy = requestText.includes(MOCK_HEAVY) ? MOCK_HEAVY_TOKENS : 0;
      const input = estimateTokens(requestText) + heavy;
      const turn = describeTurn(request);
      const log = (outcome: string) => {
        if (options.log) {
          console.log(`[mock] call ${calls.length}: ${request.kind}, ${turn}, ~${input} input tokens, ${outcome}`);
        }
      };
      const step = steps.shift() ?? defaultStep(request, calls, `${turn}, ~${input} input tokens`);
      if ("error" in step) {
        log("error");
        throw step.error;
      }

      const text = step.stopReason === "refusal" ? "" : step.text;
      try {
        for (const delta of text.split(/(?<= )/)) {
          if (options.delayMs) await sleep(options.delayMs, signal);
          onText?.(delta);
        }
      } catch (error) {
        log("aborted");
        throw error;
      }
      log(step.stopReason ?? "end_turn");

      return {
        text,
        stopReason: step.stopReason ?? "end_turn",
        usage: {
          input,
          output: estimateTokens(text) + (step.thinkingTokens ?? 0),
          cacheWrite: 0,
          cacheRead: 0,
          ...step.usage,
        },
      };
    },
  };
}

// `calls` already includes this request. `details` goes into the canned interviewer reply.
function defaultStep(request: ModelRequest, calls: ModelRequest[], details: string): MockStep {
  const lastMessage = request.messages.at(-1)?.content ?? "";
  if (request.kind === "feedback") {
    if (lastMessage.includes(MOCK_FEEDBACK_FAIL)) return { error: new Error("Mock model failure") };
    // Fail if no earlier feedback call sent this exact transcript. Mock replies number
    // themselves by call, so two sessions' transcripts never match.
    if (lastMessage.includes(MOCK_FEEDBACK_FAIL_ONCE)) {
      const tries = calls.filter(
        (c) => c.kind === "feedback" && c.messages.at(-1)?.content === lastMessage,
      ).length;
      if (tries === 1) return { error: new Error("Mock model failure") };
    }
    return { text: JSON.stringify(mockFeedback()) };
  }
  if (lastMessage.includes(MOCK_FAIL)) return { error: new Error("Mock model failure") };
  if (lastMessage.includes(MOCK_REFUSE)) return { text: "", stopReason: "refusal" };
  return {
    text:
      `Mock ${request.kind} reply (call ${calls.length} since server start): ` +
      `${details}. No API call was made.`,
  };
}

// What Bubo would have been told: the last message's turn note and any marker, so
// "[Turn 10 of 12] [Wrap-up]" becomes "turn 10 of 12, Wrap-up". Brackets are dropped
// because the reply is stored in the transcript, which never holds turn notes.
function describeTurn(request: ModelRequest): string {
  if (request.kind === "feedback") return "transcript";
  const last = request.messages.at(-1)?.content ?? "";
  const note = last.match(/^\[Turn \d+ of \d+\]( \[[^\]]+\])*/)?.[0];
  if (!note) return "opening";
  return note.slice(1, -1).replace("Turn", "turn").split("] [").join(", ");
}

// Valid feedback with one "not observed" dimension, so the client shows both kinds of row.
export function mockFeedback(): Feedback {
  const dimensions = Object.fromEntries(
    RUBRIC_DIMENSIONS.map((d, i) => [
      d.id,
      i === RUBRIC_DIMENSIONS.length - 1
        ? { rating: null, evidence: "Not observed in this session." }
        : { rating: (i % 4) + 1, evidence: `Mock evidence for ${d.label.toLowerCase()}.` },
    ]),
  ) as Feedback["dimensions"];
  return {
    summary: "Mock feedback. No API call was made.",
    dimensions,
    strengths: ["Mock strength one.", "Mock strength two."],
    improvements: ["Mock area to improve one.", "Mock area to improve two."],
    practiceSteps: ["Mock practice step one.", "Mock practice step two.", "Mock practice step three."],
  };
}

// Rough English estimate: about four characters per token.
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Rejects as soon as the signal aborts, the way a cancelled API call does.
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
