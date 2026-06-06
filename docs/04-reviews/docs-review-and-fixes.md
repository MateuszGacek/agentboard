# Documentation Review and Fixes

## Self-review summary

The initial documentation had a strong product idea and good technology direction, but it was not yet strict enough for reliable implementation by an AI coding agent.

The main weakness was ambiguity at integration boundaries:

- UI expected flows that API did not fully define.
- Dashboard depended on status semantics that could break if columns were renamed.
- Database lacked indexes and ownership validation detail.
- Auth/session behavior was under-specified.
- Deployment startup behavior was not idempotent enough.
- README read like a docs package instead of a public product repo.

This v2 documentation rebuild fixes those issues.

## What was already good

### Product positioning

The niche is clear:

```txt
AI Kanban for software teams shipping with agents
```

This differentiates the product from a generic Trello clone.

### Feature selection

The selected features make business sense:

- WIP limits support focus,
- dashboard supports delivery visibility,
- AI Improve supports task clarity,
- multilingual UI supports professional polish,
- mobile UX matches real review behavior.

### Stack direction

The stack is coherent for the goal:

- Vite SPA for speed,
- Hono for lightweight backend,
- PostgreSQL/Drizzle for real persistence,
- TanStack Query/Router for typed frontend flow,
- shadcn/Tailwind for polished UI.

### UX surfaces

Task detail sheet and AI comparison are strong centerpiece experiences.

## What was weak or risky

### 1. Missing implementation handoff

Problem:

- `docs/05-agent-prompts/codex-start-prompt.md` was referenced but not guaranteed to
  exist.

Fix:

- Added `docs/05-agent-prompts/codex-start-prompt.md` with exact phase-by-phase
  implementation instructions.

### 2. README not public-ready

Problem:

- README looked like internal documentation packaging.

Fix:

- Rebuilt README as a recruiter-facing project README.

### 3. Completion depended on column name

Problem:

- “Done” could be renamed or translated.

Fix:

- Added `columns.system_key` and `columns.behavior`.
- Metrics depend on stable semantics, not display text.

### 4. API was too prose-based

Problem:

- Frontend/backend agents could invent incompatible shapes.

Fix:

- Added concrete TypeScript contracts for auth, board, task detail, dashboard, and AI.

### 5. Database indexes missing

Problem:

- Board loading, dashboard, and filtering would be under-specified.

Fix:

- Added indexes for sessions, membership, projects, boards, columns, tasks, labels, comments, activity, AI suggestions.

### 6. Workspace security under-specified

Problem:

- Cross-workspace mutation bugs would be likely.

Fix:

- Added explicit ownership validation rules per API mutation.

### 7. Auth/session unclear

Problem:

- Session cookie, TTL, password rules, and demo user behavior were vague.

Fix:

- Defined cookie attributes, session table, token hashing, password rules, demo isolation.

### 8. Drag/drop endpoint ambiguous

Problem:

- Same-column reorder and cross-column move behavior were not strict.

Fix:

- Added transaction rules, board version behavior, fresh board snapshot response.

### 9. Deployment startup risky

Problem:

- Migrations/seeding could duplicate or fail unpredictably.

Fix:

- Added idempotent startup sequence and seed rules.

### 10. Scope near upper edge

Problem:

- Too many v1 features could cause unfinished product.

Fix:

- Added phase order and v1.1 postponement list.

## Audit feedback addressed

| Audit issue                         |       Status | Files updated                                                                                                                         |
| ----------------------------------- | -----------: | ------------------------------------------------------------------------------------------------------------------------------------- |
| Missing start prompt                |        Fixed | `docs/05-agent-prompts/codex-start-prompt.md`, `AGENTS.md`                                                                            |
| README not recruiter-ready          |        Fixed | `README.md`, `docs/04-reviews/recruiter-readiness.md`                                                                                 |
| Task status depends on column names |        Fixed | `docs/00-overview/product-scope.md`, `docs/01-architecture/database.md`, `docs/01-architecture/api-contracts.md`                      |
| API response shapes vague           |        Fixed | `docs/01-architecture/api-contracts.md`                                                                                               |
| DB indexes missing                  |        Fixed | `docs/01-architecture/database.md`                                                                                                    |
| Workspace boundary under-specified  |        Fixed | `docs/01-architecture/architecture.md`, `docs/01-architecture/database.md`, `docs/01-architecture/api-contracts.md`                   |
| Auth/session incomplete             |        Fixed | `docs/01-architecture/architecture.md`, `docs/01-architecture/database.md`, `docs/01-architecture/api-contracts.md`                   |
| Drag/drop endpoint insufficient     |        Fixed | `docs/01-architecture/database.md`, `docs/01-architecture/api-contracts.md`                                                           |
| Deployment startup behavior vague   |        Fixed | `docs/03-deployment/coolify-deployment.md`, `docs/02-implementation/implementation-plan.md`                                           |
| Scope too broad                     | Reduced risk | `docs/00-overview/product-scope.md`, `docs/02-implementation/implementation-plan.md`, `docs/02-implementation/acceptance-criteria.md` |

## Remaining intentional trade-offs

### Custom auth instead of external auth package

This is intentional for MVP. It makes session behavior explicit and easier to review.

### Column CRUD moved to v1.1

Core Kanban is still complete with default workflow columns and WIP editing. Full column CRUD/reorder can be added after task movement is stable.

### Demo data in English

UI is translated. Seed task content can remain English because the product targets software agencies and this reduces translation/seed complexity.

### No realtime collaboration

Realtime is not needed for recruitment MVP and would increase complexity.

## Historical Notes

The root `CHANGELOG_DOCS_REVIEW.md` content was consolidated here during the
documentation cleanup. It recorded the v2 documentation rebuild: adding the Codex start
prompt and status file, expanding agent rules, clarifying MVP scope, defining stable
Kanban status semantics, expanding API/database/deployment docs, and adding recruiter
readiness guidance.

## Final documentation readiness verdict

Status:

```txt
Almost ready to implement → v2 fixes high-priority gaps → ready for Codex vertical-slice implementation.
```

Next step:

```txt
Use docs/05-agent-prompts/codex-start-prompt.md and implement Phase 0 through Phase 4 first.
```
