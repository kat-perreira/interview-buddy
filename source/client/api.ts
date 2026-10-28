import { ERROR_MESSAGES } from "../shared/strings.ts";

export type StartResult =
  | { ok: true; sessionId: string; reply: string }
  | { ok: false; message: string };

// Starts a session and returns Bubo's opening. Failures come back as a message to show,
// never a throw: the server's own message when it sent one, otherwise start_failed.
export async function startSession(): Promise<StartResult> {
  try {
    const res = await fetch("/api/sessions", { method: "POST" });
    const body = await res.json();
    if (res.ok) {
      if (typeof body?.sessionId === "string" && typeof body.reply === "string") {
        return { ok: true, sessionId: body.sessionId, reply: body.reply };
      }
    } else if (typeof body?.message === "string") {
      return { ok: false, message: body.message };
    }
  } catch {
    // Network error or a body that isn't JSON: fall through to the generic message.
  }
  return { ok: false, message: ERROR_MESSAGES.start_failed };
}
