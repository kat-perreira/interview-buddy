import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Feedback } from "../shared/feedback.ts";
import { MAX_MESSAGE_CHARS, messageLength } from "../shared/limits.ts";
import { ERROR_MESSAGES, UI_MESSAGES } from "../shared/strings.ts";
import { requestFeedback, sendTurn } from "./api.ts";
import { FeedbackView } from "./Feedback.tsx";

type Turn = { speaker: "bubo" | "you"; text: string };

type Props = {
  sessionId: string;
  opening: string;
};

export function Session({ sessionId, opening }: Props) {
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

  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const feedbackHeadingRef = useRef<HTMLHeadingElement>(null);
  const sendingRef = useRef(false);

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
      setError(result.message);
      setEnded(result.ended);
    }
    // The composer unmounts when the interview ends; move focus to the heading, not <body>.
    if (result.ended) headingRef.current?.focus();
    else inputRef.current?.focus();
  }

  // Called from the handler that ends the interview, not an effect, so StrictMode's
  // double-run in dev can't send two feedback requests.
  async function loadFeedback() {
    setWritingFeedback(true);
    const result = await requestFeedback(sessionId);
    setWritingFeedback(false);
    // "Feedback is coming next" is out of date either way.
    setNotice(null);
    if (result.ok) setFeedback(result.feedback);
    else setError(result.message);
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
      <div ref={bottomRef} />
    </main>
  );
}
