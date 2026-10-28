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
- [ ] Pacing: send "Turn N of 12" with each interviewer call; add a loose pacing guide to the scenario (scoping by ~turn 3, core design by ~turn 8, then deep dives and wrap-up; encourage thinking out loud over polished answers)
- [ ] Turn instructions: at turn 10, tell Bubo to mention time is nearly up and steer to a big-picture wrap-up; on the final turn (turn 12, or the last turn the token check allows), tell her to close warmly
- [ ] Server pause and resume: record `pausedAt`, block turns while paused, end with `paused_too_long` at the pause limit
- [ ] Tests for turn cap, turn-10 and final-turn instructions, message length, token cap with feedback reserve, pause limit, and failure paths (before UI work)
- [ ] Stream interviewer replies from Hono to the client
- [ ] Implement landing page with a single Start button
- [ ] Stream or display interviewer and candidate turns
- [ ] Generate feedback on End interview or turn cap
- [ ] Show a clear path to retry feedback if that call fails
- [ ] Pause check-in banners at 5 and 10 minutes without a sent message (no focus steal, dismissible, cleared on send)
- [ ] Pause screen: hide transcript, disable input, stop check-in timer; Resume and End interview; limit stated on pause, notice at 25 minutes
- [ ] Confirm before End interview; lock input and start feedback after the final reply
- [ ] After feedback: thank-you and "Practice again"; browser leave-page warning from Start until then
- [ ] Log the turn count to the browser console in dev builds only
- [ ] Manual tone review of a few transcripts (include: does Bubo work in the turn-10 warning and final close naturally?)

## Later (not v1)

- Candidate name (and, with accounts, pronouns) so Bubo can address the candidate by name. v1 keeps the interviewer and feedback in second person.
- Transcript compaction (summarizing earlier turns) if longer sessions need it. v1 sends the full transcript; caching keeps it cheap, and follow-ups and feedback evidence need the details.
