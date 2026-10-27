# AI Interview Roleplay

Text-only system design interview practice. v1: one owl interviewer (language only), one scenario (design a notification service), one local user, no accounts. Spec: `docs/spec.md`.

## Stack

Not chosen yet (open question in the spec). Prefer the smallest model and simplest app stack that meets the quality bar.

## Conventions

- Treat `docs/spec.md` as the source of truth for v1 scope. Do not add personas, scenarios, avatars, voice, diagrams, accounts, or saved history.
- Keep `docs/plan.md` and `docs/decisions.md` current when you change direction.
- Interviewer voice and feedback tone: technically rigorous, emotionally safe. Strengths first; critique the transcript, not the person; use "not observed" instead of guessing.
- Prompts live in `prompts/`: persona (`prompts/personas/`), rubric, and scenarios.
- Application code lives in `source/` (not `src/`, to avoid clashing with this repo’s parent folder `src/`).

## How to run

TBD after stack choice. Until then: read the spec, then work the checklist in `docs/plan.md`.
