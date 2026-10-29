import { useState } from "react";
import { startSession } from "./api.ts";
import { OWL } from "./owl.ts";

type Props = {
  onStarted: (sessionId: string, opening: string) => void;
};

export function Landing({ onStarted }: Props) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setError(null);
    const result = await startSession();
    if (result.ok) {
      onStarted(result.sessionId, result.reply);
    } else {
      // Spec, Failure Handling: a calm message, with Start still available.
      setError(result.message);
      setStarting(false);
    }
  }

  return (
    <main>
      <pre className="owl" aria-hidden="true">
        {OWL}
      </pre>
      <h1>Interview Buddy</h1>
      <p>Practice a system design interview with Bubo.</p>
      <p>Today's problem: design a notification service.</p>
      <ul>
        <li>You have about 12 turns, text only</li>
        <li>End anytime; feedback comes at the end</li>
        <li>A refresh ends the session</li>
      </ul>
      <button type="button" onClick={start} disabled={starting}>
        {starting ? "Starting…" : "Start Interview"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
