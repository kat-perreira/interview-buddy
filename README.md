# Interview Buddy

Text-based practice for system design interviews, with an AI interviewer who asks real follow-ups and gives honest, kind feedback.

Reading about system design only gets you so far. The interview itself is a conversation: you scope the problem, sketch a design, defend tradeoffs, and adjust when someone pushes back. InterviewBuddy gives you a place to rehearse that conversation without the stakes.

> **Status:** in progress. The spec, prompts, model client, and session store are done. The session loop, feedback, and UI are next. See [docs/plan.md](docs/plan.md).

## Meet Bubo

Your interviewer is Bubo, a wise, warm, sharp owl with dry wit and high standards. She:

- restates the problem and lets you drive
- asks follow-ups that build on what you said earlier
- probes the areas you haven't covered yet
- pushes back with questions, not judgments
- gives a nudge if you ask for a hint or get stuck, never the answer

The occasional hoot or owl pun is allowed. It's seasoning, and she drops it when you're stuck or frustrated.

## How a session works

1. Click **Start**. Bubo introduces the problem: design a notification service (push, email, and SMS).
2. Talk through your design for up to 12 turns. Around turn 10, Bubo lets you know the session is nearly up and steers toward a wrap-up.
3. End the interview whenever you like, or reach the turn cap. You can also pause; the transcript hides until you resume.
4. Get feedback on the same page: a summary, a rubric table, your strengths, areas to improve, and three concrete practice steps.

Nothing is saved. A session lives in server memory, and a refresh ends it.

The full session rules, including pause limits and check-in banners, are in [docs/spec.md](docs/spec.md) and [docs/flow.md](docs/flow.md).

## Feedback

Feedback is scored against six dimensions, each rated 1 to 4 (3 is the bar) or "not observed":

- Requirements and scoping
- High-level design
- Data and APIs
- Scaling, reliability, and bottlenecks
- Tradeoffs and decisions
- Communication and structure

The tone is technically rigorous and emotionally safe. Strengths come first. Every critique points to something specific in the transcript and describes what was said, never the person. If a dimension didn't come up, it's marked "not observed" rather than guessed at.

## Design choices

- **Low compute by default.** Claude Haiku 5.5, capped turns and tokens, and prompt caching for the system prompt and rubric. A full session costs about a cent.
- **The server holds the key.** A small Hono server calls the model and streams replies to the browser. It also enforces the turn cap, message length, and token budget, so the browser can't skip a check.
- **Feedback is guaranteed.** A token reserve is held back for feedback. If a reply fails, the server retries once, then ends gracefully and generates feedback from the transcript so far.
- **Deliberately small v1.** One interviewer, one scenario, text only, no accounts.

The reasoning behind each choice is logged in [docs/decisions.md](docs/decisions.md).

## Tech stack

- TypeScript throughout
- Vite + React frontend
- Hono server on Node
- Anthropic Claude API via `@anthropic-ai/sdk`
- Vitest, with a mock model client so tests never call the real API

## Running locally

Requires Node 22+. From `source/`:

```sh
npm install
cp .env.example .env   # then add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the server on port 8787.

To click through without an API key, set `MODEL_CLIENT=mock` in `.env`. In mock mode, a message containing `[mock:fail]` or `[mock:refuse]` triggers the failure paths.

| Command | What it does |
| --- | --- |
| `npm run dev` | Server and client with hot reload |
| `npm test` | Run tests once |
| `npm run test:watch` | Rerun tests on change |
| `npm run typecheck` | Type-check with `tsc` |
| `npm run build && npm start` | Serve the built app and API from one process on port 8787 |

## Project layout

```
docs/       spec, plan, decisions, session flow
prompts/    interviewer persona, scenario, feedback rubric
source/     app code (client/ and server/)
```

## Roadmap

v2 adds two more scenarios. Further out: addressing the candidate by name, and summarizing earlier turns if longer sessions need it. Avatars, voice, and diagramming are out of scope for now.
