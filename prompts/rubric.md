# Grading Rubric (v1)

Used by the interviewer to decide what to probe, and by the feedback step to score the session.

## Level Calibration
System design interviews are calibrated to expected scope, independence, judgment, and influence.
- **Mid-level:** proves they can design a bounded system coherently.
- **Senior:** drives a production service through scale and failure.
- **Staff:** also chooses the right boundary, accounts for organizational constraints, and shows how the design can be adopted and evolved. (Not scored in v1; v1 targets mid and senior.)

## Scale
1 = Needs work, 2 = Developing, 3 = Solid, 4 = Strong.
For mid-to-senior roles, 3 is the bar to pass and 4 is a standout.

## Dimensions
| Dimension | Strong (4) | Weak (1-2) |
| --- | --- | --- |
| 1. Requirements and scoping | Asks clarifying questions up front, separates functional from non-functional requirements, states assumptions and rough scale | Jumps straight to boxes and arrows, never asks about scale or constraints |
| 2. High-level design | Clear components, sensible data flow, explains how a request moves through the system | Vague or missing components, unclear responsibilities, no end-to-end flow |
| 3. Data and APIs | Reasonable data model and storage choices with reasons, defines key APIs or interfaces | Default storage choice with no reasoning, no interface thinking |
| 4. Scaling, reliability, bottlenecks | Identifies likely bottlenecks, discusses caching, partitioning, queues, failure modes, consistency where relevant | "Add more servers," misses single points of failure, doesn't quantify |
| 5. Tradeoffs and decisions | Names alternatives, explains the choice, acknowledges what is given up | Presents choices as the only option, defensive or stuck when challenged |
| 6. Communication and structure | Organized, checks in, responds well to hints and pushback, manages time | Rambling, disorganized, ignores follow-ups |

## Rules for the AI
- **Evidence required.** Every rating cites something specific the candidate said. No evidence, no score.
- **"Not observed" is allowed.** If an area was never probed, say so rather than marking the candidate down.
- **Interviewer probes the rubric.** Follow-ups target dimensions that haven't come up yet.
- **Calibrate to level.** Judge against mid or senior expectations, not an idealized answer.