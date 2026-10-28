// The seam between session logic and the model provider.
// Session code and tests depend only on this file, never on the SDK.

export type CallKind = "interviewer" | "feedback";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ModelRequest {
  kind: CallKind;
  system: string;
  messages: ChatMessage[];
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

export interface ModelClient {
  // Resolves when the reply is complete. `onText` receives text deltas as they stream.
  // Rejects on API errors and timeouts; the session decides whether to retry.
  complete(request: ModelRequest, onText?: (delta: string) => void): Promise<ModelResult>;
}

// Everything counts toward the session cap, cached or not.
export function totalTokens(usage: TokenUsage): number {
  return usage.input + usage.output + usage.cacheWrite + usage.cacheRead;
}
