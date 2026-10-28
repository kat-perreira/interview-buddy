# Decisions

Short log of why we chose X. Newest last.

## 2026-10-27 — v1 is one owl, one scenario, text only

**Choice:** One interviewer (owl, language only), one problem (design a notification service), text chat, no accounts, transcript in memory only.

**Why:** Lowest surface area that still supports a real practice loop. Extra personas, scenarios, avatars, voice, diagrams, and saved history are v2+ (see spec non-goals). Compute stays a cost to justify.

## 2026-10-27 — session ends by turn cap or user control

**Choice:** Max 12 candidate turns, warn at turn 10, End interview always available, then generate feedback.

**Why:** Candidate stays in control; the turn limit binds before the token backstop in typical sessions; feedback is guaranteed.

## 2026-10-27 — hints and corrections

**Choice:** Hints only if the candidate asks or is clearly stuck, and only as a nudge. Mid-interview, do not lecture; ask a clarifying question if an error would make the rest of the design incoherent. Save corrections for feedback.

**Why:** Practice should stay an interview, not a tutorial, without stranding someone who is stuck. Feedback is the place for teaching.

## 2026-10-27 — editor tooling moves from Cursor to Claude Code

**Choice:** Rules live in `.claude/rules/` (scoped with `paths:` frontmatter); `CLAUDE.md` imports `AGENTS.md`, which stays the single source of project instructions. `.cursor/` removed.

**Why:** Development moved to VS Code with the Claude Code extension; one copy of the rules avoids drift.

## 2026-10-27 — owl may hoot

**Choice:** Occasional hoots and owl puns are allowed in the interviewer's wording. "Language only" means no visuals or voice, not no owl behavior.

**Why:** System design rounds are stressful. A bit of whimsy makes practice feel safer without making it less rigorous. The limit is frequency: seasoning, not every line. Starting value in `persona.md`: at most one owl touch per reply, most replies none. Tune after manual sessions.

## 2026-10-27 — interviewer is Bubo; backstory stays out of the prompt

**Choice:** The owl is Bubo (she/her). Full character notes live in `docs/owl-character.md`; `persona.md` gets only traits that change what she says, plus example lines. Existing characters are not named anywhere in the repo; traits are described in our own words.

**Why:** Every prompt token is sent each turn, and a long backstory dilutes the instructions that matter. Models tend to use whatever is in the prompt. Describing traits in our own words avoids borrowed catchphrases and keeps copyrighted characters out of the project.

## 2026-10-28 — app stack: TypeScript, Vite + React, Hono, server-held sessions

**Choice:** TypeScript throughout. Vite + React frontend. A small Hono server on Node holds the API key, calls the model, and streams interviewer replies to the browser. Sessions live in server memory, keyed by session ID, with a TTL sweep for abandoned sessions. The server enforces the turn cap, message length, and token cap using API usage numbers. Vitest for tests, with the model client behind an interface so tests use a mock. Session logic and its tests come before UI work.

**Why:** The browser never sees the key, and limits are enforced where the browser can't miscount or skip a check. Server-held sessions are the shape later versions (accounts, saved history) will need, so they are set up once now. Hono is small, TypeScript-native, and has built-in streaming helpers. This is more than one page strictly needs. It is a deliberate choice: industry-standard tooling is worth learning on a real project. A refresh still ends the session: the client loses its session ID, and the server drops the entry on the TTL sweep.

## 2026-10-28 — model: Claude Haiku 5.5, step up to Sonnet 5.5 if needed

**Choice:** `claude-haiku-5-5` on the Anthropic Claude API, called from the Hono server through the official `@anthropic-ai/sdk`. The app runs locally for the one v1 user. If manual sessions show weak follow-ups or thin feedback, move to `claude-sonnet-5-5`. The model ID lives in one config value so the switch is a one-line change.

**Why:** Smallest current model, and the spec's quality bar is checked in manual sessions, not assumed. At $0.10 / $0.50 per million input / output tokens, a capped session costs about a cent. Cache reads are 0.1x the input rate.

**Notes for implementation:**
- Thinking is on by default and counts against `max_tokens`. With a 400-token reply cap, thinking could crowd out the reply. Set thinking and effort explicitly and test it.
- Thinking tokens also count toward the session token cap.
- Minimum cacheable prefix is 512 tokens, so the ~2k-token system prompt (persona, scenario, rubric) can be cached.
- Safety refusals arrive as `stop_reason: "refusal"`, with no server-side fallback on Haiku. Treat them like a failed reply (retry once, then end gracefully).
- No assistant prefill, and don't send `temperature`, `top_p`, or `top_k`; both return a 400.
- Caches are per model, so switching to Sonnet starts with a cold cache.

## Open (not decided)

- How to evaluate interviewer quality beyond a few manual session reviews
