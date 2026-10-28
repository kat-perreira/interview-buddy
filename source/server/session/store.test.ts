import { afterEach, describe, expect, it, vi } from "vitest";
import { PAUSED_SESSION_TTL_MS, PAUSE_LIMIT_MS, SESSION_TTL_MS } from "../config.ts";
import { createSessionStore } from "./store.ts";

// A clock the test moves by hand.
function fakeClock(start = 1_000_000) {
  let time = start;
  return { now: () => time, advance: (ms: number) => (time += ms) };
}

describe("createSessionStore", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates an active, empty session that get() returns", () => {
    const store = createSessionStore();

    const session = store.create();

    expect(session).toMatchObject({
      status: "active",
      endReason: null,
      transcript: [],
      candidateTurns: 0,
      tokensUsed: 0,
      lastCall: null,
      busy: false,
      pausedAt: null,
    });
    expect(store.get(session.id)).toBe(session);
  });

  it("gives each session a distinct ID", () => {
    const store = createSessionStore();

    expect(store.create().id).not.toBe(store.create().id);
  });

  it("returns undefined for an unknown ID", () => {
    expect(createSessionStore().get("nope")).toBeUndefined();
  });

  it("defaults to the configured TTL", () => {
    const clock = fakeClock();
    const store = createSessionStore({ now: clock.now });
    const session = store.create();

    clock.advance(SESSION_TTL_MS - 1);
    expect(store.get(session.id)).toBe(session);

    clock.advance(1);
    expect(store.get(session.id)).toBeUndefined();
  });

  it("drops an expired session on lookup, without waiting for a sweep", () => {
    const clock = fakeClock();
    const store = createSessionStore({ ttlMs: 1_000, now: clock.now });
    const session = store.create();

    clock.advance(1_000);

    expect(store.get(session.id)).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it("gives a paused session the longer paused TTL", () => {
    const clock = fakeClock();
    const store = createSessionStore({ now: clock.now });
    const session = store.create();
    session.pausedAt = clock.now();

    clock.advance(SESSION_TTL_MS);
    expect(store.get(session.id)).toBe(session);

    clock.advance(PAUSED_SESSION_TTL_MS - SESSION_TTL_MS);
    expect(store.get(session.id)).toBeUndefined();
  });

  it("keeps a paused session past the pause limit, so the limit ends it first", () => {
    expect(PAUSED_SESSION_TTL_MS).toBeGreaterThan(PAUSE_LIMIT_MS);
  });

  it("pushes back expiry on touch", () => {
    const clock = fakeClock();
    const store = createSessionStore({ ttlMs: 1_000, now: clock.now });
    const session = store.create();

    clock.advance(900);
    store.touch(session);
    clock.advance(900);

    expect(store.get(session.id)).toBe(session);
  });

  it("sweeps only expired sessions", () => {
    const clock = fakeClock();
    const store = createSessionStore({ ttlMs: 1_000, now: clock.now });
    const idle = store.create();
    clock.advance(500);
    const recent = store.create();
    clock.advance(500);

    expect(store.sweep()).toBe(1);
    expect(store.get(idle.id)).toBeUndefined();
    expect(store.get(recent.id)).toBe(recent);
  });

  it("deletes a session", () => {
    const store = createSessionStore();
    const session = store.create();

    store.delete(session.id);

    expect(store.get(session.id)).toBeUndefined();
  });

  it("sweeps on an interval until stopped", () => {
    vi.useFakeTimers();
    const clock = fakeClock();
    const store = createSessionStore({ ttlMs: 1_000, now: clock.now });
    store.create();
    const stop = store.startSweep(100);

    clock.advance(1_000);
    vi.advanceTimersByTime(100);
    expect(store.size).toBe(0);

    stop();
    store.create();
    clock.advance(1_000);
    vi.advanceTimersByTime(100);
    expect(store.size).toBe(1);
  });
});
