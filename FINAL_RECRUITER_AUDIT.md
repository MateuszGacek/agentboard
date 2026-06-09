# Kanban Final Recruiter Audit

Audit date: June 6, 2026

## Readiness Summary

Kanban is ready for a first Coolify deployment attempt and final deployed smoke
test. The repository presents a coherent full-stack portfolio product with a real
PostgreSQL-backed Kanban vertical slice, task detail depth, dashboard metrics,
backend-only AI Improve flow, i18n/theme support, and Docker/Coolify deployment
baseline.

The code passes static validation. Public recruiter sharing should wait until the app is
deployed and the live demo path is verified at the target URL.

## Readiness Score

8.5 / 10

Rationale:

- Strong: implemented product slices are real, typed, DB-backed, and documented.
- Strong: README/STATUS now explain completed and pending work honestly.
- Strong: no real secrets or frontend OpenAI key exposure found.
- Pending: no safe local `DATABASE_URL` or backend-only `OPENAI_API_KEY` was available
  in this shell, so DB-backed runtime and real AI smoke tests remain pending.
- Pending: live deployment at `https://kanban.matgac.pl` has not been verified.

## Completed Surfaces

| Surface                  | Status    | Notes                                                          |
| ------------------------ | --------- | -------------------------------------------------------------- |
| Auth/register/login/demo | Completed | DB-backed auth routes, session cookies, isolated demo data.    |
| Workspace/project shell  | Completed | Protected shell and navigation exist; management UI planned.   |
| DB-backed board          | Completed | Board snapshot loads real workspace/project/column/task data.  |
| Task create/edit/delete  | Completed | Mutations persist through API and update board snapshots.      |
| Drag/drop move           | Completed | Desktop movement persists through task move API.               |
| Same-column reorder      | Completed | Move endpoint compacts/repositions ordered task lists.         |
| Cross-column move        | Completed | Move endpoint updates column and started/completed timestamps. |
| WIP warnings             | Completed | Uses column `wip_limit` and active task count.                 |
| Mobile Move to fallback  | Completed | Task detail status selector supports non-drag movement.        |
| Polished task detail     | Completed | Properties, labels, assignees, checklist, comments, activity.  |
| Dashboard metrics        | Completed | Workspace-scoped DB-backed metrics and risk lists.             |
| AI Improve feature       | Completed | Backend OpenAI call, persisted suggestions, apply/reject UI.   |
| i18n EN/PL/CS            | Completed | Translation key coverage check passed for app source.          |
| Light/dark/system mode   | Completed | Theme provider persists preference and supports system mode.   |
| Responsive UI            | Completed | Shell, board, dashboard, task sheet use responsive layouts.    |
| Deployment baseline      | Completed | Dockerfile, Compose, entrypoint, healthcheck, docs exist.      |
| Docker/Coolify readiness | Completed | Ready for deployment attempt; live smoke still required.       |

## Missing Or Runtime Pending Items

- Production deployment at `https://kanban.matgac.pl` is not verified yet.
- DB-backed runtime smoke was not run because `DATABASE_URL` is not set in this shell.
- Real AI endpoint smoke was not run because `OPENAI_API_KEY` is not set in this shell.
- Dashboard runtime smoke still needs a safe DB-backed app session.
- Workspace/project/settings management routes remain placeholders by design.
- Checklist delete/reorder and comment edit/delete are future refinements.
- Search/filter, realtime, file uploads, billing, and invites remain planned.

## GitHub Safety Checklist

| Check                               | Result | Notes                                                      |
| ----------------------------------- | ------ | ---------------------------------------------------------- |
| `.env` committed                    | PASS   | `.env` is ignored; no `.env` file is tracked.              |
| `.env.example` present              | PASS   | Complete enough for app, DB, auth, demo, AI settings.      |
| Real secrets committed              | PASS   | No real API keys found by repo scan.                       |
| OpenAI key exposed in frontend      | PASS   | `OPENAI_API_KEY` appears only in backend/docs/env files.   |
| Local absolute paths in docs/source | PASS   | No local absolute filesystem paths found in project files. |
| Production URL wording              | PASS   | README says target URL is a placeholder/unverified.        |
| License exists                      | PASS   | `LICENSE` is present.                                      |
| README recruiter-ready              | PASS   | Product, setup, status, limitations, review path added.    |
| Markdown links practical check      | PASS   | README/STATUS/docs local links resolved.                   |
| Translation key coverage            | PASS   | EN/PL/CS app-source key scan passed.                       |
| Dockerfile/Compose present          | PASS   | Deployment baseline exists.                                |
| Docker build run                    | PASS   | `docker build -t kanban-local .` completed.                |

## Recruiter Review Path

1. Open the live URL after deployment and start the demo session.
2. Review the DB-backed board vertical slice: create, edit, move, reorder, archive.
3. Open task detail and inspect properties, labels, assignees, checklist, comments,
   activity, and mobile Move to fallback.
4. Open dashboard metrics and verify WIP/risk/status/priority views use real data.
5. Try Improve with AI. Without a key, verify graceful unavailable state; with a
   backend key, generate/apply/reject a suggestion.
6. Inspect shared API contracts in `packages/shared/src/api/contracts.ts`.
7. Inspect database schema and migrations in `packages/db`.

## Deployment Checklist

Before deployment:

- Confirm target DNS/proxy route in Coolify.
- Set `NODE_ENV=production`.
- Set `APP_URL=https://kanban.matgac.pl`.
- Set a strong `SESSION_SECRET` with at least 32 characters.
- Set `DATABASE_URL` to the intended Coolify/Postgres service.
- Set matching `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`.
- Decide whether `SEED_DEMO_DATA=true` should run on startup.
- Set `OPENAI_API_KEY` only in backend/Coolify env if real AI smoke is desired.

After deployment:

- Verify `GET /api/health`.
- Verify SPA refresh on `/`, `/login`, `/register`, `/app`, `/app/dashboard`.
- Verify demo login creates an isolated workspace.
- Verify board load, task create/edit/move/archive, and task detail mutations.
- Verify dashboard metrics load from DB.
- Verify AI unavailable state or real AI generate/apply/reject path.
- Verify EN/PL/CS language switch and light/dark/system theme.
- Verify mobile widths around 360px and tablet/desktop widths.

## Final Blockers

No static code blocker remains.

Runtime blockers before recruiter sharing:

- Deploy the app.
- Run deployed DB-backed product smoke.
- Run AI unavailable smoke, and optionally real AI smoke with a backend-only key.

## Final Recommendation

Decision: `READY_FOR_DEPLOYMENT`

Proceed to Coolify deployment next. Do not send the project to recruiters until the
deployed URL and demo path are verified and `STATUS.md` is updated with live smoke
results.
