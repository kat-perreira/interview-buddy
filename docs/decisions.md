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

## Open (not decided)

- Model and hosting (smallest that meets the quality bar)
- App stack
- How to evaluate interviewer quality beyond a few manual session reviews
