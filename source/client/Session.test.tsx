// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockFeedback } from "../server/model/mock.ts";
import { ERROR_MESSAGES, UI_MESSAGES } from "../shared/strings.ts";
import {
  endSession,
  REASK_DELAY_MS,
  requestFeedback,
  RETRIES_BEFORE_NEW_INTERVIEW,
  sendTurn,
  type EndResult,
  type FeedbackResult,
  type TurnResult,
} from "./api.ts";
import { Session } from "./Session.tsx";

// The calls are mocked; canRetryFeedback and the constants stay real, so the screen follows
// the actual retry rule.
vi.mock("./api.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api.ts")>()),
  sendTurn: vi.fn(),
  endSession: vi.fn(),
  requestFeedback: vi.fn(),
}));

const sendTurnMock = vi.mocked(sendTurn);
const endSessionMock = vi.mocked(endSession);
const requestFeedbackMock = vi.mocked(requestFeedback);

const FEEDBACK_OK: FeedbackResult = { ok: true, feedback: mockFeedback() };
const FEEDBACK_FAILED: FeedbackResult = {
  ok: false,
  message: ERROR_MESSAGES.feedback_failed,
  error: "feedback_failed",
};
const FEEDBACK_IN_PROGRESS: FeedbackResult = {
  ok: false,
  message: ERROR_MESSAGES.feedback_in_progress,
  error: "feedback_in_progress",
};

function renderSession(onNewInterview = vi.fn()) {
  render(<Session sessionId="abc" opening="Hoo, hello!" onNewInterview={onNewInterview} />);
  return onNewInterview;
}

// Sends one message and lets the turn and any feedback request settle.
async function send(message: string) {
  fireEvent.change(screen.getByLabelText("Your response"), { target: { value: message } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
  });
}

// Sends a message whose reply ends the interview, which starts the feedback request.
async function endInterview() {
  sendTurnMock.mockResolvedValueOnce({ ok: true, reply: "Thanks!", ended: true, message: null });
  await send("Last answer");
}

// Clicks End interview and answers the confirm. Lets the end request settle.
async function clickEnd(confirmed = true) {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(confirmed);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "End interview" }));
  });
  return confirm;
}

async function clickRetry(times = 1) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry feedback" }));
    });
  }
}

beforeEach(() => {
  // jsdom has no layout, so it leaves this out.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe("Session", () => {
  // The tests below use the constants, so pin them here. Retries: docs/spec.md, Failure
  // Handling. Re-ask wait: docs/flow.md, Feedback. Update the docs before changing these.
  it("uses the documented retry threshold and re-ask wait", () => {
    expect(RETRIES_BEFORE_NEW_INTERVIEW).toBe(3);
    expect(REASK_DELAY_MS).toBe(3000);
  });

  it("offers Retry feedback on a retryable failure and shows the feedback once it works", async () => {
    requestFeedbackMock.mockResolvedValueOnce(FEEDBACK_FAILED).mockResolvedValueOnce(FEEDBACK_OK);
    renderSession();

    await endInterview();
    expect(screen.getByRole("alert").textContent).toBe(ERROR_MESSAGES.feedback_failed);
    expect(screen.queryByRole("heading", { name: "Your feedback" })).toBeNull();

    await clickRetry();
    expect(requestFeedbackMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { name: "Your feedback" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry feedback" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("doesn't offer Retry feedback when another try can't help", async () => {
    requestFeedbackMock.mockResolvedValueOnce({
      ok: false,
      message: ERROR_MESSAGES.not_found,
      error: "not_found",
    });
    renderSession();

    await endInterview();
    expect(screen.getByRole("alert").textContent).toBe(ERROR_MESSAGES.not_found);
    expect(screen.queryByRole("button", { name: "Retry feedback" })).toBeNull();
  });

  it("marks a message turned away with interview_over as Not sent and asks for feedback", async () => {
    sendTurnMock.mockResolvedValueOnce({
      ok: false,
      message: ERROR_MESSAGES.interview_over,
      ended: true,
      feedbackNext: true,
    });
    requestFeedbackMock.mockResolvedValueOnce(FEEDBACK_OK);
    renderSession();

    await send("Too late");
    const transcript = screen.getByRole("log", { name: "Transcript" });
    expect(transcript.textContent?.split("Too late")).toHaveLength(2);
    expect(transcript.textContent).toContain(UI_MESSAGES.not_sent);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByLabelText("Your response")).toBeNull();
    expect(requestFeedbackMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Your feedback" })).toBeTruthy();
  });

  it("offers Start a new interview after enough failed retries, and keeps Retry feedback", async () => {
    requestFeedbackMock.mockResolvedValue(FEEDBACK_FAILED);
    const onNewInterview = renderSession();

    // The automatic request, then all but the last retry.
    await endInterview();
    await clickRetry(RETRIES_BEFORE_NEW_INTERVIEW - 1);
    expect(screen.queryByText(UI_MESSAGES.feedback_try_new_interview)).toBeNull();
    expect(screen.queryByRole("button", { name: "Start a new interview" })).toBeNull();

    await clickRetry();
    expect(screen.getByText(UI_MESSAGES.feedback_try_new_interview)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry feedback" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start a new interview" }));
    expect(onNewInterview).toHaveBeenCalledTimes(1);
  });

  it("doesn't count feedback_in_progress as a failed retry", async () => {
    vi.useFakeTimers();
    requestFeedbackMock
      .mockResolvedValueOnce(FEEDBACK_FAILED)
      // Retry 1: still in progress, and still in progress on the re-ask.
      .mockResolvedValueOnce(FEEDBACK_IN_PROGRESS)
      .mockResolvedValueOnce(FEEDBACK_IN_PROGRESS)
      .mockResolvedValue(FEEDBACK_FAILED);
    renderSession();

    await endInterview();
    await clickRetry();
    await act(() => vi.advanceTimersByTimeAsync(REASK_DELAY_MS));
    expect(requestFeedbackMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("button", { name: "Retry feedback" })).toBeTruthy();

    // Counting the in-progress retry, this would be enough.
    await clickRetry(RETRIES_BEFORE_NEW_INTERVIEW - 1);
    expect(screen.queryByText(UI_MESSAGES.feedback_try_new_interview)).toBeNull();
    expect(screen.queryByRole("button", { name: "Start a new interview" })).toBeNull();

    await clickRetry();
    expect(screen.getByText(UI_MESSAGES.feedback_try_new_interview)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start a new interview" })).toBeTruthy();
  });

  it("counts only Retry feedback failures, even when the automatic request ends in progress", async () => {
    vi.useFakeTimers();
    requestFeedbackMock
      .mockResolvedValueOnce(FEEDBACK_IN_PROGRESS)
      .mockResolvedValueOnce(FEEDBACK_IN_PROGRESS)
      .mockResolvedValue(FEEDBACK_FAILED);
    renderSession();

    await endInterview();
    await act(() => vi.advanceTimersByTimeAsync(REASK_DELAY_MS));
    await clickRetry(RETRIES_BEFORE_NEW_INTERVIEW - 1);
    expect(screen.queryByRole("button", { name: "Start a new interview" })).toBeNull();

    await clickRetry();
    expect(screen.getByText(UI_MESSAGES.feedback_try_new_interview)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start a new interview" })).toBeTruthy();
  });

  it("re-asks once, a short wait after feedback_in_progress", async () => {
    vi.useFakeTimers();
    requestFeedbackMock.mockResolvedValueOnce(FEEDBACK_IN_PROGRESS).mockResolvedValueOnce(FEEDBACK_OK);
    renderSession();

    await endInterview();
    expect(requestFeedbackMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(UI_MESSAGES.writing_feedback)).toBeTruthy();

    await act(() => vi.advanceTimersByTimeAsync(REASK_DELAY_MS - 1));
    expect(requestFeedbackMock).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(requestFeedbackMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { name: "Your feedback" })).toBeTruthy();
    expect(screen.queryByText(UI_MESSAGES.writing_feedback)).toBeNull();
  });

  it("re-asks only once, then offers Retry feedback if it's still in progress", async () => {
    vi.useFakeTimers();
    requestFeedbackMock.mockResolvedValue(FEEDBACK_IN_PROGRESS);
    renderSession();

    await endInterview();
    await act(() => vi.advanceTimersByTimeAsync(REASK_DELAY_MS * 3));
    expect(requestFeedbackMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert").textContent).toBe(ERROR_MESSAGES.feedback_in_progress);
    expect(screen.getByRole("button", { name: "Retry feedback" })).toBeTruthy();
  });

  it("locks input and starts feedback after Bubo's final reply", async () => {
    requestFeedbackMock.mockResolvedValueOnce(FEEDBACK_OK);
    renderSession();

    await endInterview();
    expect(screen.getByText("Thanks!")).toBeTruthy();
    expect(screen.queryByLabelText("Your response")).toBeNull();
    expect(screen.queryByRole("button", { name: "End interview" })).toBeNull();
    expect(requestFeedbackMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Your feedback" })).toBeTruthy();
  });

  it("asks before End interview and keeps going if the candidate cancels", async () => {
    renderSession();

    const confirm = await clickEnd(false);
    expect(confirm).toHaveBeenCalledWith(UI_MESSAGES.end_confirm);
    expect(endSessionMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Your response")).toBeTruthy();
  });

  it("ends after the candidate confirms, locks input, and asks for feedback", async () => {
    let finishFeedback: (result: FeedbackResult) => void = () => {};
    endSessionMock.mockResolvedValueOnce({ ok: true });
    requestFeedbackMock.mockReturnValueOnce(new Promise((resolve) => (finishFeedback = resolve)));
    renderSession();

    await clickEnd();
    expect(endSessionMock).toHaveBeenCalledWith("abc");
    expect(screen.queryByLabelText("Your response")).toBeNull();
    expect(screen.getByText(UI_MESSAGES.interview_complete)).toBeTruthy();
    expect(requestFeedbackMock).toHaveBeenCalledTimes(1);

    await act(async () => finishFeedback(FEEDBACK_OK));
    expect(screen.getByRole("heading", { name: "Your feedback" })).toBeTruthy();
  });

  it("ending mid-reply asks for feedback once, after the dropped reply's result", async () => {
    let finishTurn: (result: TurnResult) => void = () => {};
    sendTurnMock.mockReturnValueOnce(new Promise((resolve) => (finishTurn = resolve)));
    endSessionMock.mockResolvedValueOnce({ ok: true });
    requestFeedbackMock.mockResolvedValueOnce(FEEDBACK_OK);
    renderSession();

    await send("Half an answer");
    await clickEnd();
    expect(endSessionMock).toHaveBeenCalledTimes(1);
    expect(requestFeedbackMock).not.toHaveBeenCalled();

    await act(async () => finishTurn({ ok: true, reply: null, ended: true, message: null }));
    expect(requestFeedbackMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Your feedback" })).toBeTruthy();
  });

  it("keeps the interview going and shows the message when ending fails", async () => {
    endSessionMock.mockResolvedValueOnce({
      ok: false,
      message: ERROR_MESSAGES.end_failed,
      error: null,
    });
    renderSession();

    await clickEnd();
    expect(screen.getByRole("alert").textContent).toBe(ERROR_MESSAGES.end_failed);
    expect(screen.getByLabelText("Your response")).toBeTruthy();
    expect(requestFeedbackMock).not.toHaveBeenCalled();
  });

  it("ends and asks for feedback when End finds the interview already over", async () => {
    endSessionMock.mockResolvedValueOnce({
      ok: false,
      message: ERROR_MESSAGES.interview_over,
      error: "interview_over",
    });
    requestFeedbackMock.mockResolvedValueOnce(FEEDBACK_OK);
    renderSession();

    await clickEnd();
    expect(screen.queryByLabelText("Your response")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(requestFeedbackMock).toHaveBeenCalledTimes(1);
  });

  it("locks input with no feedback request when End finds the session expired", async () => {
    endSessionMock.mockResolvedValueOnce({
      ok: false,
      message: ERROR_MESSAGES.not_found,
      error: "not_found",
    });
    renderSession();

    await clickEnd();
    expect(screen.queryByLabelText("Your response")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe(ERROR_MESSAGES.not_found);
    expect(requestFeedbackMock).not.toHaveBeenCalled();
  });

  it("stays ended and asks for feedback when the dropped turn's request fails after End", async () => {
    let finishTurn: (result: TurnResult) => void = () => {};
    sendTurnMock.mockReturnValueOnce(new Promise((resolve) => (finishTurn = resolve)));
    endSessionMock.mockResolvedValueOnce({ ok: true });
    requestFeedbackMock.mockResolvedValueOnce(FEEDBACK_OK);
    renderSession();

    await send("Half an answer");
    await clickEnd();
    await act(async () =>
      finishTurn({
        ok: false,
        message: ERROR_MESSAGES.send_failed,
        ended: false,
        feedbackNext: false,
      }),
    );
    expect(screen.queryByLabelText("Your response")).toBeNull();
    expect(requestFeedbackMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Your feedback" })).toBeTruthy();
  });

  it("keeps Bubo's final reply and asks for feedback once when it lands before End's response", async () => {
    let finishTurn: (result: TurnResult) => void = () => {};
    let finishEnd: (result: EndResult) => void = () => {};
    sendTurnMock.mockReturnValueOnce(new Promise((resolve) => (finishTurn = resolve)));
    endSessionMock.mockReturnValueOnce(new Promise((resolve) => (finishEnd = resolve)));
    requestFeedbackMock.mockResolvedValueOnce(FEEDBACK_OK);
    renderSession();

    await send("Last answer");
    await clickEnd();
    await act(async () => finishTurn({ ok: true, reply: "Thanks!", ended: true, message: null }));
    await act(async () =>
      finishEnd({
        ok: false,
        message: ERROR_MESSAGES.interview_over,
        error: "interview_over",
      }),
    );
    expect(screen.getByText("Thanks!")).toBeTruthy();
    expect(requestFeedbackMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Your feedback" })).toBeTruthy();
  });
});
