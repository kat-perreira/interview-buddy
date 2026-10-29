import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MAX_MESSAGE_CHARS, messageLength } from "../shared/limits.ts";
import { ERROR_MESSAGES } from "../shared/strings.ts";
import { sendTurn } from "./api.ts";

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
  // A server message that comes with an ended interview (interviewer_failed).
  const [notice, setNotice] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  // Screen reader cue that the interview has started.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Keep the newest turn in view. Skipped for the opening so focus stays on the heading.
  useEffect(() => {
    if (turns.length > 1 || waiting) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [turns.length, waiting]);

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
      setNotice(result.message);
      // Feedback after the interview ends comes with the feedback task.
      setEnded(result.ended);
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
        {waiting && <p className="thinking">Bubo is thinking…</p>}
      </div>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

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
