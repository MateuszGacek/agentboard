# 11 — Acceptance Criteria

## Overall acceptance

The project is ready for recruiter review when:

- live app loads,
- one-click demo works,
- board/task data persists,
- UI is polished and responsive,
- AI Improve works or degrades gracefully,
- README explains the product clearly,
- no secrets are committed,
- build/typecheck pass,
- deployment is documented.

## Product acceptance

### Must pass

- Product is clearly positioned as AI Kanban for software agencies.
- First screen explains value quickly.
- Demo flow is frictionless.
- App feels like a productivity SaaS, not a toy clone.
- WIP limits and AI Improve make business sense.

### Should pass

- Dashboard reinforces delivery visibility.
- Task detail is the core UX surface.
- Empty/loading/error states feel intentional.

## Auth acceptance

- Register creates user/session/workspace.
- Login creates session cookie.
- Logout clears session cookie and invalidates DB session.
- `/api/auth/me` returns current user/workspaces.
- Demo login creates isolated demo workspace.
- Session cookie is httpOnly.
- Production cookie uses secure mode.
- Expired session is rejected.

## Board acceptance

- Board loads from DB.
- Columns have stable system keys.
- Renaming/translating column display names does not break metrics.
- Tasks render in correct column order.
- Create task persists.
- Edit task persists.
- Delete task persists.
- Drag/drop works on desktop.
- Mobile Move menu works.
- Same-column reorder persists.
- Cross-column move persists.
- Done movement sets `completed_at`.
- Moving out of done clears `completed_at`.
- Board refresh preserves changes.

## WIP acceptance

- Column shows task count and WIP limit.
- WIP warning appears when count exceeds limit.
- Dashboard includes WIP issues.
- WIP calculation excludes completed/archived tasks.

## Task detail acceptance

- Opens as sheet/drawer on desktop.
- Opens usable full-height sheet/dialog on mobile.
- Shows title/description/properties.
- Supports labels, assignees, due date, priority, blocked state.
- Checklist items can be created/toggled/deleted.
- Comments can be created/edited/deleted.
- Activity log shows major events.
- Delete requires confirmation.

## Search/filter acceptance

- Search by title/description works.
- Filter by priority works.
- Filter by assignee works.
- Filter by label works.
- Filter by blocked works.
- Filter by due state works.
- Filters are reflected in URL.
- Reset filters works.
- No-results state is clear.

## Dashboard acceptance

- Metrics are calculated from DB.
- Total active tasks definition matches PRD.
- Completed this week uses `completed_at`.
- Overdue excludes completed tasks.
- Blocked count includes blocked tasks.
- WIP issues match board warnings.
- Dashboard is responsive.

## AI acceptance

- AI button visible in task detail.
- AI call uses backend endpoint only.
- OpenAI API key is never in frontend bundle.
- Missing API key shows graceful disabled/error state.
- OpenAI response is structured and validated.
- Suggestion is stored in `ai_suggestions`.
- Original vs improved comparison is clear.
- User can apply all.
- User can apply selected parts.
- User can reject suggestion.
- Applying suggested subtasks creates checklist items.
- Activity event is created.

## i18n acceptance

- EN/PL/CS translations exist.
- All visible UI text uses translation keys.
- Language detection works.
- User can switch language at runtime.
- Fallback to English works.
- Long PL/CS strings do not break mobile layout.
- Dates use selected locale.

## Theme acceptance

- Light mode works.
- Dark mode works.
- System mode works.
- Preference persists after reload.
- No unreadable text in either theme.
- Theme switch is accessible on desktop and mobile.

## Responsive acceptance

Test widths:

- 360px,
- 768px,
- 1024px,
- 1440px.

Must pass:

- no primary workflow broken at 360px,
- mobile board does not require horizontal drag,
- task sheet fits mobile viewport,
- toolbar actions remain reachable,
- language/theme controls reachable.

## Accessibility acceptance

- Keyboard focus visible.
- Dialogs/sheets have titles.
- Escape closes dialogs.
- Forms have labels.
- Buttons have accessible names.
- Drag/drop has non-drag fallback.
- Color is not the only status signal.

## API acceptance

- All endpoints return success/error envelopes.
- Validation errors are structured.
- Unauthorized returns `401`.
- Forbidden/not found behavior is consistent.
- Workspace ownership checks exist.
- Task move is transactional.
- AI apply is transactional.

## Database acceptance

- Migrations run cleanly.
- Seed is idempotent.
- Required indexes exist.
- Relations enforce cascading where appropriate.
- Workspace boundaries are represented in data model.
- Session tokens are stored hashed.

## Deployment acceptance

- Docker build succeeds.
- Docker Compose starts app and DB.
- Entrypoint waits for DB.
- Migrations run before server starts.
- Seed does not duplicate data on restart.
- `/api/health` works.
- App serves SPA fallback.
- Coolify deployment notes are accurate.

## GitHub acceptance

- README is recruiter-ready.
- `.env.example` exists.
- `.env` is ignored.
- No secrets committed.
- STATUS is accurate.
- Known limitations documented.
- License exists.
- Setup commands documented.
- Live URL documented when deployed.

## Final release checklist

Before sending to recruiter:

```txt
[ ] pnpm install works from clean clone
[ ] pnpm typecheck passes
[ ] pnpm lint passes or documented
[ ] pnpm build passes
[ ] migrations run
[ ] seed runs idempotently
[ ] demo login works
[ ] board CRUD/move works
[ ] AI improve works or gracefully disabled
[ ] Docker build works
[ ] deployed URL works
[ ] README has screenshots or demo notes
[ ] STATUS is up to date
[ ] no secrets in git history
```
