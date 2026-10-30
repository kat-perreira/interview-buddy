# T15: One reply helper for opening and turns

Plan task: T15 Combine the opening and turn routes' reply handling into one helper, no behavior change
Date: 2026-10-30

## What changed

- Nothing a candidate can see. The opening and turn routes now get Bubo's reply through one helper (`getReply` in `source/server/app.ts`), so streaming (T16) has one place to change.
- The opening call now runs inside `withBusy` like turns do. No visible effect: nothing can reach the session before its ID is returned.

## Cases

Mock mode unless marked **Real API**. "Get there" refers to [dev-tools.md](dev-tools.md).

| ID | Area | Get there | Steps | Expected |
| --- | --- | --- | --- | --- |
| 1 | Opening | Landing page | Press Start | Bubo's opening appears, as before |
| 2 | Turn | Any session | Send a message | Bubo replies; mock reply shows the next call number and turn |
| 3 | Failed reply | Interviewer failure | Follow the recipe | Interview ends with the interviewer-failed message; feedback follows |
| 4 | End mid-reply (**Real API**) | End Interview mid-reply | Send a message, press End Interview before the reply, confirm | Reply is dropped; feedback follows |
| 5 | Turn cap | Turn cap and auto feedback | Follow the recipe | Ends after Bubo's reply to turn 12; feedback follows |
| 6 | Token cap | Token cap | Follow the recipe | "Wrap-up" around turn 6, "Final turn" on the next, then feedback |

## Covered by automated tests

- Case 4 is also covered by the route test "drops Bubo's reply when the candidate ends mid-reply", so the Real API run is optional.
- All existing route tests pass unchanged: opening success, retry, and double failure; turn reply, retry, and `interviewer_failed`; reply dropped on End Interview; `turn_cap` and `token_cap` endings; marker moves.

## Notes

<!-- Kat's: results, bugs found, ideas. -->
