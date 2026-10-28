import { PAUSED_SESSION_TTL_MS, SESSION_TTL_MS } from "../config.ts";
import type { Session } from "./types.ts";

export interface SessionStore {
  create(): Session;
  // Undefined if the ID is unknown or the session has expired.
  get(id: string): Session | undefined;
  // Marks activity, pushing back expiry.
  touch(session: Session): void;
  delete(id: string): void;
  // Drops expired sessions and returns how many were dropped.
  sweep(): number;
  // Sweeps on an interval until the returned function is called.
  startSweep(intervalMs: number): () => void;
  readonly size: number;
}

// In memory only; nothing is written to disk. `now` is injectable so tests control time.
export function createSessionStore(
  options: { ttlMs?: number; pausedTtlMs?: number; now?: () => number } = {},
): SessionStore {
  const ttlMs = options.ttlMs ?? SESSION_TTL_MS;
  const pausedTtlMs = options.pausedTtlMs ?? PAUSED_SESSION_TTL_MS;
  const now = options.now ?? Date.now;
  const sessions = new Map<string, Session>();

  const isExpired = (session: Session) =>
    now() - session.lastActiveAt >= (session.pausedAt === null ? ttlMs : pausedTtlMs);

  // A plain function, not a method, so startSweep's timer doesn't depend on `this`.
  function sweep(): number {
    let dropped = 0;
    for (const [id, session] of sessions) {
      if (isExpired(session)) {
        sessions.delete(id);
        dropped++;
      }
    }
    return dropped;
  }

  return {
    create() {
      const session: Session = {
        id: crypto.randomUUID(),
        status: "active",
        endReason: null,
        transcript: [],
        candidateTurns: 0,
        tokensUsed: 0,
        lastCall: null,
        busy: false,
        pausedAt: null,
        lastActiveAt: now(),
      };
      sessions.set(session.id, session);
      return session;
    },

    // Checks expiry here too, so behavior doesn't depend on when the sweep last ran.
    get(id) {
      const session = sessions.get(id);
      if (!session) return undefined;
      if (isExpired(session)) {
        sessions.delete(id);
        return undefined;
      }
      return session;
    },

    touch(session) {
      session.lastActiveAt = now();
    },

    delete(id) {
      sessions.delete(id);
    },

    sweep,

    startSweep(intervalMs) {
      const timer = setInterval(sweep, intervalMs);
      // Don't keep the process alive just for the sweep.
      timer.unref();
      return () => clearInterval(timer);
    },

    get size() {
      return sessions.size;
    },
  };
}
