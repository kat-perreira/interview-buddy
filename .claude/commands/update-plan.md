---
description: Propose checkbox updates to docs/plan.md based on recent work
---

Sweep `docs/plan.md` against recent work. Keep it cheap: read only what you need.

1. Read `docs/plan.md` and the "Success Criteria" section of `docs/spec.md`.
2. Run `git log --oneline -15` and `git status`. Open diffs or files only for commits that look relevant to an unchecked item.
3. For each unchecked item, decide: done, partly done, or not started. An item counts as done only if it meets its matching success criterion, where one applies.
4. Do not propose checking **Acceptance** or manual-review items; they need real sessions. List them as "needs you".
5. Show a short table (item, verdict, evidence: commit or file). Then show the exact diff to `docs/plan.md` you propose.
6. Wait for approval before editing. Do not commit.
