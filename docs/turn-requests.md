# Turn Requests

How one candidate turn becomes a model call, and how the server's turn markers connect to the rules in `persona.md`. Which turn gets which marker is in the [Turn behavior](flow.md#turn-behavior) table; code is in `source/server/session/request.ts`.

## One turn, start to finish

```mermaid
sequenceDiagram
    participant C as Candidate (browser)
    participant S as Server
    participant F as Prompt files
    participant M as Claude (Bubo)

    Note over S,F: Once at server start (loadSystemPrompt)
    S->>F: read persona.md, scenario, rubric.md
    F-->>S: joined into one system prompt

    Note over C,M: Start: the first call sends only the kickoff note

    Note over C,M: Every turn
    C->>S: "I think the fanout service would..."
    S->>S: store the message as typed in the transcript (no notes)
    S->>S: buildInterviewerRequest: count turns, add turnNote to each candidate message
    S->>M: system prompt + kickoff + transcript with notes
    Note over M: System prompt says what [Wrap-up] means.<br/>Newest message starts with [Turn 10 of 12] [Wrap-up].<br/>Bubo matches the two and follows the rule.
    M-->>S: reply ("Our session is nearly up. Before we close...")
    S->>S: store the reply in the transcript
    S-->>C: show the reply
```

## What Claude receives at turn 10

```text
SYSTEM (cached, same every call)
  persona.md   ...
               - [Wrap-up]: say that our session is nearly up...   <-- the rule
               - [Final turn]: close warmly...
  scenario     ...
  rubric.md    ...

MESSAGES (rebuilt from the transcript every call)
  user       [The candidate pressed Start. Open the interview.]     <-- kickoff
  assistant  Hoo, hello. I'm Bubo...
  user       [Turn 1 of 12]

             Who sends notifications?
  assistant  ...
  ...
  user       [Turn 10 of 12] [Wrap-up]                               <-- the marker

             I think the fanout service would...
```

## Rules this relies on

- No code links a marker to its rule. The marker string in `request.ts` and the bullet in `persona.md` must match exactly.
- The transcript stores messages as typed. Notes and markers are added each time a request is built.
- Markers depend only on the turn number and the session's `wrapUpTurn` and `finalTurn` (turns 10 and 12 unless the token check moves one to the newest turn). A turn already sent never changes: at turn 11, turn 10 still carries `[Wrap-up]`, so the cached prefix is unchanged.
- The persona's "Markers" rule tells Bubo to act only on a marker in the newest message, so she doesn't warn twice.
