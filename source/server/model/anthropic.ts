import Anthropic from "@anthropic-ai/sdk";
import {
  FEEDBACK_EFFORT,
  FEEDBACK_MAX_TOKENS,
  INTERVIEWER_EFFORT,
  INTERVIEWER_MAX_TOKENS,
  MODEL_ID,
  REQUEST_TIMEOUT_MS,
} from "../config.ts";
import type { ModelClient, ModelRequest, ModelResult, StopReason } from "./types.ts";

const SETTINGS = {
  interviewer: { maxTokens: INTERVIEWER_MAX_TOKENS, effort: INTERVIEWER_EFFORT },
  feedback: { maxTokens: FEEDBACK_MAX_TOKENS, effort: FEEDBACK_EFFORT },
} as const;

// Pure, so tests can check the request shape without a network call.
export function buildRequest(request: ModelRequest): Anthropic.MessageCreateParamsNonStreaming {
  const { maxTokens, effort } = SETTINGS[request.kind];
  return {
    model: MODEL_ID,
    max_tokens: maxTokens,
    // Thinking counts against max_tokens and could crowd out a 400-token reply.
    thinking: { type: "disabled" },
    output_config: { effort },
    // Automatic caching: each call reuses the cached system prompt and earlier turns.
    cache_control: { type: "ephemeral" },
    system: request.system,
    messages: request.messages,
  };
}

export function toResult(
  message: Pick<Anthropic.Message, "content" | "stop_reason" | "usage">,
): ModelResult {
  const text = message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("");
  const { usage } = message;
  return {
    text,
    stopReason: toStopReason(message.stop_reason),
    usage: {
      input: usage.input_tokens,
      output: usage.output_tokens,
      cacheWrite: usage.cache_creation_input_tokens ?? 0,
      cacheRead: usage.cache_read_input_tokens ?? 0,
    },
  };
}

function toStopReason(reason: Anthropic.StopReason | null): StopReason {
  switch (reason) {
    case "end_turn":
    case "max_tokens":
    case "refusal":
      return reason;
    default:
      return "other";
  }
}

// SDK retries are off: the spec's retry-once policy lives in the session, and
// stacking both would turn one failure into up to six attempts.
export function createSdkClient(apiKey?: string): Anthropic {
  return new Anthropic({ apiKey, maxRetries: 0, timeout: REQUEST_TIMEOUT_MS });
}

export function createAnthropicModelClient(sdk: Anthropic = createSdkClient()): ModelClient {
  return {
    async complete(request, onText) {
      const stream = sdk.messages.stream(buildRequest(request));
      if (onText) stream.on("text", (delta) => onText(delta));
      return toResult(await stream.finalMessage());
    },
  };
}
