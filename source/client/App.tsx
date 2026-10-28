import { useState } from "react";
import { Landing } from "./Landing.tsx";

type Screen =
  | { screen: "landing" }
  | { screen: "session"; sessionId: string; opening: string };

export function App() {
  const [view, setView] = useState<Screen>({ screen: "landing" });

  if (view.screen === "landing") {
    return (
      <Landing onStarted={(sessionId, opening) => setView({ screen: "session", sessionId, opening })} />
    );
  }

  // Stub session screen: shows Bubo's opening only. The "Display interviewer and
  // candidate turns" task replaces it with the transcript and input.
  return (
    <main>
      <p className="speaker">Bubo</p>
      <p className="reply">{view.opening}</p>
    </main>
  );
}
