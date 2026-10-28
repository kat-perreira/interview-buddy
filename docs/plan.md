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
- [ ] Server-held session store with TTL sweep
- [ ] Pacing: send "Turn N of 12" with each interviewer call; add a loose pacing guide to the scenario (scoping by ~turn 3, core design by ~turn 8, then deep dives and wrap-up)
- [ ] Tests for turn cap, turn-10 warning, message length, token cap with feedback reserve, and failure paths (before UI work)
- [ ] Stream interviewer replies from Hono to the client
- [ ] Implement landing page with a single Start button
- [ ] Stream or display interviewer and candidate turns
- [ ] Generate feedback on End interview or turn cap
- [ ] Show a clear path to retry feedback if that call fails
- [ ] Manual tone review of a few transcripts
