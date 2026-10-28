import { MAX_MESSAGE_CHARS } from "./limits.ts";

// Every error and failure message the candidate can see, for the server and the client.
// Calm and plain; never blames the candidate (docs/spec.md, Failure Handling).
export const ERROR_MESSAGES = {
  // Request errors, sent as { error, message } with a 4xx or 5xx status.
  start_failed: "Bubo couldn't start the interview just now. Please try again.",
  not_found: "This session has ended. Start a new one to keep practicing.",
  interview_over: "This interview has already ended.",
  busy: "Bubo is still replying. Your message can go once she's done.",
  empty_message: "Type a message to send.",
  too_long: `Messages can be up to ${MAX_MESSAGE_CHARS.toLocaleString("en-US")} characters. Try splitting this one up.`,

  // Sent with a turn result when Bubo's reply failed twice and the interview ended.
  interviewer_failed:
    "Something went wrong on our side, so the interview ends here. Your feedback is next, based on everything you said.",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;
