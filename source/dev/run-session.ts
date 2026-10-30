// Dev only: plays the canned candidate script against the running server, then asks for
// feedback, and prints how long each call took and the feedback ratings.
// Run `npm run dev` first, then `npm run dev:session` in another terminal.
// Unless the server runs with MODEL_CLIENT=mock, this makes real API calls (about 14).
// Token counts and cost are in the server console's [usage] lines; match them by the
// session ID printed here.

import { parseFeedback, RATING_LABELS, RUBRIC_DIMENSIONS, type Feedback } from "../shared/feedback.ts";
import { CANDIDATE_SCRIPT } from "./candidate-script.ts";

const BASE = `http://localhost:${process.env.PORT || 8787}/api`;
// Longer than two interviewer attempts at the server's 30-second timeout.
const REQUEST_TIMEOUT_MS = 90_000;

async function post(path: string, body?: unknown): Promise<{ status: number; data: any; ms: number }> {
  const started = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, ms: performance.now() - started };
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
// Successful interviewer replies only, so a failed turn's two attempts don't skew the average.
const replyTimes: number[] = [];

function row(label: string, ms: number, detail: string) {
  console.log(`${label.padEnd(10)} ${seconds(ms).padStart(6)}  ${detail}`);
}

async function main() {
  console.log(`Running the canned session against ${BASE}\n`);

  const start = await post("/sessions");
  if (start.status !== 201) throw new Error(`start failed (${start.status}): ${start.data?.error}`);
  const { sessionId } = start.data;
  console.log(`Session ${sessionId}\n`);
  replyTimes.push(start.ms);
  row("opening", start.ms, `${start.data.reply.length} chars`);

  let ended = false;
  for (const [i, message] of CANDIDATE_SCRIPT.entries()) {
    const turn = await post(`/sessions/${sessionId}/turns`, { message });
    if (turn.status !== 200) throw new Error(`turn ${i + 1} failed (${turn.status}): ${turn.data?.error}`);
    const { reply, status, endReason } = turn.data;
    if (reply === null) row(`turn ${i + 1}`, turn.ms, `no reply: ${turn.data.message}`);
    else {
      replyTimes.push(turn.ms);
      row(`turn ${i + 1}`, turn.ms, `${reply.length} chars`);
    }
    if (status !== "active") {
      console.log(`\nInterview ended: ${endReason}`);
      ended = true;
      break;
    }
  }
  if (!ended) {
    console.log("\nThe script ran out before the turn cap; ending the interview.");
    await post(`/sessions/${sessionId}/end`);
  }

  const feedback = await post(`/sessions/${sessionId}/feedback`);
  row("feedback", feedback.ms, feedback.status === 200 ? "ok" : `failed: ${feedback.data?.error}`);

  const average = replyTimes.reduce((a, b) => a + b, 0) / replyTimes.length;
  console.log(`\nAverage interviewer reply: ${seconds(average)}, slowest ${seconds(Math.max(...replyTimes))}`);

  if (feedback.status === 200) {
    const parsed = parseFeedback(feedback.data?.feedback);
    if (parsed) printRatings(parsed);
    else console.log("\nFeedback came back in an unexpected shape.");
  }
}

function printRatings(feedback: Feedback) {
  console.log("\nRatings:");
  for (const { id, label } of RUBRIC_DIMENSIONS) {
    const { rating } = feedback.dimensions[id];
    console.log(`  ${label.padEnd(36)} ${rating === null ? "Not observed" : `${rating} ${RATING_LABELS[rating]}`}`);
  }
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  console.error("Is the server running (npm run dev)?");
  process.exit(1);
});
