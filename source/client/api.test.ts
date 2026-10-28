import { afterEach, describe, expect, it, vi } from "vitest";
import { ERROR_MESSAGES } from "../shared/strings.ts";
import { startSession } from "./api.ts";

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
