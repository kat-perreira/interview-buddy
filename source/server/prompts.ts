import { readFileSync } from "node:fs";

const PROMPTS_DIR = new URL("../../prompts/", import.meta.url);

// The interviewer's system prompt. Same text on every call, so it stays cached.
export const PROMPT_FILES = [
  "personas/persona.md",
  "scenarios/notification-service.md",
  "rubric.md",
];

// Read once at startup. In dev, `npm run dev` restarts the server when a prompt file changes.
export function loadSystemPrompt(): string {
  return PROMPT_FILES.map((file) => readFileSync(new URL(file, PROMPTS_DIR), "utf8").trim()).join(
    "\n\n",
  );
}
