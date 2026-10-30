# Plan

v1 is done when the five success criteria in `docs/spec.md` pass.

Open tasks have IDs (T1, T2, ...). Put the ID first in the commit message, chat title, and test notes file name, so `git log --grep T5` finds the work. IDs are never reused or renumbered: a split task gets new IDs. Finished tasks from before 2026-10-30 have none.

## Milestones

- [x] **Spec** — audience, scope, non-goals, session rules, limits, feedback format (`docs/spec.md`)
- [x] **Stack** — pick smallest model + simplest app that meets the quality bar; record in `docs/decisions.md` and `AGENTS.md` (2026-10-28: TS, Vite + React, Hono; Claude Haiku 5.5)
- [x] **Prompts** — interviewer persona (`prompts/personas/persona.md`), notification-service scenario (`prompts/scenarios/notification-service.md`), rubric in `prompts/rubric.md`
- [ ] **Session loop** — Start button, 12-turn cap, warning at turn 10, End Interview, in-memory transcript
- [ ] **Feedback** — post-session call using the rubric; output format from the spec
- [ ] **Limits and failures** — token/length caps, retry-once interviewer, retryable feedback-only failure
- [ ] **Acceptance** — run the spec success criteria on a few real sessions; tune limits after

## Task checklist

- [x] Settle hints policy and correction policy in persona.md
- [x] Copy rubric dimensions into the spec TODO line
- [x] Scaffold `source/`: Vite + React client, Hono server, Vitest, dev proxy for `/api`
- [x] Model client interface plus a mock for tests (includes `MODEL_CLIENT=mock` dev mode)
- [x] Server-held session store with TTL sweep
- [x] Pacing: send "Turn N of 12" with each interviewer call; add a loose pacing guide to the scenario (scoping by ~turn 3, core design by ~turn 8, then deep dives and wrap-up; encourage thinking out loud over polished answers)
- [x] Turn instructions: at turn 10, tell Bubo to mention the session is nearly up and steer to a big-picture wrap-up; on turn 12, tell her to close warmly (server sends markers, `persona.md` holds the wording; the early final turn from the token check comes with T1)
- [x] Session routes: start a session, send a candidate turn, End Interview; enforce the turn cap, busy flag, and message length; retry a failed interviewer call once, then end with `interviewer_failed` (full replies, no streaming yet)
- [x] Tests for turn cap, turn-10 and final-turn instructions, message length, and failure paths (before UI work)
- [x] Implement landing page with a single Start button
- [x] Display interviewer and candidate turns (full replies; streaming comes later)
- [x] Generate feedback on End Interview or turn cap; End mid-reply cancels the in-flight interviewer call (pass an abort signal through `ModelClient`) so the dropped reply stops costing tokens; show a notice when the turn cap ends the interview (the input currently just disappears)
- [x] Show a clear path to retry feedback if that call fails, and when a send finds the interview already ended (409 `interview_over`); tests for the feedback retry path (server and `api.ts`)
- [x] Component tests for the Session screen (add `@testing-library/react` and `jsdom`): Retry Feedback appears on a retryable failure and recovers; a message turned away with `interview_over` shows "Not sent"; Start a New Interview appears after 3 failed retries (not counting `feedback_in_progress`); `feedback_in_progress` re-asks once after 3 seconds
- [x] Confirm before End Interview; lock input and start feedback after the final reply
- [x] After 3 failed Retry Feedback attempts, suggest starting a new interview (a refresh ends the session, so don't promise the feedback comes back). Needs a spec line and a `docs/decisions.md` entry; consider together with the open question on re-asking after `feedback_in_progress`. From the 2026-10-29 bug bash, case 2.
- [x] After feedback: thank-you and "Practice Again"; browser leave-page warning from Start until then

First testable loop is reached here: click through with `MODEL_CLIENT=mock`, then run real sessions.

- [x] **T1** Token check before each call with the feedback reserve; end with `token_cap`; final-turn marker on the last turn that fits; tests
- **T2** Split on 2026-10-30 into T15, T16, and T17 (too big to review as one change).
- [x] **T15** Combine the opening and turn routes' reply handling into one helper, no behavior change. The token check (`turnsThatFit`, marker moves, `token_cap` end) stays in the turn route. Estimate: 30 to 45 minutes.
- [ ] **T16** Stream interviewer replies from Hono to the client over SSE. A retry after a partly streamed failed attempt clears the partial text; End Interview mid-stream still cancels the call. Estimate: 2 to 3 hours.
- [ ] **T17** A turn whose response is lost in transit (or whose stream drops) must not count twice when resent: the client sends a turn ID, the server keeps the last turn's result. Estimate: about 1 hour.
- [ ] **T3** Server pause and resume: record `pausedAt`, block turns while paused, end with `paused_too_long` at the pause limit; tests for the pause limit
- [ ] **T4** Pause screen: hide transcript, disable input, stop check-in timer; Resume and End Interview; limit stated on pause, notice at 25 minutes
- [ ] **T5** Pause check-in banners at 5 and 10 minutes without a sent message (no focus steal, dismissible, cleared on send)
- [ ] **T6** Log the turn count to the browser console in dev builds only
- [ ] **T7** Derive `busy` from `abortCall` in the session (one source for "a call is in flight")
- [ ] **T8** Fit and finish, once functionality is at a high enough quality: a UI cleanup pass. Known so far: focus drops to `<body>` after Start a New Interview or Practice Again (Landing never moves focus); an expired session (`not_found`) during feedback has no button, only the "refresh the page" message. End Interview confirms with the browser's `window.confirm`; consider an in-page confirm that matches the app's tone, if there's room. The thank-you and Practice Again come after the feedback with no announcement; screen reader users only find them by reading to the end.
- [ ] **T9** Accessibility review (manual)
- [ ] **T10** Security review (manual)
- [ ] **T11** Manual tone review of a few transcripts (include: does Bubo work in the turn-10 warning and final close naturally? Does she follow the pacing guide without mentioning turn numbers?)

## Cleanup

Small tasks to pick up between plan items. Not blocking v1.

- [ ] **T12** End the server session when the candidate leaves, instead of leaving it in memory until idle expiry (30 minutes). A route that drops the session, called from Practice Again and Start a New Interview; refresh and tab close via `pagehide` + `navigator.sendBeacon`. Tests for the route, and an update to Leaving in `docs/flow.md`. Estimate: about 1 hour (about 30 minutes without refresh and close).
- [ ] **T13** One failure shape for the client's calls: `TurnResult` carries the error code like `EndResult` and `FeedbackResult`, with one parse helper for all three. `send()` then checks `error === "not_found"` instead of inferring expiry from `ended && !feedbackNext`, and one helper handles an expired session for send, End Interview, and feedback (today it's written three times). Worth doing before Pause adds another way to end. Estimate: about 45 minutes.
- [ ] **T14** Nice to have: move all candidate-facing text, including button text, headings, and labels, into a `shared/strings/` folder grouped by kind (buttons, headings, labels, notices, errors). Changes the AGENTS.md rule that headings, labels, and button text stay in the components, and the 2026-10-29 strings entry in `docs/decisions.md`; update both. Estimate: 1.5 to 2 hours, mostly imports and test lookups.

## Later (not v1)

- Token-cap notices outside the chat. A real interviewer has no token limit, so the token-cap wrap-up and close may break the interview's flow when they come from Bubo. Show a UI notice instead, for both gaps in `docs/decisions.md` (2026-10-30, token check): an early wrap-up when later turns turn out short, and a billed retry that skips the wrap-up or ends with no reply. Revisit with the v2 user flow and views.

- Login before sharing a hosted version. Until then, testers run it locally with their own API key (`docs/decisions.md`, 2026-10-30 sharing entry). Hosting also needs per-account session limits and a spend cap.

- Candidate name (and, with accounts, pronouns) so Bubo can address the candidate by name. v1 keeps the interviewer and feedback in second person.
- Interviewer notes: a periodic notes pass that records rubric evidence with short quotes. Used for compaction (notes plus recent turns) and as the input for feedback. Could allow a higher turn limit; measure cost against a full-transcript baseline first. v1 sends the full transcript; caching keeps it cheap, and follow-ups and feedback evidence need the details.
