import { useState } from "react";
import { Landing } from "./Landing.tsx";
import { Session } from "./Session.tsx";

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

  return (
    <Session
      key={view.sessionId}
      sessionId={view.sessionId}
      opening={view.opening}
      onNewInterview={() => setView({ screen: "landing" })}
    />
  );
}
