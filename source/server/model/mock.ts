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
export const MOCK_FAIL = "[mock:fail]";
export const MOCK_REFUSE = "[mock:refuse]";

export function createMockModelClient(
  options: { steps?: MockStep[]; delayMs?: number } = {},
): MockModelClient {
  const steps = [...(options.steps ?? [])];
  const calls: ModelRequest[] = [];

  return {
    calls,
    async complete(request, onText) {
      calls.push(request);
      const step = steps.shift() ?? defaultStep(request, calls.length);
      if ("error" in step) throw step.error;

      const text = step.stopReason === "refusal" ? "" : step.text;
      for (const delta of text.split(/(?<= )/)) {
        if (options.delayMs) await sleep(options.delayMs);
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

function defaultStep(request: ModelRequest, callNumber: number): MockStep {
  const lastMessage = request.messages.at(-1)?.content ?? "";
  if (lastMessage.includes(MOCK_FAIL)) return { error: new Error("Mock model failure") };
  if (lastMessage.includes(MOCK_REFUSE)) return { text: "", stopReason: "refusal" };
  return { text: `Mock ${request.kind} reply ${callNumber}. No API call was made.` };
}

// Rough English estimate: about four characters per token.
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
