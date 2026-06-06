# CHANGELOG_DOCS_REVIEW.md

## v2 documentation rebuild

This version rebuilds the AgentBoard documentation to address the audit findings and make the repository ready for Codex implementation and public GitHub review.

## Key changes

### Added missing implementation handoff

- Added `CODEX_START_PROMPT.md`.
- Added `STATUS.md`.
- Expanded `AGENTS.md` with strict implementation rules.

### Improved product scope

- Clarified MVP vs v1.1 scope.
- Kept the product ambitious but prioritized board vertical slice first.
- Moved risky nonessential features to later phases.

### Fixed Kanban status semantics

- Added stable `columns.system_key` and `columns.behavior`.
- Defined how `completed_at`, `started_at`, and blocked states are set.
- Removed dependency on translated/renamed column titles for metrics.

### Expanded API contracts

- Added concrete TypeScript response types.
- Added board snapshot contract.
- Added task detail contract.
- Added dashboard metrics contract.
- Added AI suggestion contract.
- Added consistent success/error envelopes.

### Expanded database documentation

- Added indexes.
- Added ownership validation rules.
- Added transaction rules for task movement.
- Added idempotent seed rules.
- Added session and demo account behavior.

### Improved deployment readiness

- Added idempotent Docker entrypoint behavior.
- Added healthcheck expectations.
- Added Coolify-specific notes.
- Clarified one-domain SPA/API serving model.

### Improved GitHub readiness

- Replaced documentation-pack README with recruiter-ready project README.
- Added `.env.example`, `.gitignore`, and MIT `LICENSE`.
- Added `docs/13_GITHUB_READINESS.md`.

## Important architecture decision changed

The MVP now uses a custom minimal email/password session model instead of depending on an external auth abstraction. This reduces integration ambiguity for Codex and makes auth/session behavior explicit for reviewers.

Better Auth can be reconsidered in v1.1 if desired, but it is not required for this recruitment MVP.
