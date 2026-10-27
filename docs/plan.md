# Plan

v1 is done when the five success criteria in `docs/spec.md` pass.

## Milestones

- [x] **Spec** — audience, scope, non-goals, session rules, limits, feedback format (`docs/spec.md`)
- [ ] **Stack** — pick smallest model + simplest app that meets the quality bar; record in `docs/decisions.md` and `AGENTS.md`
- [x] **Prompts** — interviewer persona (`prompts/personas/persona.md`), notification-service scenario (`prompts/scenarios/notification-service.md`), rubric in `prompts/rubric.md`
- [ ] **Session loop** — Start button, 12-turn cap, warning at turn 10, End interview, in-memory transcript
- [ ] **Feedback** — post-session call using the rubric; output format from the spec
- [ ] **Limits and failures** — token/length caps, retry-once interviewer, retryable feedback-only failure
- [ ] **Acceptance** — run the spec success criteria on a few real sessions; tune limits after

## Task checklist

- [x] Settle hints policy and correction policy in persona.md
- [x] Copy rubric dimensions into the spec TODO line
- [ ] Implement landing page with a single Start button
- [ ] Stream or display interviewer and candidate turns
- [ ] Generate feedback on End interview or turn cap
- [ ] Show a clear path to retry feedback if that call fails
- [ ] Manual tone review of a few transcripts
