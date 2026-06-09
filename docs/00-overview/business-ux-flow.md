# Business and UX Flow

## Product narrative

Kanban is designed around a simple business insight:

> AI development teams do not only need to move cards. They need clearer tasks, lower WIP, and visibility into delivery risk.

The app should make this visible through the main flow:

```txt
Open demo → See delivery overview → Open board → Improve task quality → Move work → Monitor WIP/risk
```

## First impression flow

### 1. Landing / entry screen

Goal: communicate value quickly.

Primary copy:

```txt
Kanban
AI Kanban for software teams shipping with agents.
```

Subcopy:

```txt
Plan, prioritize and improve delivery work for AI development teams.
```

Primary CTA:

```txt
Open demo workspace
```

Secondary CTA:

```txt
Create account
```

UX requirements:

- no long marketing page required,
- premium hero card,
- light/dark/system visible,
- language switch visible,
- demo CTA obvious.

### 2. Demo session

Goal: make recruiter review frictionless.

Behavior:

- clicking demo creates an isolated demo user/session,
- user lands inside a seeded workspace,
- no email/password required,
- seeded data demonstrates WIP, overdue, blocked and AI improvement.

Recommended toast:

```txt
Demo workspace ready. Explore freely — changes are isolated to this session.
```

### 3. Dashboard first

Goal: show this is a delivery product, not just a board.

Dashboard should answer:

- how much work is active,
- what is blocked,
- what is overdue,
- where WIP is overloaded,
- what got completed recently.

Dashboard cards:

- Active tasks,
- Completed this week,
- Overdue,
- Blocked,
- WIP warnings,
- Completion rate.

UX behavior:

- cards link/filter into board if implemented,
- if drill-down is not implemented, cards remain static metrics with clear labels.

### 4. Board view

Goal: make core Kanban flow excellent.

Desktop layout:

```txt
Sidebar | Topbar
        | Board toolbar
        | Horizontal columns
```

Board toolbar contains:

- project/board title,
- create task button,
- search,
- filters,
- view density toggle if time allows.

Columns show:

- display name,
- stable status indicator,
- task count,
- WIP limit,
- WIP warning state,
- tasks sorted by position.

Task card should show:

- title,
- priority indicator,
- labels,
- due date,
- assignee avatar/initials,
- checklist progress,
- comment count,
- blocked marker.

### 5. Task creation

Use a modal/dialog, not inline-only creation.

Required fields:

- title,
- column/status,
- priority.

Optional fields:

- description,
- due date,
- assignee,
- labels.

UX:

- title autofocus,
- Enter saves if form is valid,
- validation errors are clear,
- after creation the task appears in the selected column,
- new task opens detail sheet only if useful; otherwise toast + card highlight.

### 6. Task detail sheet

This is the strongest product surface.

Desktop:

- right-side sheet, max width around 680–820px.

Mobile:

- full-height sheet with sticky header/footer.

Recommended layout:

```txt
Header
  Title
  Status / priority / actions

Main
  Description
  Properties
  Checklist
  Comments
  Activity
  AI Improve

Footer
  Save / Cancel / Delete
```

UX rules:

- destructive delete requires confirmation dialog,
- editing should be explicit and predictable,
- metadata changes can be inline controls,
- comments can submit on button press, not auto-save,
- activity log should be concise.

### 7. AI Improve flow

Goal: demonstrate AI as practical product enhancement.

Entry point:

```txt
Improve with AI
```

States:

1. Idle — CTA visible.
2. Loading — skeleton/spinner with copy: “Improving task clarity...”
3. Success — comparison mode.
4. Error — retry and fallback message.
5. Applied — activity event and updated task.

Comparison layout:

```txt
Original                  AI improved
--------------------------------------------------
Title                     Improved title
Description               Improved description
                          Acceptance criteria
                          Suggested subtasks
                          Risk notes
```

Actions:

- Apply all,
- Apply description only,
- Add acceptance criteria,
- Add suggested subtasks to checklist,
- Reject,
- Edit improved content before applying.

Business logic:

- AI is useful because it makes vague work actionable.
- User remains in control.
- Stored suggestions prove backend/product depth.

### 8. Mobile UX

Mobile cannot rely on horizontal desktop Kanban.

Recommended mobile structure:

- top project selector,
- compact toolbar,
- column tabs or segmented control,
- task list for selected column,
- bottom/right floating create button,
- task detail full-height sheet,
- “Move to...” action sheet for task movement.

Acceptance behavior:

- no forced horizontal scrolling for primary workflow,
- buttons have enough tap area,
- long translated labels wrap or truncate safely,
- filters can open in bottom sheet,
- language/theme switch remains reachable in settings/menu.

### 9. Empty, loading and error states

Every core screen needs states.

Examples:

#### Empty project

```txt
No boards yet
Create your first board to start planning delivery work.
```

#### Empty column

```txt
No tasks here
Move work into this stage or create a new task.
```

#### WIP warning

```txt
WIP limit exceeded
This column has 5 active tasks. Limit: 3.
```

#### AI error

```txt
AI improvement failed
Your task was not changed. Try again or continue editing manually.
```

## Recruiter demo script

The README should eventually include this short demo path:

1. Open the live app.
2. Start demo workspace.
3. Switch theme to dark.
4. Switch language to Polish/Czech.
5. Open board.
6. Move task to In Progress and observe WIP warning.
7. Open a vague task.
8. Click Improve with AI.
9. Apply acceptance criteria.
10. Check dashboard metrics.

## UX risk controls

Avoid these pitfalls:

- too many dashboards before board works,
- a large AI chat that distracts from Kanban,
- desktop-only drag/drop,
- unclear modal stacking,
- labels/colors that look random,
- translated UI with English hardcoded leftovers,
- fake metrics not calculated from DB.
