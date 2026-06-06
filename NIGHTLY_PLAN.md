# AgentBoard Nightly Product Delivery Plan

Date: June 6, 2026

Mode: `NIGHTLY_PRODUCT_DELIVERY`

## 1. Current Confirmed State

- Local runtime smoke is `PASS`; see `LOCAL_RUNTIME_SMOKE.md`.
- Static validation is `PASS` for `pnpm typecheck`, `pnpm lint`, `pnpm build`, and
  `pnpm format:check`.
- Local Docker image build is `PASS`.
- The product exists as a deployable TypeScript/PostgreSQL slice with auth, session
  cookies, demo login, DB-backed board, task detail, dashboard, backend-only AI Improve
  path, i18n, theme support, responsive structure, and Docker/Coolify baseline.
- The live deployment is blocked outside the codebase:
  `https://scalesoftware.matgac.pl/api/health` presents the Traefik default
  certificate, and `curl -k` returns `HTTP 503 no available server`.
- Deployment work remains parked overnight. Product quality work may continue locally.

## 2. What Must Not Be Touched

- Do not deploy to production.
- Do not SSH into the server.
- Do not change live Coolify, Traefik, Cloudflare, OVH, or production DNS settings.
- Do not commit secrets, real API keys, passwords, tokens, or private infrastructure
  details.
- Do not expose `OPENAI_API_KEY` or any OpenAI secret to frontend code or Vite env.
- Do not add fallback database URLs to migrate, seed, startup, or test scripts.
- Do not rewrite the architecture, replace the stack, or split the deployed service
  model.
- Do not begin broad new phases such as realtime, billing, file uploads, or full
  workspace administration.
- Do not use fake frontend-only board/task data as production-like data.
- Do not make mutations that bypass workspace ownership checks.

## 3. Product Areas To Improve Overnight

### DB/API Hardening

- Re-audit task, board, dashboard, AI, and project routes for workspace boundary checks.
- Confirm every mutation uses shared Zod contracts or equivalent request validation.
- Confirm success/error envelopes are consistent and include useful request IDs.
- Tighten transactional behavior where a mutation updates related task, board,
  checklist, comment, activity, or AI suggestion data.
- Review idempotent seed behavior and migration assumptions without adding unsafe
  database fallbacks.

### UX/UI Polish

- Improve visible rough edges only inside existing product surfaces.
- Keep the design aligned with the current SaaS app shell and Tailwind token system.
- Polish loading, empty, error, saving, and disabled states where they already exist.
- Keep copy concise and translated.

### Board/Product Flow

- Improve the existing board flow without changing the core architecture.
- Focus on create/edit/move/archive clarity, persistence confidence, WIP warning
  clarity, and mobile fallback behavior.
- Keep board data DB-backed.

### Task Detail Refinements

- Focus on small, high-value improvements to the existing sheet: field validation,
  save feedback, metadata clarity, checklist/comment edge cases, and activity accuracy.
- Checklist deletion/reordering and comment edit/delete are allowed only if implemented
  narrowly and safely with DB-backed API routes, contracts, i18n, docs, and validation.

### Dashboard Refinements

- Preserve the current DB-backed dashboard architecture.
- Improve metric accuracy, empty states, responsive layout, and risk list clarity.
- Do not replace the dashboard with fake summaries or marketing content.

### AI Unavailable/Working State Polish

- Keep OpenAI calls backend-only.
- Improve the disabled/unavailable/error path first because it is the verified local
  public-demo-safe state.
- If a real AI path is touched, ensure structured output validation, persistence,
  apply/reject behavior, and privacy constraints remain intact.

### Responsive, Accessibility, And i18n

- Recheck 360px, 768px, 1024px, and 1440px after UI changes.
- Keep keyboard focus visible, dialogs/sheets titled, forms labelled, buttons named,
  and non-drag alternatives available.
- Update EN/PL/CS translation files for every visible string change.
- Verify long PL/CS strings do not break mobile layout.

### Automated Smoke/QA

- Prefer focused automated checks that exercise real API contracts or local product
  flows.
- Add lightweight smoke scripts only if they fit existing tooling and do not require
  secrets or production access.
- Continue running the required static validation after each meaningful chunk.

### Deployment Blocker Documentation/Config Readiness

- Keep deployment parked, but improve docs or config readiness when local evidence
  reveals a repository-side issue.
- Document the external Coolify/Traefik blocker clearly.
- Do not execute deploy, live smoke, SSH, or production mutations in nightly mode.

## 4. Risks

- Broad parallel work could destabilize a product slice that already passes local smoke.
- Deployment docs may become misleading if older runtime-pending language is not kept
  aligned with `STATUS.md`.
- New API routes can accidentally miss workspace membership checks.
- UI copy changes can leave missing i18n keys or break mobile layouts in PL/CS.
- AI changes can accidentally leak backend-only configuration or make unavailable
  states worse.
- Seed or migration edits can put local and production database expectations out of
  sync.

## 5. Stop Conditions

Stop broad changes immediately if:

- `pnpm typecheck`, `pnpm lint`, `pnpm build`, or `pnpm format:check` fails and cannot
  be fixed safely in the current prompt.
- A suspected secret, token, private URL, or production credential is found in tracked
  files.
- A requested change requires production deployment, SSH, Coolify edits, DNS edits, or
  live server mutation.
- A database change would require unsafe fallback URLs or cannot be validated with a
  safe local database.
- A mutation cannot be made workspace-safe without a larger architecture rewrite.
- The work expands beyond the current vertical slice into unrelated future phases.

If a stop condition is reached:

1. Stop implementation.
2. Create or update `NIGHTLY_BLOCKERS.md`.
3. Update `STATUS.md` with the blocker, command results, and next safe action.
4. Do not continue broad changes.

## 6. Exact Order Of Work

1. DB/API hardening.
2. Board/product flow refinements.
3. Task detail refinements.
4. Dashboard refinements.
5. AI unavailable/working state polish.
6. Responsive, accessibility, and i18n pass.
7. Automated smoke/QA improvements.
8. Deployment blocker documentation and config readiness review.
9. Final documentation alignment across `STATUS.md`, `README.md`, `DELIVERY_PLAN.md`,
   `LOCAL_RUNTIME_SMOKE.md`, and relevant docs.

Each step should be a small vertical slice with code, docs, and validation before
moving to the next step.

## 7. Validation Commands Required After Every Prompt

Run these after every meaningful implementation or documentation chunk:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
```

If markdown formatting fails after documentation edits:

```bash
pnpm format
pnpm format:check
pnpm typecheck
pnpm lint
pnpm build
```

Additional local-only validation should be added when relevant to the chunk, such as
package-level typechecks, focused API checks, local browser smoke, or DB migrate/seed
against an explicitly safe local `DATABASE_URL`.

## Next Prompt Recommendation

```txt
Continue NIGHTLY PRODUCT DELIVERY MODE for AgentBoard.

Do not deploy, do not SSH, do not touch live server settings, do not commit secrets,
and keep OpenAI keys backend-only.

Start with DB/API hardening. Read AGENTS.md, STATUS.md, NIGHTLY_PLAN.md,
docs/01-architecture/database.md, docs/01-architecture/api-contracts.md,
packages/shared/src/api/contracts.ts, packages/db/src/schema.ts, and the API modules
under apps/api/src/modules.

Audit workspace boundary checks, request validation, response envelopes, transactional
mutations, board version updates, dashboard query scope, and AI suggestion apply/reject
scope. Implement only narrow, safe fixes with tests or focused validation where useful.

After changes run:
- pnpm typecheck
- pnpm lint
- pnpm build
- pnpm format:check

If a command fails and cannot be fixed safely, stop, update NIGHTLY_BLOCKERS.md and
STATUS.md, and do not continue broad changes.
```
