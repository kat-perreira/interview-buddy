import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Feedback } from "../shared/feedback.ts";
import { MAX_MESSAGE_CHARS, messageLength } from "../shared/limits.ts";
import { ERROR_MESSAGES, UI_MESSAGES } from "../shared/strings.ts";
import {
  canRetryFeedback,
  endSession,
  REASK_DELAY_MS,
  requestFeedback,
  RETRIES_BEFORE_NEW_INTERVIEW,
  sendTurn,
} from "./api.ts";
import { FeedbackView } from "./Feedback.tsx";

// `notSent`: the server turned the message away because the interview had already ended.
type Turn = { speaker: "bubo" | "you"; text: string; notSent?: boolean };

type Props = {
  sessionId: string;
  opening: string;
  onNewInterview: () => void;
};

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
  // Retry feedback attempts that failed. The automatic first request doesn't count, and
  // still being written (feedback_in_progress) isn't a failure.
  const [retryFailures, setRetryFailures] = useState(0);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const feedbackHeadingRef = useRef<HTMLHeadingElement>(null);
  const sendingRef = useRef(false);
  const endingRef = useRef(false);
  // Mirrors `ended` for handlers mid-await, which can't see state change: End and a turn
  // result can each arrive while the other is out.
  const endedRef = useRef(false);
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

  function lockInput() {
    endedRef.current = true;
    setEnded(true);
  }

  async function send() {
    const message = draft.trim();
    // A ref, not `waiting`, so two submits before a re-render can't both get through.
    if (sendingRef.current || endingRef.current || tooLong || endedRef.current) return;
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

    // End interview landed while this turn was out, so feedback is this handler's to ask for
    // (docs/flow.md, Ending mid-reply). The reply is usually dropped, but if Bubo's final
    // reply finished before End arrived, it's kept.
    if (endedRef.current) {
      if (result.ok) {
        const { reply } = result;
        if (reply !== null) setTurns((t) => [...t, { speaker: "bubo", text: reply }]);
        if (result.message) setNotice(result.message);
      }
      void loadFeedback();
      return;
    }

    if (result.ok) {
      const { reply } = result;
      if (reply !== null) setTurns((t) => [...t, { speaker: "bubo", text: reply }]);
      setNotice(result.message ?? (result.ended ? UI_MESSAGES.interview_complete : null));
      if (result.ended) {
        lockInput();
        void loadFeedback();
      }
    } else {
      // The message didn't land: take it back out of the transcript and restore the draft.
      // If the interview is over the composer is gone, so the message stays visible instead.
      if (!result.ended) {
        setTurns((t) => t.slice(0, -1));
        setDraft(message);
      }
      if (result.ended) lockInput();
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

  // End interview, after the candidate confirms. Allowed while Bubo is replying: the server
  // drops that reply, and send() asks for feedback once its result arrives (docs/flow.md,
  // Ending mid-reply). Asking here too would get feedback_in_progress.
  async function end() {
    if (endingRef.current || endedRef.current) return;
    if (!window.confirm(UI_MESSAGES.end_confirm)) return;

    endingRef.current = true;
    const result = await endSession(sessionId);
    endingRef.current = false;

    // A turn result ended the interview while this request was out, and handled it.
    if (endedRef.current) return;
    if (!result.ok && result.error === "not_found") {
      // The session expired, so there's no feedback to ask for.
      lockInput();
      setError(result.message);
      headingRef.current?.focus();
      return;
    }
    if (!result.ok && result.error !== "interview_over") {
      setError(result.message);
      return;
    }
    // Ended by this request, or (interview_over) another way first.
    setError(null);
    setNotice(UI_MESSAGES.interview_complete);
    lockInput();
    if (!sendingRef.current) void loadFeedback();
    // The composer unmounts; move focus to the heading, not <body>.
    headingRef.current?.focus();
  }

  // Called from the handlers that end the interview, not an effect, so StrictMode's
  // double-run in dev can't send two feedback requests. Retry feedback calls it again
  // with `isRetry`, so only its failures count toward offering a new interview.
  async function loadFeedback(isRetry = false) {
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
    if (isRetry && !result.ok && result.error !== "feedback_in_progress") {
      setRetryFailures((n) => n + 1);
    }
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
            {/* Not disabled while Bubo replies: the candidate can always end (docs/spec.md). */}
            <button type="button" onClick={() => void end()}>
              End interview
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

      {offerRetry && retryFailures >= RETRIES_BEFORE_NEW_INTERVIEW && (
        <p className="notice" role="status">
          {UI_MESSAGES.feedback_try_new_interview}
        </p>
      )}
      {offerRetry && (
        <div className="actions">
          {/* Stays mounted and focusable while a retry runs (aria-disabled, not disabled, which
              drops focus to <body>); the ref guard in loadFeedback ignores extra clicks. */}
          <button
            type="button"
            aria-disabled={writingFeedback}
            onClick={() => void loadFeedback(true)}
          >
            Retry feedback
          </button>
          {/* Inactive while a retry runs, so leaving can't strand a feedback call in flight. */}
          {retryFailures >= RETRIES_BEFORE_NEW_INTERVIEW && (
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
