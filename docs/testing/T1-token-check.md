# T1: Token check + token_cap

Plan task: T1 Token check before each call with the feedback reserve; end with `token_cap`; final-turn marker on the last turn that fits; tests
Date: 2026-10-30

## What changed

- Before each turn, the server checks the token cap with the 16k feedback reserve. Rules in `docs/decisions.md` (2026-10-30, token check).
- When the cap will end the interview before turn 12, the wrap-up moves to the turn before the last that fits, and the final-turn marker to the last one. After Bubo's close, the interview ends with `token_cap` and feedback runs.
- If no room is left for a turn at all (rare), the interview ends with `token_cap` and the new `length_limit` notice.
- A retry after a billed refusal or empty reply is skipped if it wouldn't fit.
- New mock trigger `[mock:heavy]` brings the token cap within reach in mock mode.

## Cases

Mock mode unless marked **Real API**. "Get there" refers to [dev-tools.md](dev-tools.md).

| ID | Area | Get there | Steps | Expected |
| --- | --- | --- | --- | --- |
| 1 | Early end | Token cap | Send `[mock:heavy]`, then short messages until the interview ends | One mock reply shows "Wrap-up" (around turn 6), the next shows "Final turn"; input locks, "Good job, that's the end of the interview" notice, feedback appears |
| 2 | Wrap-up once | Token cap | Same as 1 | No mock reply after the early wrap-up shows "Wrap-up" again, and turn 10 isn't reached |
| 3 | Under the cap | Token cap | Same as 1, then read the `[usage]` lines | Session tokens summed across all lines, feedback included, stay at or under 130,000 |
| 4 | Normal session | Turn cap | 12 turns without `[mock:heavy]` | Unchanged: wrap-up on turn 10, final turn on 12, ends with `turn_cap` |
| 5 | Feedback note | Token cap | Same as 1 | Feedback appears normally (mock feedback doesn't mention the reason; the real feedback prompt gets "reached its length limit") |
| 6 | Tone | **Real API** (~1 cent, but the cap won't bind in a normal session) | Not practical without a large transcript | Skip for now; early markers use the same persona wording as turns 10 and 12, covered by T11 |

## Covered by automated tests

- Turn counting: exactly 0, 1, 2, or 3+ turns fit at the right thresholds, reserve boundary included (`budget.test.ts`).
- Markers on the turns the session names; final wins if both coincide; earlier notes don't change (`request.test.ts`).
- Final marker and `token_cap` end; wrap-up moved and given once; no-room end with no model call and the message kept; retry skipped when it wouldn't fit; refusal retry still happens when it fits; a full-length session never passes the cap, feedback included (`app.test.ts`).
- `[mock:heavy]` adds input tokens to every call that holds it (`mock.test.ts`).
- The feedback request says the last message got no reply only when the token cap ended before Bubo could reply (`feedback.test.ts`).

## Notes

<!-- Kat's: results, bugs found, ideas. -->
