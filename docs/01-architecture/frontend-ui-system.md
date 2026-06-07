# Frontend UI System

## Design direction

Style:

```txt
premium SaaS + Linear-like developer tool
```

Visual qualities:

- clean layout,
- high contrast,
- subtle borders,
- soft shadows,
- clear hierarchy,
- restrained accent color,
- polished empty/loading states,
- useful microinteractions.

Avoid:

- colorful Trello clone look,
- heavy gradients everywhere,
- excessive animations,
- inconsistent component spacing,
- hardcoded colors outside theme tokens.

## Design tokens

Use Tailwind + CSS variables compatible with shadcn/ui.

Recommended semantic tokens:

```css
--background
--foreground
--card
--card-foreground
--popover
--popover-foreground
--primary
--primary-foreground
--secondary
--secondary-foreground
--muted
--muted-foreground
--accent
--accent-foreground
--destructive
--destructive-foreground
--border
--input
--ring
--radius
```

Kanban-specific semantic tokens:

```txt
priority.low
priority.medium
priority.high
priority.urgent
status.backlog
status.ready
status.in_progress
status.review
status.blocked
status.done
wip.warning
wip.danger
```

Implementation note:

Labels may store a constrained semantic color key, not arbitrary unsafe styling.

Example label color values:

```ts
type LabelColor = "slate" | "blue" | "violet" | "amber" | "green" | "red";
```

## Theme modes

Required modes:

- light,
- dark,
- system.

Behavior:

1. user selects mode,
2. mode stored in localStorage,
3. `system` follows `prefers-color-scheme`,
4. `<html class="dark">` toggles dark mode.

The theme switch should be visible in the app shell and accessible in mobile menu.

## Layout

### Desktop

```txt
┌─────────────────────────────────────────┐
│ Topbar                                  │
├──────────────┬──────────────────────────┤
│ Sidebar      │ Main content             │
│              │                          │
└──────────────┴──────────────────────────┘
```

Sidebar:

- workspace/project navigation,
- dashboard link,
- board link,
- settings link if implemented.

Topbar:

- current project/board,
- search/command trigger,
- language switch,
- theme switch,
- user menu.

### Tablet

- collapsible sidebar,
- board toolbar wraps,
- task detail sheet maxes available width.

### Mobile

- sidebar becomes drawer,
- topbar simplified,
- bottom navigation or compact menu,
- board uses column tabs/list,
- task detail is full-height sheet.

## Core UI components

### Primitives/shadcn

Use shadcn/Radix primitives for:

- Button,
- Input,
- Textarea,
- Select,
- Dialog,
- Sheet,
- Drawer if added,
- DropdownMenu,
- Popover,
- Command,
- Tabs,
- Badge,
- Avatar,
- Tooltip,
- Skeleton,
- Alert,
- Toast/Sonner.

### Product components

Recommended components:

```txt
AppShell
SidebarNav
Topbar
ThemeSwitch
LanguageSwitch
WorkspaceSwitcher
ProjectSwitcher
PageHeader
ProjectsPage
ProjectCreateDialog
ProjectTemplatePicker
MetricCard
WeeklyReportPanel
BoardToolbar
BoardSavedViews
BoardAiNextActionsPanel
KanbanBoard
KanbanColumn
TaskCard
TaskCreateDialog
TaskDetailSheet
TaskPropertiesPanel
ChecklistSection
CommentsSection
ActivitySection
AiImprovePanel
FilterSheet
ConfirmDialog
EmptyState
ErrorState
LoadingState
```

## Modals, sheets, dialogs

Use overlays intentionally:

| UI need                        | Component                                                    |
| ------------------------------ | ------------------------------------------------------------ |
| Create project                 | Dialog from Projects page                                    |
| Create task                    | Dialog on desktop, full-screen-ish dialog/sheet on mobile    |
| Task detail                    | Sheet/drawer                                                 |
| Confirm delete                 | AlertDialog                                                  |
| Filters mobile                 | Sheet                                                        |
| Language/theme compact actions | DropdownMenu                                                 |
| AI comparison                  | Panel inside task sheet; modal only if space is constrained  |
| AI next actions                | Panel on board; creates task only after explicit user action |
| Command/search                 | Command dialog if implemented                                |

Avoid nested modals where possible. If unavoidable, close child before parent action.

Saved board views are browser-local, scoped to `agentboard.boardViews.${boardId}`, and
must only store the existing URL filter state. Shared DB-backed saved views are outside
the current scope.

## Task card design

Task card content:

- title,
- optional short description preview,
- priority badge/icon,
- labels,
- due date,
- assignee avatar/initials,
- checklist progress,
- comment count,
- blocked indicator.

Task card states:

- default,
- hover,
- focused,
- dragging,
- selected/open,
- overdue,
- blocked,
- disabled while moving.

## Board interaction

### Desktop

- dnd-kit sortable columns/tasks,
- drag handle can be whole card,
- drag overlay should be polished,
- columns remain scrollable independently if needed,
- horizontal board scrolling allowed on desktop.

### Mobile

Do not rely on drag/drop.

Mobile movement:

- task card action menu,
- “Move to...” action,
- choose target column,
- optionally choose position: top/bottom in MVP,
- server persists movement.

## AI comparison UI

Recommended layout inside task sheet:

Desktop:

```txt
┌───────────────┬────────────────┐
│ Original      │ AI Improved    │
└───────────────┴────────────────┘
```

Mobile:

- tabs: Original / AI Improved,
- sticky action buttons.

Actions:

- Apply all,
- Apply description,
- Add checklist items,
- Reject,
- Retry.

## Forms

Use:

- react-hook-form,
- Zod resolver,
- shared schemas when possible,
- clear field-level errors,
- disabled submit during mutation.

Validation examples:

- task title: 1–120 chars,
- description: max 5000 chars,
- comment: 1–2000 chars,
- label name: 1–32 chars.

## Motion guidelines

Use subtle transitions for:

- sheet open/close,
- task card hover/focus,
- drag overlay,
- metric cards appearing,
- language/theme menu interactions,
- AI comparison panel reveal.

Avoid:

- long page transitions,
- animations that block interactions,
- noisy animated backgrounds.

## Accessibility acceptance criteria

- All dialogs have titles.
- Focus returns to trigger after dialog close.
- Keyboard users can create/edit/delete tasks.
- Drag/drop has mobile/menu fallback.
- Form errors are announced or visible near inputs.
- Color is not the only indicator for priority/status.
- Text contrast passes common accessibility expectations.
- Buttons have meaningful labels in all languages.

## Empty/loading/error states

Each major feature must have states:

- Dashboard loading skeleton.
- Board loading skeleton columns.
- Empty board/empty column.
- API error with retry.
- AI loading/error/retry.
- No search results.
- WIP exceeded warning.

## Responsive acceptance

Target viewports:

- 360px mobile,
- 768px tablet,
- 1024px laptop,
- 1440px desktop.

At 360px:

- no broken horizontal layout for main task workflow,
- language switch still reachable,
- task sheet fits viewport,
- button labels can shorten with translations.
