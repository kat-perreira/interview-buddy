# Plan

v1 is done when the five success criteria in `docs/spec.md` pass.

## Milestones

- [x] **Spec** — audience, scope, non-goals, session rules, limits, feedback format (`docs/spec.md`)
- [x] **Stack** — pick smallest model + simplest app that meets the quality bar; record in `docs/decisions.md` and `AGENTS.md` (2026-10-28: TS, Vite + React, Hono; Claude Haiku 5.5)
- [x] **Prompts** — interviewer persona (`prompts/personas/persona.md`), notification-service scenario (`prompts/scenarios/notification-service.md`), rubric in `prompts/rubric.md`
- [ ] **Session loop** — Start button, 12-turn cap, warning at turn 10, End interview, in-memory transcript
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
- [x] Turn instructions: at turn 10, tell Bubo to mention the session is nearly up and steer to a big-picture wrap-up; on turn 12, tell her to close warmly (server sends markers, `persona.md` holds the wording; the early final turn from the token check comes with the token check)
- [x] Session routes: start a session, send a candidate turn, End interview; enforce the turn cap, busy flag, and message length; retry a failed interviewer call once, then end with `interviewer_failed` (full replies, no streaming yet)
- [x] Tests for turn cap, turn-10 and final-turn instructions, message length, and failure paths (before UI work)
- [x] Implement landing page with a single Start button
- [x] Display interviewer and candidate turns (full replies; streaming comes later)
- [x] Generate feedback on End interview or turn cap; End mid-reply cancels the in-flight interviewer call (pass an abort signal through `ModelClient`) so the dropped reply stops costing tokens; show a notice when the turn cap ends the interview (the input currently just disappears)
- [ ] Show a clear path to retry feedback if that call fails, and when a send finds the interview already ended (409 `interview_over`); tests for the feedback retry path
- [ ] Confirm before End interview; lock input and start feedback after the final reply
- [ ] After feedback: thank-you and "Practice again"; browser leave-page warning from Start until then

First testable loop is reached here: click through with `MODEL_CLIENT=mock`, then run real sessions.

- [ ] Token check before each call with the feedback reserve; end with `token_cap`; final-turn marker on the last turn that fits; tests
- [ ] Stream interviewer replies from Hono to the client; combine the opening and turn routes' reply handling into one helper while changing both; a turn whose response is lost in transit must not count twice when resent
- [ ] Server pause and resume: record `pausedAt`, block turns while paused, end with `paused_too_long` at the pause limit; tests for the pause limit
- [ ] Pause screen: hide transcript, disable input, stop check-in timer; Resume and End interview; limit stated on pause, notice at 25 minutes
- [ ] Pause check-in banners at 5 and 10 minutes without a sent message (no focus steal, dismissible, cleared on send)
- [ ] Log the turn count to the browser console in dev builds only
- [ ] Derive `busy` from `abortCall` in the session (one source for "a call is in flight")
- [ ] Manual tone review of a few transcripts (include: does Bubo work in the turn-10 warning and final close naturally? Does she follow the pacing guide without mentioning turn numbers?)

## Later (not v1)

- Candidate name (and, with accounts, pronouns) so Bubo can address the candidate by name. v1 keeps the interviewer and feedback in second person.
- Interviewer notes: a periodic notes pass that records rubric evidence with short quotes. Used for compaction (notes plus recent turns) and as the input for feedback. Could allow a higher turn limit; measure cost against a full-transcript baseline first. v1 sends the full transcript; caching keeps it cheap, and follow-ups and feedback evidence need the details.
