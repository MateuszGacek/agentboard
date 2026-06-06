# 07 — AI Feature

## Feature name

**Improve with AI**

## Goal

Use AI to make vague Kanban tasks clearer and more implementation-ready.

This should feel like a practical product feature, not a gimmick or generic chatbot.

## Default model

Default env:

```txt
OPENAI_MODEL=gpt-5-nano
```

The model must be configurable through env.

Rationale:

- the task is focused text transformation,
- low cost matters for a public demo,
- if quality is insufficient, the model can be upgraded through env without code changes.

## Backend-only rule

The frontend must never call OpenAI directly.

Flow:

```txt
Task detail UI
  -> POST /api/tasks/:taskId/ai/improve
    -> Hono backend
      -> validate auth/workspace/task
      -> call OpenAI
      -> validate structured JSON
      -> store ai_suggestion
      -> return suggestion to frontend
```

## User flow

### Entry point

Inside task detail sheet:

```txt
Improve with AI
```

Add helper copy:

```txt
Turn a vague task into a clearer implementation brief with acceptance criteria and subtasks.
```

### UI states

| State    | UI behavior                                             |
| -------- | ------------------------------------------------------- |
| Idle     | Button enabled if AI feature enabled and task has title |
| Loading  | Disable button, show “Improving task clarity...”        |
| Success  | Show original vs improved comparison                    |
| Error    | Show safe message and retry                             |
| Applied  | Update task/checklist and activity                      |
| Rejected | Close comparison or mark as rejected                    |

### Comparison layout

Desktop:

```txt
Original task                   AI improved task
-------------------------------------------------------------
Title                           Improved title
Description                     Improved description
Priority                        Recommended priority
                                Acceptance criteria
                                Suggested subtasks
                                Risk notes
```

Mobile:

- use tabs or stacked sections,
- keep apply/reject actions sticky.

## AI output schema

Structured output must validate to this shape:

```ts
type AiTaskImprovement = {
  improvedTitle: string;
  improvedDescription: string;
  acceptanceCriteria: string[];
  suggestedSubtasks: string[];
  riskNotes: string[];
  recommendedPriority: "low" | "medium" | "high" | "urgent";
  confidence: number;
};
```

Constraints:

- `improvedTitle`: 3–120 chars,
- `improvedDescription`: 20–5000 chars,
- `acceptanceCriteria`: 2–8 items,
- `suggestedSubtasks`: 0–8 items,
- `riskNotes`: 0–5 items,
- `confidence`: number from 0 to 1.

## Prompt design

System message:

```txt
You improve software delivery tasks for an AI development agency.
Return only structured output that matches the provided schema.
Do not invent external business context.
Keep the task actionable, concise and implementation-ready.
Write in the same language as the task content unless the task content is too short; then use English.
```

User context:

```txt
Task title: {{title}}
Task description: {{description}}
Current priority: {{priority}}
Column/status: {{columnName}} / {{columnSystemKey}}
Labels: {{labels}}
Due date: {{dueDate}}
Checklist: {{checklistItems}}
Comments summary: {{recentComments}}
```

Instructions:

```txt
Improve clarity.
Add concrete acceptance criteria.
Suggest subtasks only when useful.
Mention risks or missing information.
Recommend priority only if it differs from current priority.
Do not include markdown tables.
Do not include private assumptions.
```

## Backend implementation requirements

### Endpoint

```txt
POST /api/tasks/:taskId/ai/improve
```

Backend must:

1. authenticate user,
2. validate task workspace ownership,
3. check `AI_FEATURE_ENABLED`,
4. check `OPENAI_API_KEY`,
5. build task context,
6. call OpenAI with structured output,
7. validate response with Zod,
8. store original and suggested payload in `ai_suggestions`,
9. create activity event,
10. return suggestion.

### Timeout

Use env:

```txt
OPENAI_TIMEOUT_MS=20000
```

If timeout happens:

- do not change task,
- return `AI_UNAVAILABLE`,
- frontend shows retry.

### Feature flag

```txt
AI_FEATURE_ENABLED=true
```

If false:

- hide or disable AI button,
- show “AI is disabled in this environment” if user tries direct action.

### Cost control

- limit prompt context to task-relevant fields,
- cap output tokens,
- avoid sending full activity history,
- send only recent comment summary if needed,
- optionally rate-limit per user/session.

### Privacy

Do not send:

- session tokens,
- user emails unless needed,
- unrelated workspace data,
- API keys,
- hidden infrastructure details.

## Apply flow

Endpoint:

```txt
POST /api/tasks/:taskId/ai/suggestions/:suggestionId/apply
```

Apply options:

- title,
- description,
- priority,
- acceptance criteria appended to description,
- subtasks added as checklist items.

User can edit improved content before applying. The edited content is what gets persisted.

Status rules:

- all major fields applied → `accepted`,
- only selected fields applied → `partially_applied`,
- rejected → `rejected`.

## Error messages

Frontend copy examples:

```txt
AI improvement failed. Your task was not changed.
```

```txt
AI is disabled in this environment.
```

```txt
This task needs at least a title before AI can improve it.
```

## Activity events

Create events:

- `ai.suggestion_created`,
- `ai.suggestion_applied`,
- `ai.suggestion_rejected`.

Activity message examples:

```txt
AI suggested improvements for this task.
```

```txt
Mateusz applied AI acceptance criteria.
```

## Acceptance criteria

- AI button appears in task detail.
- Missing API key does not crash app.
- AI call is backend-only.
- Response is structured and validated.
- Suggestion is stored in DB.
- Original vs improved UI is clear.
- User can accept all, apply parts, or reject.
- Applying updates task/checklist and activity.
- Errors show retry without modifying task.
