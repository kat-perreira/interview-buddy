// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockFeedback } from "../server/model/mock.ts";
import { requestFeedback, sendTurn, startSession } from "./api.ts";
import { App } from "./App.tsx";

vi.mock("./api.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api.ts")>()),
  startSession: vi.fn(),
  sendTurn: vi.fn(),
  requestFeedback: vi.fn(),
}));

const startSessionMock = vi.mocked(startSession);
const sendTurnMock = vi.mocked(sendTurn);
const requestFeedbackMock = vi.mocked(requestFeedback);

// Fires the event the browser sends on refresh or tab close. Returns whether the page asked
// to warn first.
function leavePageWarns() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

beforeEach(() => {
  // jsdom has no layout, so it leaves this out.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("App", () => {
  it("warns before leaving from Start until Practice Again returns to the landing page", async () => {
    startSessionMock.mockResolvedValueOnce({ ok: true, sessionId: "abc", reply: "Hoo, hello!" });
    sendTurnMock.mockResolvedValueOnce({ ok: true, reply: "Thanks!", ended: true, message: null });
    requestFeedbackMock.mockResolvedValueOnce({ ok: true, feedback: mockFeedback() });
    render(<App />);
    expect(leavePageWarns()).toBe(false);

    await click("Start Interview");
    expect(leavePageWarns()).toBe(true);

    fireEvent.change(screen.getByLabelText("Your response"), { target: { value: "Last answer" } });
    await click("Send");
    expect(screen.getByRole("heading", { name: "Your feedback" })).toBeTruthy();
    expect(leavePageWarns()).toBe(true);

    await click("Practice Again");
    expect(screen.getByRole("button", { name: "Start Interview" })).toBeTruthy();
    expect(leavePageWarns()).toBe(false);
  });
});
