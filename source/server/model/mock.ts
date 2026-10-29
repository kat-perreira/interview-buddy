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

export function createMockModelClient(
  options: { steps?: MockStep[]; delayMs?: number } = {},
): MockModelClient {
  const steps = [...(options.steps ?? [])];
  const calls: ModelRequest[] = [];

  return {
    calls,
    async complete(request, { onText, signal } = {}) {
      calls.push(request);
      signal?.throwIfAborted();
      const step = steps.shift() ?? defaultStep(request, calls);
      if ("error" in step) throw step.error;

      const text = step.stopReason === "refusal" ? "" : step.text;
      for (const delta of text.split(/(?<= )/)) {
        if (options.delayMs) await sleep(options.delayMs, signal);
        onText?.(delta);
      }

      return {
        text,
        stopReason: step.stopReason ?? "end_turn",
        usage: {
          input: estimateTokens(request.system + request.messages.map((m) => m.content).join("")),
          output: estimateTokens(text) + (step.thinkingTokens ?? 0),
          cacheWrite: 0,
          cacheRead: 0,
          ...step.usage,
        },
      };
    },
  };
}

// `calls` already includes this request.
function defaultStep(request: ModelRequest, calls: ModelRequest[]): MockStep {
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
  return { text: `Mock ${request.kind} reply ${calls.length}. No API call was made.` };
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
