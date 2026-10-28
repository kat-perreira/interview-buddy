import { useEffect, useState } from "react";

type ServerStatus = "checking" | "ok" | "unreachable";

// Placeholder until the landing page task. Checks the /api proxy end to end.
export function App() {
  const [status, setStatus] = useState<ServerStatus>("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => setStatus(res.ok ? "ok" : "unreachable"))
      .catch(() => setStatus("unreachable"));
  }, []);

  return (
    <main>
      <h1>InterviewBuddy</h1>
      <p>Server: {status}</p>
    </main>
  );
}
