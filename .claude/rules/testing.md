---
paths:
  - "source/**"
  - "prompts/**"
---

# Testing

Judge work against the success criteria and limits in `docs/spec.md`, not against an idealized system-design answer. Read the spec for current values; do not copy numbers into tests from memory.

## Automate (deterministic)
- Turn cap, turn-10 warning, message length limit, token cap with feedback reserve.
- Failure paths: interviewer retry once then graceful end with feedback; feedback retry without restarting the interview.
- Use a mocked model client. Never call the real API in automated tests.

## Review manually (judgment)
- Follow-ups reference earlier candidate statements and probe missing rubric dimensions.
- Interviewer stays warm without losing technical rigor; feedback has no shaming or character-level language.
- After editing a prompt, rerun a few manual sessions before treating the change as done.

## Commands
- TODO: add run and test commands once the stack is chosen (open question in `docs/spec.md`).