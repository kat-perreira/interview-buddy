import { createAnthropicModelClient } from "./anthropic.ts";
import { createMockModelClient } from "./mock.ts";
import type { ModelClient } from "./types.ts";

// MODEL_CLIENT=mock runs the app against the scripted mock: no key, no API calls.
export function createModelClient(env: NodeJS.ProcessEnv = process.env): ModelClient {
  if (env.MODEL_CLIENT === "mock") return createMockModelClient({ delayMs: 30 });
  return createAnthropicModelClient();
}
