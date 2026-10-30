# Testing

Manual test notes and repro recipes, kept next to the code so they stay current. A guide for testing sessions, not a complete test plan: exploratory testing goes beyond it.

## Files

| File | What it holds |
| --- | --- |
| [dev-tools.md](dev-tools.md) | Shortcuts to every state of the app: modes, mock triggers, dev helpers, curl commands, logs to watch. Start here. |
| [_template.md](_template.md) | Template for a task's test notes. |
| `T<n>-<task>.md` | Test notes for one finished plan task (ID from `docs/plan.md`): what changed, how to get there, what to check. |
| `YYYY-MM-DD-<work>.md` | Test notes for work that isn't a plan task, such as dev tooling. |

## Who writes what

- **Claude**, when a task is done: what changed, the cases it knows about with steps and expected results, and what automated tests already cover (no need to hand-test those). Updates `dev-tools.md` when a dev tool, mock trigger, or shortcut changes.
- **Kat**: exploratory testing, results, and bugs found. Claude leaves the Notes section of each file empty.

## Conventions

- Case tables use the same columns in every file (ID, Area, Get there, Steps, Expected), one line per cell, so they paste cleanly into a spreadsheet. Copy from the Markdown preview, not the source, to keep the cells.
- "Get there" names a recipe in `dev-tools.md` instead of repeating it.
- Mock mode unless a case says **Real API**. Real API cases cost money; the file says roughly how much.
