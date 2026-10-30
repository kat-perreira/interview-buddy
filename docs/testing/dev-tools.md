# Dev Tools

Shortcuts to each state of the app. Commands run from `source/` unless noted.

## Modes

| Mode | How | Cost |
| --- | --- | --- |
| Mock | `MODEL_CLIENT=mock` in `.env`, then `npm run dev` | Free. Canned replies, fake ratings. |
| Real API | `MODEL_CLIENT` blank in `.env`, `ANTHROPIC_API_KEY` set | About a cent per full session on Haiku 5.5. |
| One-off mock, real `.env` untouched | `MODEL_CLIENT=mock npm run dev` (shell variables win over `.env`) | Free |

## Mock triggers

Type these anywhere in a candidate message (mock mode only).

| Type | What happens |
| --- | --- |
| `[mock:fail]` | Bubo fails twice: the interview ends with `interviewer_failed`, then feedback runs (and succeeds). |
| `[mock:refuse]` | Bubo refuses twice: same path as `[mock:fail]`. |
| `[mock:feedback-fail]` | The interview continues normally; every feedback call for this session fails. |
| `[mock:feedback-fail-once]` | The first feedback call fails; Retry Feedback succeeds. |
| `[mock:heavy]` | Its own call and every later one, feedback included, reports 12,000 more input tokens, as if a long document stayed in the conversation. Brings the token cap within about 7 turns. |

## Dev helpers

| Helper | How | Notes |
| --- | --- | --- |
| Session runner | `npm run dev` running, then `npm run dev:session` | Plays 12 canned answers plus feedback. Prints session ID, time per reply, ratings. Works in both modes. |
| Fill Next Answer | Button next to End Interview (dev builds only) | Fills the canned answer for this turn, focus back in the text box. Overwrites what you've typed. |
| Canned answers | `source/dev/candidate-script.ts` | Medium quality. Can't react to Bubo's follow-ups. |

## Getting to a state fast

| State | Recipe |
| --- | --- |
| Turn-10 warning | Fill Next Answer + Cmd/Ctrl+Enter, 10 times. Mock reply shows "turn 10 of 12, Wrap-up". |
| Turn cap and auto feedback | Same, 12 times. Or `npm run dev:session` for the API side. |
| Token cap (early wrap-up and final turn) | Send `[mock:heavy]` on turn 1, then any messages. Mock replies show "Wrap-up" around turn 6 and "Final turn" on the next, then feedback starts. |
| Interviewer failure | Send `[mock:fail]` on any turn. |
| Feedback retry that recovers | Send `[mock:feedback-fail-once]`, then End Interview, then Retry Feedback. |
| Feedback that keeps failing (Start a New Interview offer) | Send `[mock:feedback-fail]`, End Interview, then Retry Feedback 3 times. |
| Thank-you and Practice Again | Any finished session with feedback. |
| Expired session (`not_found`) | Mid-session, restart the server: `touch ../prompts/rubric.md` (dev restarts on prompt edits and memory is cleared). Then send or click End Interview. |
| Message too long | `node -e "console.log('a'.repeat(2001))" \| pbcopy`, paste into the text box. |
| Leave-page warning | Refresh or close the tab any time between Start and feedback. |
| End Interview mid-reply | No shortcut yet: mock replies take well under a second. Use the curl recipe below or Real API. |

## curl recipes

Talk to the server directly (port 8787), skipping the UI. Useful for races and server rules the UI blocks.

```sh
# Start a session; copy sessionId from the response
curl -s -X POST localhost:8787/api/sessions

# Send a turn
curl -s -X POST localhost:8787/api/sessions/$ID/turns -H 'Content-Type: application/json' -d '{"message":"Hello"}'

# End Interview
curl -s -X POST localhost:8787/api/sessions/$ID/end

# Ask for feedback (run twice: the second returns the same feedback, no model call)
curl -s -X POST localhost:8787/api/sessions/$ID/feedback

# Busy: two sends at once; one should get 409 busy
curl -s -X POST localhost:8787/api/sessions/$ID/turns -H 'Content-Type: application/json' -d '{"message":"one"}' &
curl -s -X POST localhost:8787/api/sessions/$ID/turns -H 'Content-Type: application/json' -d '{"message":"two"}'
```

## Logs to watch (server console)

| Prefix | When |
| --- | --- |
| `[usage]` | Every call that returns usage: tokens, estimated cost for the call and the session. |
| `[mock]` | Every mock call and its outcome. |
| `[interviewer]` | A failed interviewer attempt, or a reply cut off at `max_tokens`. |
| `[feedback]` | A failed feedback call. |
