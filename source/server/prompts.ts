import { readFileSync } from "node:fs";

const PROMPTS_DIR = new URL("../../prompts/", import.meta.url);

// The interviewer's system prompt. Same text on every call, so it stays cached.
export const INTERVIEWER_PROMPT_FILES = [
  "personas/persona.md",
  "scenarios/notification-service.md",
  "rubric.md",
];

// The feedback call's system prompt. No persona: feedback is written in a plain voice.
export const FEEDBACK_PROMPT_FILES = [
  "feedback.md",
  "scenarios/notification-service.md",
  "rubric.md",
];

// Read once at startup. In dev, `npm run dev` restarts the server when a prompt file changes.
function loadPrompt(files: string[]): string {
  return files.map((file) => readFileSync(new URL(file, PROMPTS_DIR), "utf8").trim()).join("\n\n");
}

export const loadSystemPrompt = () => loadPrompt(INTERVIEWER_PROMPT_FILES);
export const loadFeedbackPrompt = () => loadPrompt(FEEDBACK_PROMPT_FILES);
