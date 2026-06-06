# Phase Prompts

Historical phase prompts are preserved for context. Use them with `STATUS.md`; do not
restart an earlier phase unless the status file explicitly calls for it.

## Sources

- [Codex start prompt](codex-start-prompt.md)
- [Start plan](../02-implementation/start-plan.md)
- [Implementation plan](../02-implementation/implementation-plan.md)
- [Phase flow](../02-implementation/phase-flow.md)

## Current Use

When asking an agent to continue implementation, include:

```txt
First read:
- AGENTS.md
- STATUS.md
- docs/index.md
```

Then add only the docs for the phase named in `STATUS.md`.
