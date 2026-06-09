# AGENTS.md - Kanban Working Rules

Kanban is a recruitment-grade full-stack product: an AI-assisted Kanban platform
for AI software agencies. Build real, deployable vertical slices with TypeScript,
PostgreSQL persistence, secure defaults, responsive UX, and recruiter-ready quality.

## Start Here

Always read `STATUS.md` first. It is the source of truth for the current phase, what
works, known gaps, command results, and the next recommended action.

Use `docs/index.md` as the documentation map.

## Phase Discipline

- Do not skip phases or start broad parallel work.
- Do not start AI or dashboard work before the board vertical slice is working.
- Do not start deployment work unless `STATUS.md` and the relevant docs allow it.
- Prefer one working vertical slice over several unfinished features.

## Required Checks

Run these after meaningful changes:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
```

If markdown formatting fails after documentation edits, run `pnpm format`, then rerun
`pnpm format:check` and the remaining checks as needed.

## Safety Rules

- Do not commit secrets, real API keys, or private infrastructure details.
- Do not use fake frontend-only board/task data as if it were real backend data.
- Keep `OPENAI_API_KEY` backend-only; never expose it in frontend code.
- Do not add a fallback database URL for migrate or seed scripts.
- Every mutation must preserve workspace boundaries.

## Documentation Rules

- Update `STATUS.md` after every phase or meaningful implementation chunk.
- Update relevant docs when product behavior, architecture, API contracts, database
  behavior, deployment behavior, or known limitations change.
