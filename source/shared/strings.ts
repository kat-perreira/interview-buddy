import { MAX_MESSAGE_CHARS } from "./limits.ts";

// Every message the candidate can see, for the server and the client (docs/decisions.md).
// Headings, labels, and button text stay in the components.
// Calm and plain; never blames the candidate (docs/spec.md, Failure Handling).

// Notices and status lines, alphabetized.
export const UI_MESSAGES = {
  bubo_thinking: "Bubo is thinking…",
  // The warning before End Interview ends the session (docs/spec.md, Principles).
  end_confirm:
    "End the interview now? Your feedback comes next, based on the conversation so far. Anything you haven't sent won't be included.",
  // Shown above the feedback. Hearing feedback is the hard part, so it opens warmly.
  feedback_intro:
    "You did it. Practicing out loud takes nerve, and every session makes the next one easier. Here's what went well and what to work on next.",
  // After several failed Retry Feedback attempts, with Retry Feedback and Start a New Interview.
  // A refresh or new session drops this one, so it doesn't promise the feedback comes back.
  feedback_try_new_interview:
    "Your feedback still couldn't be written. You can keep trying, or start a new interview. A new interview ends this one without feedback.",
  // Shown when the interview ends normally (turn cap or End Interview).
  interview_complete: "Good job, that's the end of the interview. Your feedback is coming next.",
  // Under a message the server turned away because the interview had already ended.
  not_sent: "Not sent. The interview had already ended, so this message isn't part of your feedback.",
  // After the feedback, above Practice Again (docs/spec.md, After feedback).
  thank_you: "Thanks for practicing today. Whenever you're ready, you can start another interview.",
  writing_feedback: "Writing your feedback…",
} as const;

// Errors and failures, alphabetized. Request errors go out as { error, message }
// with a 4xx or 5xx status; "client-only" ones never come from the server.
export const ERROR_MESSAGES = {
  busy: "Bubo is still replying. Your message can go once she's done.",
  empty_message: "Type a message to send.",
  // Client-only.
  end_failed: "The interview couldn't end just now. Please try again.",
  feedback_failed:
    "Your feedback couldn't be written just now. Your interview is still here, so nothing is lost.",
  feedback_in_progress: "Your feedback is already being written.",
  feedback_not_ready: "The interview is still going. Feedback comes when it ends.",
  interview_over: "This interview has already ended.",
  // Sent with a turn result when Bubo's reply failed twice and the interview ended.
  interviewer_failed:
    "Something went wrong on our side, so the interview ends here. Your feedback is next, based on your responses.",
  not_found:
    "This session has ended. To keep practicing, refresh the page. That starts a new interview from the beginning.",
  // Client-only.
  send_failed: "Your message didn't reach Bubo. Please try sending it again.",
  start_failed: "Bubo couldn't start the interview just now. Please try again.",
  too_long: `Messages can be up to ${MAX_MESSAGE_CHARS.toLocaleString("en-US")} characters. Please try a shorter response.`,
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;
