# Usage Logging and Dev Helpers

Plan task: not a plan task (dev tooling)
Date: 2026-10-30

## What changed

- Each model call logs a `[usage]` line in the server console: session ID, which call, token counts, stop reason, estimated cost for the call and the session so far.
- `npm run dev:session` plays a full canned session plus feedback and prints timings and ratings.
- In dev builds, a Fill Next Answer button fills the canned answer for the current turn.

## Cases

Mock mode unless marked **Real API**. "Get there" refers to [dev-tools.md](dev-tools.md).

| ID | Area | Get there | Steps | Expected |
| --- | --- | --- | --- | --- |
| 1 | Usage log | Mock | Start an interview, send 2 turns | 3 `[usage]` lines with the same session ID, labeled opening, turn 1, turn 2; session cost grows each line |
| 2 | Usage log | Mock | Finish a session to feedback | Last `[usage]` line is labeled feedback |
| 3 | Usage log | Mock, Interviewer failure | Send `[mock:fail]` | No `[usage]` line for the failed attempts; `[interviewer]` warnings instead |
| 4 | Usage log | **Real API** (~1 cent) | Run `npm run dev:session` | Opening has cache write > 0; cache read > 0 from turn 1 on; first feedback line may show 0 cache read |
| 5 | Cost check | **Real API** | Note the last `[usage]` session total, then check the Console's usage page after it updates | Totals roughly match. If far off, the cache prices in `config.ts` are wrong |
| 6 | Runner | Mock | `npm run dev:session` | 12 turns, "Interview ended: turn_cap", feedback ok, average and slowest times, 6 ratings |
| 7 | Runner | Server not running | `npm run dev:session` | Error plus "Is the server running (npm run dev)?" |
| 8 | Runner | **Real API** (~1 cent) | `npm run dev:session` | Ratings mostly Solid with some Developing. If not, the canned answers need tuning |
| 9 | Fill button | Mock | Click Fill Next Answer, then Cmd/Ctrl+Enter | Text box holds answer 1 and keeps focus; send works from the keyboard |
| 10 | Fill button | Mock | Repeat until turn 12 | Each click gives the next answer; the button is gone once the interview ends |
| 11 | Fill button | Production build | `npm run build && npm start`, open localhost:8787 | No Fill Next Answer button |
| 12 | Fill button | **Real API** | Click Fill while Bubo is replying (mock replies are too fast to catch) | Button is disabled |

## Covered by automated tests

- Cost math at each token rate; session totals add up; the log line format; no message text in the log.
- An unpriced model fails typecheck.
- Canned script: 12 answers, each under the length limit, no mock triggers.
- Fill Next Answer fills answer 1, then answer 2 after a send, and keeps focus; hidden outside dev builds.

## Notes

<!-- Kat's: results, bugs found, ideas. -->
