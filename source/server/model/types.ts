// The seam between session logic and the model provider.
// Session code and tests depend only on this file, never on the SDK.

// Which of the two calls this is. The Anthropic client uses it to pick that call's
// max_tokens and effort, and the mock uses it to pick a canned reply. Session code sets it:
// buildInterviewerRequest for Bubo's replies, buildFeedbackRequest for feedback.
export type CallKind = "interviewer" | "feedback";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ModelRequest {
  kind: CallKind;
  system: string;
  messages: ChatMessage[];
  // A JSON schema the reply must match (structured output). Omitted for plain text.
  schema?: Record<string, unknown>;
}

// Token counts from the API's usage report. Thinking, when on, is inside `output`.
export interface TokenUsage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

// "refusal" is a normal response, not an error; the session treats it like a failed reply.
export type StopReason = "end_turn" | "max_tokens" | "refusal" | "other";

export interface ModelResult {
  text: string;
  stopReason: StopReason;
  usage: TokenUsage;
}

export interface CompleteOptions {
  // Receives text deltas as they stream.
  onText?: (delta: string) => void;
  // Aborting cancels the call, which then rejects.
  signal?: AbortSignal;
}

export interface ModelClient {
  // Resolves when the reply is complete.
  // Rejects on API errors, timeouts, and aborts; the session decides whether to retry.
  complete(request: ModelRequest, options?: CompleteOptions): Promise<ModelResult>;
}

// Everything counts toward the session cap, cached or not.
export function totalTokens(usage: TokenUsage): number {
  return usage.input + usage.output + usage.cacheWrite + usage.cacheRead;
}
