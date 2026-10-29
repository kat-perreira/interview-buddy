import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import {
  FEEDBACK_EFFORT,
  FEEDBACK_MAX_TOKENS,
  INTERVIEWER_EFFORT,
  INTERVIEWER_MAX_TOKENS,
  MODEL_ID,
} from "../config.ts";
import { buildRequest, createSdkClient, toResult } from "./anthropic.ts";
import type { ModelRequest } from "./types.ts";

const interviewerRequest: ModelRequest = {
  kind: "interviewer",
  system: "You are the interviewer.",
  messages: [{ role: "user", content: "Hello" }],
};

describe("buildRequest", () => {
  it("sets the interviewer cap, thinking off, and effort explicitly", () => {
    const params = buildRequest(interviewerRequest);

    expect(params).toEqual({
      model: MODEL_ID,
      max_tokens: INTERVIEWER_MAX_TOKENS,
      thinking: { type: "disabled" },
      output_config: { effort: INTERVIEWER_EFFORT },
      cache_control: { type: "ephemeral" },
      system: "You are the interviewer.",
      messages: [{ role: "user", content: "Hello" }],
    });
  });

  it("uses the feedback cap and effort for feedback calls", () => {
    const params = buildRequest({ ...interviewerRequest, kind: "feedback" });

    expect(params.max_tokens).toBe(FEEDBACK_MAX_TOKENS);
    expect(params.output_config).toEqual({ effort: FEEDBACK_EFFORT });
  });

  it("asks for structured output when the request has a schema", () => {
    const schema = { type: "object", properties: {}, additionalProperties: false };
    const params = buildRequest({ ...interviewerRequest, kind: "feedback", schema });

    expect(params.output_config).toEqual({
      effort: FEEDBACK_EFFORT,
      format: { type: "json_schema", schema },
    });
  });

  it("sends no sampling parameters, which the model rejects", () => {
    const params = buildRequest(interviewerRequest);

    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("top_p");
    expect(params).not.toHaveProperty("top_k");
  });
});

function message(
  content: unknown[],
  stopReason: Anthropic.StopReason | null,
  usage: Partial<Anthropic.Usage>,
): Pick<Anthropic.Message, "content" | "stop_reason" | "usage"> {
  return {
    content: content as Anthropic.ContentBlock[],
    stop_reason: stopReason,
    usage: { input_tokens: 0, output_tokens: 0, ...usage } as Anthropic.Usage,
  };
}

describe("toResult", () => {
  it("joins text blocks and skips thinking blocks", () => {
    const result = toResult(
      message(
        [
          { type: "thinking", thinking: "", signature: "sig" },
          { type: "text", text: "Hoo, " },
          { type: "text", text: "let's begin." },
        ],
        "end_turn",
        {},
      ),
    );

    expect(result.text).toBe("Hoo, let's begin.");
    expect(result.stopReason).toBe("end_turn");
  });

  it("maps usage, treating missing cache counts as zero", () => {
    const result = toResult(
      message([], "end_turn", {
        input_tokens: 120,
        output_tokens: 80,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: 2000,
      }),
    );

    expect(result.usage).toEqual({ input: 120, output: 80, cacheWrite: 0, cacheRead: 2000 });
  });

  it("passes refusals and max_tokens through, and folds other reasons", () => {
    expect(toResult(message([], "refusal", {})).stopReason).toBe("refusal");
    expect(toResult(message([], "max_tokens", {})).stopReason).toBe("max_tokens");
    expect(toResult(message([], "pause_turn", {})).stopReason).toBe("other");
  });
});

describe("createSdkClient", () => {
  it("turns off SDK retries so the session's retry-once is the only retry", () => {
    expect(createSdkClient("test-key").maxRetries).toBe(0);
  });
});
