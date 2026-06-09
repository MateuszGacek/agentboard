# Accessibility Responsive i18n QA Report

Date: June 7, 2026

Mode: Accessibility Responsive i18n QA Pass

Deployment status: parked. No production deploy, SSH, live server changes, architecture
rewrite, or new product features were performed.

## i18n Result

- EN/PL/CS locale key parity: PASS.
- Locale files now contain 287 matching translation keys.
- Static React literal scan found no obvious visible hardcoded English UI copy in
  component output.
- Added `board.detail.description` in EN/PL/CS for accessible task-detail sheet
  description text.
- Existing seeded demo task/project/workspace data remains product data from the
  backend and may remain English for MVP per `docs/01-architecture/i18n.md`.

## Responsive Result

- Improved narrow-width header behavior on home and auth pages by allowing switcher
  controls to wrap instead of squeezing the brand/link area.
- Improved app topbar resilience by allowing a taller wrapped header and keeping the
  session controls from shrinking into the workspace label area.
- Adjusted board filter controls to use a less crowded 1024px layout before moving to
  the five-column desktop filter grid.
- Added break-word/min-width safeguards for board headers, column names, task titles,
  and label chips.
- Route-level local HTTP checks passed for:
  - `/`
  - `/login`
  - `/register`
  - `/app/settings`
  - `/app/dashboard`

## Accessibility Fixes

- Mobile navigation drawer now has:
  - `aria-labelledby`
  - `aria-modal="true"`
  - translated visible dialog title
  - Escape-to-close handling
- Dialog/sheet frame now supports `aria-describedby`.
- Create-task dialog, delete confirmation dialog, and task-detail sheet now expose
  translated descriptions to assistive technology.
- Removed the non-focusable drag icon from the task-card accessible name; task cards
  keep the translated open-task label.
- Kept icon-only buttons on translated labels for close, dismiss, mobile nav, theme,
  language, and logout controls.

## Loading/Error/Empty States

- Reviewed auth, board, task detail, dashboard, AI unavailable, and DB unavailable
  states in code.
- Existing states continue to use translated copy and semantic alert/skeleton surfaces.
- No new fake data or frontend-only state was introduced.

## Browser/Manual Checks

- Local API health smoke: PASS.
- Local SPA route serving smoke: PASS.
- Automated viewport screenshot checks for 360px, 768px, 1024px, and 1440px remain
  pending because direct Browser navigation/screenshot tooling was not exposed in this
  session and Playwright was not installed in the available Node runtime.
- Recommended follow-up: perform visual browser QA at 360, 768, 1024, and 1440 widths
  across EN/PL/CS, with special attention to board filters, task detail sheet, mobile
  nav, auth headers, dashboard cards, and settings.

## Remaining Risks

- Drag-and-drop is pointer-first. Mobile status changes remain available through the
  task-detail status select, but full keyboard drag reordering is not implemented.
- Focus trapping is still lightweight custom overlay behavior rather than Radix Dialog.
  Current overlays have titles, modal semantics, close controls, and Escape handling,
  but a future Radix Dialog migration would improve focus containment.
- Visual viewport QA is still needed once browser automation or manual browser review is
  available.

## Validation Results

| Command                               | Result | Notes                                                 |
| ------------------------------------- | ------ | ----------------------------------------------------- |
| i18n key parity script                | PASS   | EN/PL/CS share 287 keys.                              |
| React visible literal scan            | PASS   | No obvious visible hardcoded English component text.  |
| `pnpm --filter @kanban/web typecheck` | PASS   | Focused web check passed after accessibility changes. |
| Local API health smoke                | PASS   | `GET /api/health` returned `ok: true`.                |
| Local SPA route smoke                 | PASS   | Key routes served `200 text/html` with root element.  |
