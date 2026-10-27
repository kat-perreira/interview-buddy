# System Design Interview Practice: v1 Spec

## Audience and Problem
Software engineers pursuing mid- to senior-level roles who need interactive practice talking through system design interviews, not just reading about them.

## Design Principles
- **Technically rigorous, emotionally safe.** The interview is realistic; the tone is warm. Feedback is specific, evidence-based, and never shaming. Details live in persona.md and the feedback guidelines.
- **Low-compute by default.** Smallest model that meets the quality bar, capped turns and tokens, prompt caching. Compute is a cost to justify, not a default.
- **Candidate stays in control.** They can end the session at any time and are warned before it ends.
- **Cozy, not cluttered.** v1 has one owl interviewer, expressed through language only. Cozy details never obscure the core practice loop.

## v1 Scope
- Practice a system design interview with one AI interviewer persona (an owl; see [persona.md](../prompts/personas/persona.md)).
- One problem scenario: **design a notification service** (push, email, and SMS delivery). It has natural room for scaling and tradeoff follow-ups: fan-out, prioritization, retries and delivery guarantees, user preferences, rate limiting, and failure handling. Two more scenarios are planned for v2.
- Single user (the builder). No accounts or login.
- Text only.
- At the end of a session, the user receives feedback: strengths, key areas for improvement, and suggested practice steps, based on the rubric in [rubric.md](../prompts/rubric.md).

## Non-Goals (out of scope for v1)
- Multiple interviewer personas
- Additional scenarios (v2)
- Avatar, voice, or other multimodal features (including owl visuals; the owl is expressed through language only)
- Diagramming or whiteboard input
- User accounts, login, and saved history across sessions
- Persisting transcripts (session lives in memory only; a refresh ends it)

## Rubric Dimensions
TODO: list the dimensions from rubric.md here in one line, so this spec is readable without opening that file.

## Interviewer Behavior
Full details live in persona.md. The spec requires that the interviewer:
- Is warm and professional, with a light owl flavor in word choice. Cozy touches never replace technical substance.
- Asks follow-ups that reference what the candidate said earlier.
- Probes rubric dimensions that haven't come up yet.
- Pushes back on weak reasoning by asking questions, not by judging the candidate.
- Hints: only if the candidate asks or is clearly stuck; a nudge, never the answer (`prompts/personas/persona.md`).
- Corrections: clarifying questions mid-interview if an error would derail the rest of the design; otherwise save corrections for feedback.

## Session Rules
- **Start:** a single Start button launches the interview for the one scenario.
- **End:** the user clicks "End interview," or the session reaches the turn cap. Either way, feedback is generated.
- **Warning:** the user is warned at turn 10 that the interview will end soon.
- **Turn cap:** the interviewer replies to the candidate's 12th turn, then the session closes and feedback is generated.

## Limits (starting values, tune after real sessions)
| Limit | Value |
| --- | --- |
| Max candidate turns | 12 |
| Max candidate message length | ~2,000 characters (~500 tokens) |
| `max_tokens` per interviewer reply | 400 |
| `max_tokens` for feedback call | 1,500 |
| Hard session cap | ~100k total tokens (input + output), tracked from API usage |
| Feedback reserve | Interview ends early enough that the feedback call always fits |

Notes:
- With 12 capped turns, the turn limit will likely bind well before the token cap. The token cap is a backstop, not the expected limit.
- Backstops: set a monthly spend limit in the model provider dashboard; use prompt caching for the system prompt and rubric if available.

## Failure Handling
- If an interviewer reply fails (API error or timeout), retry once. If it fails again, end the session gracefully and generate feedback from the transcript so far.
- If the feedback call fails, show a clear message and let the user retry the feedback call only, without restarting the interview.
- Failure messages follow the same tone principles: calm, plain, and not blaming the user.

## Feedback Principles (trauma-informed)
- Strengths come first.
- Critique is tied to specific evidence from the transcript and describes what was said, never the candidate as a person.
- Use "not observed" instead of guessing when a dimension didn't come up.
- Suggested practice steps are concrete and small enough to act on.
- The candidate controls pacing; End interview is always available.

## Success Criteria (v1 acceptance)
1. **Start:** From the landing page, one click on Start begins the interview. The first message is friendly and professional, restates the notification service problem, and asks the candidate to begin.
2. **Follow-ups:** In a ~10-turn test session, the interviewer asks follow-ups that reference something the candidate said earlier, and probes rubric dimensions that haven't come up yet.
3. **Feedback:** When the interview ends, feedback includes every rubric dimension (rating plus one specific piece of evidence from the transcript, or "not observed"), top strengths, top areas to improve, and three suggested practice steps.
4. **Limits:** The session never exceeds the token cap, and feedback is always produced.
5. **Tone:** In manual review of a few sessions, the interviewer stays warm without losing technical rigor, and the feedback contains no shaming or character-level language.

## Feedback Output Format
1. Overall summary (2-3 sentences)
2. Rubric table: dimension, rating, one line of evidence
3. Top 2-3 strengths
4. Top 2-3 areas to improve
5. 3 suggested practice steps

## Open Questions
- Which model and hosting? (Constraint: smallest model that meets the quality bar.)
- How will interviewer quality be evaluated (manual review of a few sessions)?
- Stack choice?
- Hints and correction policy: settled in `prompts/personas/persona.md`.