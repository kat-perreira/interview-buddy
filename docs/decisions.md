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

## Open (not decided)

- Model and hosting (smallest that meets the quality bar)
- App stack
- How to evaluate interviewer quality beyond a few manual session reviews
