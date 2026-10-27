# AI Interview Roleplay

Text-only system design interview practice. v1: one owl interviewer (language only), one scenario (design a notification service), one local user, no accounts. Full scope in `docs/spec.md`.

## Hard rules (v1)

- Follow `docs/spec.md`. It defines scope, session rules, limits, and failure handling.
- Do not add personas, scenarios, avatars, voice, diagrams, accounts, or saved history.
- Do not persist transcripts. A session lives in memory and a refresh ends it.
- The candidate can always end the session, and is warned before it ends.
- Do not change limits (turn cap, token caps) without updating the spec and `docs/decisions.md`.
- Open questions (stack, model and hosting, hints and correction policy, rubric dimensions) are not yours to settle silently. Ask, then record the answer in `docs/decisions.md`.
- Keep `docs/plan.md` and `docs/decisions.md` current when direction changes.
- When you finish a task listed in `docs/plan.md`, check it off in the same change, but only if it meets the matching success criterion in `docs/spec.md` (where one applies). Say which box you checked. Never check off **Acceptance** or manual-review items yourself; they need real sessions, so ask the user.

## Stack

Not chosen yet. Prefer the smallest model and simplest app stack that meets the quality bar. Keep compute low everywhere: capped turns and tokens, prompt caching for the system prompt and rubric.

## Prompts

- Layout: persona in `prompts/personas/`, scenarios in `prompts/scenarios/`, rubric in `prompts/rubric.md`.
- `docs/owl-character.md` is design notes for the persona. Never load it into a prompt or copy it into one; distill only behavior-changing traits into `persona.md`.
- Shared rules (tone, safety, output format, feedback and scoring) live in one place each. Do not copy them into other files.
- Behavior specific to one persona in one scenario is written inline on purpose, even if it echoes something elsewhere. Do not deduplicate it.
- Tone: technically rigorous, emotionally safe. Strengths first; critique the transcript, not the person; use "not observed" instead of guessing. Canonical wording is in the spec's Feedback Principles.

## Code

- Application code lives in `source/` (not `src/`, to avoid clashing with the parent folder's `src/`).
- Editor rules in `.claude/rules/` cover style and testing. Follow them rather than restating them here.

## How to run

TBD after stack choice. Until then: read the spec, then work the checklist in `docs/plan.md`.