# AI Interview Roleplay

Text-only system design interview practice. v1: one owl interviewer (language only), one scenario (design a notification service), one local user, no accounts. Full scope in `docs/spec.md`.

## Hard rules (v1)

- Follow `docs/spec.md`. It defines scope, session rules, limits, and failure handling.
- Do not add personas, scenarios, avatars, voice, diagrams, accounts, or saved history.
- Do not persist transcripts. A session lives in memory and a refresh ends it.
- The candidate can always end the session, and is warned before it ends.
- Do not change limits (turn cap, token caps) without updating the spec and `docs/decisions.md`.
- Open questions (how to evaluate interviewer quality) are not yours to settle silently. Ask, then record the answer in `docs/decisions.md`.
- Keep `docs/plan.md` and `docs/decisions.md` current when direction changes. Keep `docs/flow.md` in step with any session flow change. Keep `docs/turn-requests.md` in step with `source/server/session/request.ts` and the marker rules in `persona.md`. Keep `docs/model-calls.md` in step with `source/server/model/`. Keep `docs/testing/dev-tools.md` in step with mock triggers, dev helpers, and shortcuts.
- When you finish a task, add its test notes to `docs/testing/` from `_template.md` (see `docs/testing/README.md`). Leave the Notes section for Kat.
- Every new task in `docs/plan.md` gets the next unused ID (highest `T` number + 1). Never reuse or renumber an ID.
- When you finish a task listed in `docs/plan.md`, check it off in the same change, but only if it meets the matching success criterion in `docs/spec.md` (where one applies). Say which box you checked. Never check off **Acceptance** or manual-review items yourself; they need real sessions, so ask the user.

## Stack

- TypeScript throughout. Vite + React frontend; Hono server on Node.
- The server holds the API key and calls the model. The browser never sees the key. Interviewer replies stream to the browser.
- Sessions live in server memory, keyed by session ID, with a TTL sweep. The server enforces the turn cap, message length, and token cap. Nothing is written to disk.
- Vitest for tests. The model client sits behind an interface; tests use a mock and never call the real API.
- Model: Claude Haiku 5.5 (`claude-haiku-5-5`) on the Anthropic Claude API via `@anthropic-ai/sdk`; step up to Sonnet 5.5 (`claude-sonnet-5-5`) only if manual sessions show it's needed. Keep the model ID in one config value. Implementation notes are in `docs/decisions.md`.
- Keep compute low everywhere: capped turns and tokens, prompt caching for the system prompt and rubric.

## Prompts

- Layout: persona in `prompts/personas/`, scenarios in `prompts/scenarios/`, rubric in `prompts/rubric.md`, feedback instructions in `prompts/feedback.md`.
- `docs/owl-character.md` is design notes for the persona. Never load it into a prompt or copy it into one; distill only behavior-changing traits into `persona.md`.
- Shared rules (tone, safety, output format, feedback and scoring) live in one place each. Do not copy them into other files.
- Behavior specific to one persona in one scenario is written inline on purpose, even if it echoes something elsewhere. Do not deduplicate it.
- Tone: technically rigorous, emotionally safe. Strengths first; critique the transcript, not the person; use "not observed" instead of guessing. Canonical wording is in the spec's Feedback Principles.

## Code

- Application code lives in `source/` (not `src/`, to avoid clashing with the parent folder's `src/`).
- Every message the candidate can see (errors, failures, notices, status lines) lives in `source/shared/strings.ts`, used by both server and client, alphabetized within each section. Add new ones there, not inline. Headings, labels, and button text stay in the components.
- Editor rules in `.claude/rules/` cover style and testing. Follow them rather than restating them here.

## How to run

From `source/`, with Node 22+:

- `npm install`, then copy `.env.example` to `.env` and add `ANTHROPIC_API_KEY`.
- `npm run dev` starts the Hono server (port 8787) and Vite (port 5173). Open http://localhost:5173; Vite proxies `/api` to the server.
- Set `MODEL_CLIENT=mock` in `.env` to click through the app without API calls. In mock mode, a candidate message containing `[mock:fail]` or `[mock:refuse]` triggers the interviewer failure paths, `[mock:feedback-fail]` makes the feedback call fail, and `[mock:feedback-fail-once]` fails it only the first time so Retry Feedback recovers. Each canned mock interviewer reply shows its call number since server start, the turn it got (with any Wrap-up or Final turn marker), and estimated input tokens. Every mock call, feedback and failures included, logs a `[mock]` line with its outcome in the server console.
- Every model call that returns usage logs a `[usage]` line: session ID, which call (opening, turn N, feedback), token counts (input, cache write, cache read, output), stop reason, and estimated cost for the call and the session so far. Cache read should be nonzero from the second interviewer call on; the first feedback call has a different prompt, so it can show 0. In mock mode the counts and costs are fake.
- Failed interviewer calls, and replies cut off at `max_tokens`, log a `[interviewer]` warning in the server console (no message text). Failed feedback calls log a `[feedback]` warning. In dev, editing a prompt file restarts the server, which ends any open session.
- Dev helpers for test runs, using twelve canned medium-quality answers in `dev/candidate-script.ts`: with `npm run dev` running, `npm run dev:session` plays a whole session plus feedback and prints time per reply and the ratings (about 14 real calls outside mock mode). In dev builds, the session screen also has a **Fill Next Answer** button. Canned answers can't follow up on what Bubo asks, so these runs are for cost, speed, and UI checks, not the tone review.
- `npm test` runs Vitest once; `npm run test:watch` reruns on change. `npm run typecheck` runs `tsc`.
- `npm run build && npm start` serves the built client and API from one process on port 8787.