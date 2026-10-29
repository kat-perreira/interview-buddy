# System Design Interview Practice: v1 Spec

## Audience and Problem
Software engineers pursuing mid- to senior-level roles who need interactive practice talking through system design interviews, not just reading about them.

## Design Principles
- **Technically rigorous, emotionally safe.** The interview is realistic; the tone is warm. Feedback is specific, evidence-based, and never shaming. Details live in persona.md and [Feedback Principles](#feedback-principles-trauma-informed) below.
- **Low-compute by default.** Smallest model that meets the quality bar, capped turns and tokens, prompt caching. Compute is a cost to justify, not a default.
- **Candidate stays in control.** They can end the session at any time and are warned before it ends.
- **Cozy, not cluttered.** v1 has one owl interviewer, expressed through language only (no visuals or voice). Playful touches lower the stress of a hard interview format, but never obscure the core practice loop.

## v1 Scope
- Practice a system design interview with one AI interviewer persona (an owl; see [persona.md](../prompts/personas/persona.md)).
- One problem scenario: **design a notification service** (push, email, and SMS delivery). It has natural room for scaling and tradeoff follow-ups: fan-out, prioritization, retries and delivery guarantees, user preferences, rate limiting, and failure handling. Two more scenarios are planned for v2.
- Single user (the builder). No accounts or login.
- Text only.
- At the end of a session, the user receives feedback: strengths, key areas for improvement, and suggested practice steps, based on the rubric in [rubric.md](../prompts/rubric.md).

## Non-Goals (out of scope for v1)
- Multiple interviewer personas
- Additional scenarios (v2)
- Avatar, voice, or other multimodal features (including owl visuals; in the interview the owl is expressed through language only. The one exception is a small static ASCII owl on the landing page and above the feedback.)
- Diagramming or whiteboard input
- User accounts, login, and saved history across sessions
- Persisting transcripts (session lives in memory only; a refresh ends it)

## Rubric Dimensions
Requirements and scoping, high-level design, data and APIs, scaling/reliability/bottlenecks, tradeoffs and decisions, communication and structure. Rated 1-4 (3 is the bar), or “not observed.” Details in rubric.md.

## Interviewer Behavior
Full details live in persona.md. The spec requires that the interviewer:
- Is Bubo (she/her): a wise, warm, sharp owl with dry wit and high standards. Character notes in [owl-character.md](owl-character.md); they are not part of the prompt.
- Is warm and professional, with owl flavor in word choice: occasional hoots and owl puns are welcome, as seasoning rather than every line. Cozy touches never replace technical substance.
- Asks follow-ups that reference what the candidate said earlier.
- Probes rubric dimensions that haven't come up yet.
- Pushes back on weak reasoning by asking questions, not by judging the candidate.
- Hints: only if the candidate asks or is clearly stuck; a nudge, never the answer (`prompts/personas/persona.md`).
- Corrections: clarifying questions mid-interview if an error would derail the rest of the design; otherwise save corrections for feedback.

## Session Rules
State diagram: [flow.md](flow.md).

- **Start:** a single Start button launches the interview for the one scenario.
- **End:** the user clicks "End Interview" (and confirms), the session reaches the turn cap, a pause runs past the pause limit, or (as a backstop) the token check fails. Either way, feedback is generated.
- **Pause:** available whenever the interviewer isn't mid-reply. The server records the pause. While paused, the transcript is hidden, input is disabled, and the check-in timer stops; the screen offers Resume and End Interview. On pausing, the candidate is told the interview ends after 30 minutes paused and feedback will be ready when they're back. At 25 minutes a notice says it ends in 5 minutes. At 30 minutes it ends and feedback is generated. Pausing doesn't use turns or tokens. On resume, the check-in timer restarts.
- **Turn count:** the server tells the interviewer the turn number ("Turn N of 12") on every call. The candidate never sees it in the UI; dev builds log it to the browser console.
- **Warning:** the interviewer delivers it in her reply to turn 10, working it in naturally and steering toward a big-picture wrap-up. If the token check shows the next turn is the last that fits, she gets the final-turn instruction instead. The server flags these turns in the call so the warning is not left to chance; whether the wording feels natural is a manual-review item.
- **Turn cap:** the interviewer replies to the candidate's 12th turn and closes the interview warmly. The input locks and feedback starts automatically.
- **Pause check-in:** if no message is sent for 5 minutes after the interviewer's reply, a small banner above the input offers a hint ("Stuck? You can ask Bubo for a hint anytime."). At 10 minutes, a second banner offers to move on ("Want to try a different part of the design? Just tell Bubo."). Then no more until the next message. Typing does not hold off the timer. Banners are fixed UI text: not a turn, no model call, not in the transcript. They never take focus, so voice dictation isn't interrupted.
- **After feedback:** the full feedback shows on the same page, followed by a thank-you and a "Practice Again" button.
- **Leaving:** while the session screen is up (from a successful Start until "Practice Again," or "Start a New Interview" after failed feedback retries), refreshing or closing the tab triggers the browser's own leave-page confirmation. Once the session has expired there's nothing to lose, so there's no warning. A refresh ends the session.

## Limits (starting values, tune after real sessions)
| Limit | Value |
| --- | --- |
| Max candidate turns | 12 |
| Max candidate message length | ~2,000 characters (~500 tokens) |
| `max_tokens` per interviewer reply | 400 |
| `max_tokens` for feedback call | 1,500 |
| Hard session cap | 130k total tokens (input + output, thinking included), tracked from API usage |
| Feedback reserve | 16k tokens. Before each interviewer call: tokens used + estimated cost of the call + reserve must be ≤ the cap, or the interview ends and feedback runs |
| Pause check-ins | Banners at 5 and 10 minutes without a sent message, then none until the next message |
| Pause limit | 30 minutes, with a notice at 25; then the interview ends and feedback runs |
| Idle session expiry | 30 minutes after last activity (35 while paused, so the pause limit is reached first); the server drops the session |

Notes:
- With 12 capped turns, the turn limit will likely bind well before the token cap. The token cap is a backstop, not the expected limit.
- Backstops: set a monthly spend limit in the model provider dashboard; use prompt caching for the system prompt and rubric if available.

## Failure Handling
- If an interviewer reply fails (API error, timeout, refusal, or empty reply), retry once. If it fails again, end the session gracefully and generate feedback from the transcript so far. The unanswered candidate message stays in the transcript and counts as a turn.
- If the opening reply fails twice, discard the session and show a calm "please try again" with Start still available. There is nothing to grade, so no feedback runs.
- If the feedback call fails, show a clear message and let the user retry the feedback call only, without restarting the interview.
- After 3 failed retries, also suggest starting a new interview, and keep the retry available. Say that a new interview ends this one without feedback; don't promise the feedback will come back.
- Failure messages follow the same tone principles: calm, plain, and not blaming the user.

## Feedback Principles (trauma-informed)
- Strengths come first.
- Critique is tied to specific evidence from the transcript and describes what was said, never the candidate as a person.
- Use "not observed" instead of guessing when a dimension didn't come up.
- Suggested practice steps are concrete and small enough to act on.
- The candidate controls pacing; End Interview is always available.

## Success Criteria (v1 acceptance)
1. **Start:** From the landing page, one click on Start begins the interview. The first message is friendly and professional, restates the notification service problem, and asks the candidate to begin.
2. **Follow-ups:** In a ~10-turn test session, the interviewer asks follow-ups that reference something the candidate said earlier, and probes rubric dimensions that haven't come up yet.
3. **Feedback:** When the interview ends, feedback includes every rubric dimension (rating plus one specific piece of evidence from the transcript, or "not observed"), top strengths, top areas to improve, and three suggested practice steps.
4. **Limits:** The session never exceeds the token cap, and feedback is always produced.
5. **Tone:** In manual review of a few sessions, the interviewer stays warm without losing technical rigor; owl touches (hoots, puns) stay occasional, never crowd out the question, and are left out when the candidate is stuck or frustrated; and the feedback contains no shaming or character-level language.

## Feedback Output Format
1. Overall summary (2-3 sentences)
2. Rubric table: dimension, rating, one line of evidence
3. Top 2-3 strengths
4. Top 2-3 areas to improve
5. 3 suggested practice steps

## Open Questions
- How will interviewer quality be evaluated (manual review of a few sessions)?