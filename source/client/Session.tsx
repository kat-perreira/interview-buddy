import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Feedback } from "../shared/feedback.ts";
import { MAX_MESSAGE_CHARS, messageLength } from "../shared/limits.ts";
import { ERROR_MESSAGES, UI_MESSAGES } from "../shared/strings.ts";
import { canRetryFeedback, requestFeedback, sendTurn } from "./api.ts";
import { FeedbackView } from "./Feedback.tsx";

// `notSent`: the server turned the message away because the interview had already ended.
type Turn = { speaker: "bubo" | "you"; text: string; notSent?: boolean };

type Props = {
  sessionId: string;
  opening: string;
  onNewInterview: () => void;
};

// Spec, Failure Handling: after this many failed Retry feedback attempts, also offer a new
// interview. Retry feedback stays.
const RETRIES_BEFORE_NEW_INTERVIEW = 3;

// After feedback_in_progress, ask once more on our own after this long.
const REASK_DELAY_MS = 3000;

export function Session({ sessionId, opening, onNewInterview }: Props) {
  const [turns, setTurns] = useState<Turn[]>([{ speaker: "bubo", text: opening }]);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Why the interview ended and that feedback is next: the server's message
  // (interviewer_failed) or the normal end notice.
  const [notice, setNotice] = useState<string | null>(null);
  const [writingFeedback, setWritingFeedback] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // The last feedback request failed in a way another try could fix.
  const [offerRetry, setOfferRetry] = useState(false);
  // Feedback requests that failed, the first automatic one included. Still being written
  // (feedback_in_progress) isn't a failure, so it doesn't count.
  const [feedbackFailures, setFeedbackFailures] = useState(0);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const feedbackHeadingRef = useRef<HTMLHeadingElement>(null);
  const sendingRef = useRef(false);
  const feedbackRequestedRef = useRef(false);

  // Screen reader cue that the interview has started.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Keep the newest turn in view. Skipped for the opening so focus stays on the heading.
  useEffect(() => {
    if (turns.length > 1 || waiting) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [turns.length, waiting, writingFeedback]);

  // Feedback arrived: move focus to its heading, which also scrolls it into view.
  useEffect(() => {
    if (feedback) feedbackHeadingRef.current?.focus();
  }, [feedback]);

  const length = messageLength(draft.trim());
  const tooLong = length > MAX_MESSAGE_CHARS;

  async function send() {
    const message = draft.trim();
    // A ref, not `waiting`, so two submits before a re-render can't both get through.
    if (sendingRef.current || tooLong || ended) return;
    if (!message) {
      setError(ERROR_MESSAGES.empty_message);
      return;
    }

    sendingRef.current = true;
    setTurns((t) => [...t, { speaker: "you", text: message }]);
    setDraft("");
    setError(null);
    setWaiting(true);
    const result = await sendTurn(sessionId, message);
    setWaiting(false);
    sendingRef.current = false;

    if (result.ok) {
      const { reply } = result;
      if (reply !== null) setTurns((t) => [...t, { speaker: "bubo", text: reply }]);
      setNotice(result.message ?? (result.ended ? UI_MESSAGES.interview_complete : null));
      setEnded(result.ended);
      if (result.ended) void loadFeedback();
    } else {
      // The message didn't land: take it back out of the transcript and restore the draft.
      // If the interview is over the composer is gone, so the message stays visible instead.
      if (!result.ended) {
        setTurns((t) => t.slice(0, -1));
        setDraft(message);
      }
      setEnded(result.ended);
      // Ended some other way (End interview, say) with the session still there: feedback is next.
      if (result.feedbackNext) {
        setTurns((t) => [...t.slice(0, -1), { speaker: "you", text: message, notSent: true }]);
        setNotice(result.message);
        void loadFeedback();
      } else {
        setError(result.message);
      }
    }
    // The composer unmounts when the interview ends; move focus to the heading, not <body>.
    if (result.ended) headingRef.current?.focus();
    else inputRef.current?.focus();
  }

  // Called from the handler that ends the interview, not an effect, so StrictMode's
  // double-run in dev can't send two feedback requests. Retry feedback calls it again.
  async function loadFeedback() {
    // A ref, so a double click on Retry feedback can't send two requests.
    if (feedbackRequestedRef.current) return;
    feedbackRequestedRef.current = true;
    setError(null);
    setWritingFeedback(true);
    let result = await requestFeedback(sessionId);
    // Still being written (say a lost response, or a request racing this one): the server
    // hands over the stored feedback once it's done, so wait and ask once more on our own.
    if (!result.ok && result.error === "feedback_in_progress") {
      await new Promise((resolve) => setTimeout(resolve, REASK_DELAY_MS));
      result = await requestFeedback(sessionId);
    }
    setWritingFeedback(false);
    feedbackRequestedRef.current = false;
    // "Feedback is coming next" is out of date either way.
    setNotice(null);
    const retryable = !result.ok && canRetryFeedback(result.error);
    setOfferRetry(retryable);
    if (!result.ok && result.error !== "feedback_in_progress") setFeedbackFailures((n) => n + 1);
    if (result.ok) setFeedback(result.feedback);
    else setError(result.message);
    // Retry feedback unmounts on a final failure; move focus to the heading, not <body>.
    if (!result.ok && !retryable) headingRef.current?.focus();
  }

  // Enter adds a new line, so long answers are easy to write; Cmd/Ctrl+Enter sends.
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <main>
      <h1 ref={headingRef} tabIndex={-1}>
        Interview with Bubo
      </h1>

      <div role="log" aria-label="Transcript">
        {turns.map((turn, i) => (
          <div key={i}>
            <p className={`speaker ${turn.speaker}`}>{turn.speaker === "bubo" ? "Bubo" : "You"}</p>
            <p className="reply">{turn.text}</p>
            {turn.notSent && <p className="hint">{UI_MESSAGES.not_sent}</p>}
          </div>
        ))}
        {waiting && <p className="thinking">{UI_MESSAGES.bubo_thinking}</p>}
      </div>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      {writingFeedback && (
        <p className="thinking" role="status">
          {UI_MESSAGES.writing_feedback}
        </p>
      )}

      {feedback && <FeedbackView feedback={feedback} headingRef={feedbackHeadingRef} />}

      {!ended && (
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor="message" className="visually-hidden">
            Your response
          </label>
          {/* readOnly rather than disabled while Bubo replies, so focus and dictation stay put. */}
          <textarea
            id="message"
            ref={inputRef}
            rows={5}
            value={draft}
            readOnly={waiting}
            aria-describedby={tooLong ? "message-hint message-too-long" : "message-hint"}
            aria-invalid={tooLong}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="composer-row">
            <p id="message-hint" className={tooLong ? "hint error" : "hint"}>
              {length.toLocaleString("en-US")} / {MAX_MESSAGE_CHARS.toLocaleString("en-US")} · Cmd
              or Ctrl+Enter to send
            </p>
            <button type="submit" disabled={waiting}>
              Send
            </button>
          </div>
          {tooLong && (
            <p id="message-too-long" className="error" role="status">
              {ERROR_MESSAGES.too_long}
            </p>
          )}
        </form>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {offerRetry && feedbackFailures > RETRIES_BEFORE_NEW_INTERVIEW && (
        <p className="notice" role="status">
          {UI_MESSAGES.feedback_try_new_interview}
        </p>
      )}
      {offerRetry && (
        <div className="actions">
          {/* Stays mounted and focusable while a retry runs (aria-disabled, not disabled, which
              drops focus to <body>); the ref guard in loadFeedback ignores extra clicks. */}
          <button type="button" aria-disabled={writingFeedback} onClick={() => void loadFeedback()}>
            Retry feedback
          </button>
          {/* Inactive while a retry runs, so leaving can't strand a feedback call in flight. */}
          {feedbackFailures > RETRIES_BEFORE_NEW_INTERVIEW && (
            <button
              type="button"
              aria-disabled={writingFeedback}
              onClick={() => {
                if (!writingFeedback) onNewInterview();
              }}
            >
              Start a new interview
            </button>
          )}
        </div>
      )}
      <div ref={bottomRef} />
    </main>
  );
}
