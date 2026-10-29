import { afterEach, describe, expect, it, vi } from "vitest";
import { ERROR_MESSAGES } from "../shared/strings.ts";
import { endSession, sendTurn, startSession } from "./api.ts";

function stubFetch(impl: () => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("startSession", () => {
  it("returns the session ID and opening reply on success", async () => {
    const fetchMock = stubFetch(async () =>
      Response.json(
        { sessionId: "abc", reply: "Hoo, hello!", turn: 0, status: "active", endReason: null },
        { status: 201 },
      ),
    );

    expect(await startSession()).toEqual({ ok: true, sessionId: "abc", reply: "Hoo, hello!" });
    expect(fetchMock).toHaveBeenCalledWith("/api/sessions", { method: "POST" });
  });

  it("passes the server's message through when the start fails", async () => {
    stubFetch(async () =>
      Response.json({ error: "start_failed", message: "Server says try again." }, { status: 502 }),
    );

    expect(await startSession()).toEqual({ ok: false, message: "Server says try again." });
  });

  it("falls back to start_failed when the request never reaches the server", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(await startSession()).toEqual({ ok: false, message: ERROR_MESSAGES.start_failed });
  });

  it("treats a success without a session ID or reply as a failed start", async () => {
    stubFetch(async () => Response.json({ ok: true }, { status: 201 }));

    expect(await startSession()).toEqual({ ok: false, message: ERROR_MESSAGES.start_failed });
  });

  it("falls back to start_failed when the body isn't JSON", async () => {
    stubFetch(async () => new Response("Bad Gateway", { status: 502 }));

    expect(await startSession()).toEqual({ ok: false, message: ERROR_MESSAGES.start_failed });
  });
});

describe("sendTurn", () => {
  it("posts the message and returns Bubo's reply", async () => {
    const fetchMock = stubFetch(async () =>
      Response.json({ reply: "Good question.", turn: 1, status: "active", endReason: null }),
    );

    expect(await sendTurn("abc", "How many users?")).toEqual({
      ok: true,
      reply: "Good question.",
      ended: false,
      message: null,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/sessions/abc/turns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "How many users?" }),
    });
  });

  it("marks the interview ended when the reply closes it", async () => {
    stubFetch(async () =>
      Response.json({ reply: "Thanks!", turn: 12, status: "feedback_pending", endReason: "turn_cap" }),
    );

    expect(await sendTurn("abc", "Done.")).toEqual({
      ok: true,
      reply: "Thanks!",
      ended: true,
      message: null,
    });
  });

  it("passes interviewer_failed through with no reply", async () => {
    stubFetch(async () =>
      Response.json({
        reply: null,
        message: ERROR_MESSAGES.interviewer_failed,
        turn: 3,
        status: "feedback_pending",
        endReason: "interviewer_failed",
      }),
    );

    expect(await sendTurn("abc", "Hi")).toEqual({
      ok: true,
      reply: null,
      ended: true,
      message: ERROR_MESSAGES.interviewer_failed,
    });
  });

  it("keeps the interview open on a request error like busy", async () => {
    stubFetch(async () => Response.json({ error: "busy", message: "Still replying." }, { status: 409 }));

    expect(await sendTurn("abc", "Hi")).toEqual({ ok: false, message: "Still replying.", ended: false });
  });

  it("marks the interview ended when the session is gone", async () => {
    stubFetch(async () =>
      Response.json({ error: "not_found", message: "Session ended." }, { status: 404 }),
    );

    expect(await sendTurn("abc", "Hi")).toEqual({ ok: false, message: "Session ended.", ended: true });
  });

  it("falls back to send_failed when the request never reaches the server", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(await sendTurn("abc", "Hi")).toEqual({
      ok: false,
      message: ERROR_MESSAGES.send_failed,
      ended: false,
    });
  });

  it("treats a success without a status as a failed send", async () => {
    stubFetch(async () => Response.json({ reply: "Hi" }));

    expect(await sendTurn("abc", "Hi")).toEqual({
      ok: false,
      message: ERROR_MESSAGES.send_failed,
      ended: false,
    });
  });
});

describe("endSession", () => {
  it("posts to the end route", async () => {
    const fetchMock = stubFetch(async () =>
      Response.json({ turn: 2, status: "feedback_pending", endReason: "candidate" }),
    );

    expect(await endSession("abc")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/sessions/abc/end", { method: "POST" });
  });

  it("passes the server's message through when ending fails", async () => {
    stubFetch(async () =>
      Response.json({ error: "interview_over", message: "Already ended." }, { status: 409 }),
    );

    expect(await endSession("abc")).toEqual({ ok: false, message: "Already ended." });
  });

  it("falls back to end_failed when the request never reaches the server", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(await endSession("abc")).toEqual({ ok: false, message: ERROR_MESSAGES.end_failed });
  });
});
