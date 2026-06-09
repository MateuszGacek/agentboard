const apiBaseUrl = process.env.SMOKE_API_URL ?? "http://localhost:3000/api";
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 10_000);

let cookie = "";

function assertSafeLocalUrl(url) {
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost");

  if (!isLocal) {
    throw new Error(`Refusing to run local smoke against non-local URL: ${url}`);
  }
}

async function request(pathname, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { ...options.headers };

  if (cookie) {
    headers.cookie = cookie;
  }

  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(`${apiBaseUrl}${pathname}`, {
      ...options,
      headers,
      signal: controller.signal
    });
    const setCookie = response.headers.get("set-cookie");

    if (setCookie) {
      cookie = setCookie.split(";")[0];
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        `${options.method ?? "GET"} ${pathname} failed ${response.status}: ${JSON.stringify(payload)}`
      );
    }

    return pathname === "/health" ? payload : payload?.data;
  } finally {
    clearTimeout(timeout);
  }
}

function countTasks(board) {
  return board.columns.reduce(
    (count, column) => count + (board.tasksByColumn[column.id]?.length ?? 0),
    0
  );
}

assertSafeLocalUrl(apiBaseUrl);

const results = [];
const health = await request("/health");
if (!health?.ok) {
  throw new Error("Health endpoint did not return ok=true.");
}
results.push("health");

const smokeRunId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const registered = await request("/auth/register", {
  method: "POST",
  body: {
    name: `Smoke User ${smokeRunId}`,
    email: `smoke-${smokeRunId}@kanban.local`,
    password: "SmokePass123!"
  }
});
const smokeWorkspaceId = registered.activeWorkspaceId;

if (!smokeWorkspaceId) {
  throw new Error("Registered smoke user did not receive an active workspace.");
}

const initialProjects = await request(`/workspaces/${smokeWorkspaceId}/projects`);

if (!Array.isArray(initialProjects.projects) || initialProjects.projects.length !== 0) {
  throw new Error("New smoke workspace should start with an empty project list.");
}

const templates = await request("/project-templates");
const recommendedTemplate = templates.templates?.find(
  (template) => template.key === "ai-agency-delivery" && template.recommended
);

if (!recommendedTemplate) {
  throw new Error("Project templates endpoint did not return the recommended AI agency template.");
}
results.push("project templates");

const createdProject = await request(`/workspaces/${smokeWorkspaceId}/projects`, {
  method: "POST",
  body: {
    name: `Smoke Project ${smokeRunId}`,
    description: "Local smoke project for the normal account task-entry path.",
    templateKey: "blank"
  }
});
const createdBoardId = createdProject.project?.primaryBoard?.id;

if (!createdBoardId) {
  throw new Error("Project creation did not return a primary board ID.");
}
results.push("project create with board");

const templatedProject = await request(`/workspaces/${smokeWorkspaceId}/projects`, {
  method: "POST",
  body: {
    name: `Smoke Template Project ${smokeRunId}`,
    description: "Local smoke project for template seeding.",
    templateKey: "ai-agency-delivery"
  }
});
const templatedBoardId = templatedProject.project?.primaryBoard?.id;

if (!templatedBoardId || templatedProject.project.primaryBoard.taskCount < 5) {
  throw new Error("Templated project creation did not seed expected tasks.");
}

const templatedBoard = await request(`/boards/${templatedBoardId}`);
const templatedTasks = templatedBoard.columns.flatMap(
  (column) => templatedBoard.tasksByColumn[column.id] ?? []
);

if (
  templatedTasks.length < 5 ||
  !templatedTasks.some((task) => task.checklist.total > 0 && task.labels.length > 0)
) {
  throw new Error("Templated board did not include seeded task labels and checklist items.");
}
results.push("project template seed");

const editedProject = await request(`/projects/${createdProject.project.id}`, {
  method: "PATCH",
  body: {
    name: `Smoke Project ${smokeRunId} edited`,
    description: "Edited by local smoke."
  }
});

if (editedProject.project.name !== `Smoke Project ${smokeRunId} edited`) {
  throw new Error("Project edit did not persist.");
}

const archivedProject = await request(`/projects/${createdProject.project.id}`, {
  method: "PATCH",
  body: { status: "archived" }
});

if (archivedProject.project.status !== "archived") {
  throw new Error("Project archive did not persist.");
}

const restoredProject = await request(`/projects/${createdProject.project.id}`, {
  method: "PATCH",
  body: { status: "active" }
});

if (restoredProject.project.status !== "active") {
  throw new Error("Project restore did not persist.");
}
results.push("project edit/archive/restore");

const createdBoard = await request(`/boards/${createdBoardId}`);
const firstColumn = createdBoard.columns[0];
const secondColumn = createdBoard.columns[1];

if (!firstColumn || !secondColumn || createdBoard.columns.length < 6) {
  throw new Error("Created project board did not include default columns.");
}

if (createdBoard.availableLabels.length === 0) {
  throw new Error("Project creation did not ensure default workspace labels.");
}
results.push("default board");

const updatedColumn = await request(`/board-columns/${firstColumn.id}`, {
  method: "PATCH",
  body: {
    name: `Backlog ${smokeRunId}`,
    wipLimit: 5
  }
});

if (updatedColumn.column.name !== `Backlog ${smokeRunId}` || updatedColumn.column.wip.limit !== 5) {
  throw new Error("Column settings update did not persist.");
}
results.push("column settings");

const createdTask = await request("/tasks", {
  method: "POST",
  body: {
    boardId: createdBoardId,
    columnId: firstColumn.id,
    title: `Smoke task ${smokeRunId}`,
    description: "Created through the DB-backed normal account project flow.",
    priority: "high",
    dueDate: new Date().toISOString().slice(0, 10),
    assigneeIds: [registered.user.id],
    labelIds: [createdBoard.availableLabels[0].id]
  }
});
results.push("task create");

const movedTask = await request(`/tasks/${createdTask.task.id}/move`, {
  method: "POST",
  body: {
    targetColumnId: secondColumn.id,
    targetIndex: 0,
    boardVersion: createdTask.board.version
  }
});

if (
  !movedTask.board.tasksByColumn[secondColumn.id]?.some((task) => task.id === createdTask.task.id)
) {
  throw new Error("Task move did not persist to target column.");
}
results.push("task move");

const editedTask = await request(`/tasks/${createdTask.task.id}`, {
  method: "PATCH",
  body: {
    title: `Smoke task ${smokeRunId} edited`,
    description: "Edited through the local smoke script.",
    priority: "urgent",
    isBlocked: true,
    blockedReason: "Smoke blocked reason."
  }
});

if (editedTask.task.priority !== "urgent" || !editedTask.task.isBlocked) {
  throw new Error("Task edit did not persist.");
}
results.push("task edit");

const createdChecklist = await request(`/tasks/${createdTask.task.id}/checklist-items`, {
  method: "POST",
  body: { title: "Smoke checklist item" }
});
const secondChecklist = await request(`/tasks/${createdTask.task.id}/checklist-items`, {
  method: "POST",
  body: { title: "Smoke checklist item second" }
});
const checklistItem = createdChecklist.task.checklistItems.find(
  (item) => item.title === "Smoke checklist item"
);
const secondChecklistItem = secondChecklist.task.checklistItems.find(
  (item) => item.title === "Smoke checklist item second"
);

if (!checklistItem || !secondChecklistItem) {
  throw new Error("Checklist create did not persist.");
}

const reorderedChecklist = await request(`/tasks/checklist-items/${secondChecklistItem.id}`, {
  method: "PATCH",
  body: { position: checklistItem.position - 1 }
});

if (reorderedChecklist.task.checklistItems[0]?.id !== secondChecklistItem.id) {
  throw new Error("Checklist reorder did not persist.");
}

const editedChecklist = await request(`/tasks/checklist-items/${checklistItem.id}`, {
  method: "PATCH",
  body: { title: "Smoke checklist item edited", isDone: true }
});
const editedChecklistItem = editedChecklist.task.checklistItems.find(
  (item) => item.id === checklistItem.id
);

if (!editedChecklistItem?.isDone || editedChecklistItem.title !== "Smoke checklist item edited") {
  throw new Error("Checklist edit/toggle did not persist.");
}

const deletedChecklist = await request(`/tasks/checklist-items/${checklistItem.id}`, {
  method: "DELETE"
});
const deletedSecondChecklist = await request(`/tasks/checklist-items/${secondChecklistItem.id}`, {
  method: "DELETE"
});

if (
  deletedChecklist.task.checklistItems.some((item) => item.id === checklistItem.id) ||
  deletedSecondChecklist.task.checklistItems.some((item) => item.id === secondChecklistItem.id)
) {
  throw new Error("Checklist delete did not persist.");
}
results.push("checklist edit/reorder/delete");

const createdComment = await request(`/tasks/${createdTask.task.id}/comments`, {
  method: "POST",
  body: { body: "Smoke comment." }
});
const comment = createdComment.task.comments.find((item) => item.body === "Smoke comment.");

if (!comment) {
  throw new Error("Comment create did not persist.");
}

const editedComment = await request(`/tasks/comments/${comment.id}`, {
  method: "PATCH",
  body: { body: "Smoke comment edited." }
});

if (
  !editedComment.task.comments.some(
    (item) => item.id === comment.id && item.body.includes("edited")
  )
) {
  throw new Error("Comment edit did not persist.");
}

const deletedComment = await request(`/tasks/comments/${comment.id}`, {
  method: "DELETE"
});

if (deletedComment.task.comments.some((item) => item.id === comment.id)) {
  throw new Error("Comment delete did not persist.");
}
results.push("comment edit/delete");

const normalDashboard = await request(
  `/workspaces/${smokeWorkspaceId}/dashboard?projectId=${createdProject.project.id}`
);

if (normalDashboard.totalRelevantTasks < 1 || normalDashboard.totalActiveTasks < 1) {
  throw new Error("Normal account dashboard did not include the created smoke task.");
}
results.push("project dashboard");

const weeklyReport = await request(
  `/workspaces/${smokeWorkspaceId}/reports/weekly?projectId=${createdProject.project.id}`
);

if (
  typeof weeklyReport.summaryMarkdown !== "string" ||
  !weeklyReport.summaryMarkdown.includes("Kanban weekly report")
) {
  throw new Error("Weekly report did not return copy-ready markdown.");
}
results.push("weekly report");

const deletedTask = await request(`/tasks/${createdTask.task.id}`, {
  method: "DELETE"
});

if (!deletedTask.ok) {
  throw new Error("Task delete did not return ok=true.");
}
results.push("task delete");

const demo = await request("/auth/demo", {
  method: "POST",
  body: { template: "ai-agency-default" }
});
const { boardId, workspaceId } = demo.demo;
results.push("demo auth");

const board = await request(`/boards/${boardId}`);
const taskCount = countTasks(board);
if (taskCount <= 0) {
  throw new Error("Board snapshot returned no tasks.");
}
results.push(`board snapshot (${taskCount} tasks)`);

const dashboard = await request(`/workspaces/${workspaceId}/dashboard`);
if (typeof dashboard.totalActiveTasks !== "number") {
  throw new Error("Dashboard endpoint did not return totalActiveTasks.");
}
results.push(`dashboard (${dashboard.totalActiveTasks} active tasks)`);

const firstTask = board.columns
  .flatMap((column) => board.tasksByColumn[column.id] ?? [])
  .find(Boolean);

if (!firstTask) {
  throw new Error("No task available for AI unavailable smoke.");
}

const aiResponse = await fetch(`${apiBaseUrl}/tasks/${firstTask.id}/ai/improve`, {
  method: "POST",
  headers: cookie ? { cookie } : undefined
});
const aiPayload = await aiResponse.json().catch(() => null);

if (process.env.OPENAI_API_KEY) {
  if (!aiResponse.ok) {
    throw new Error(
      `AI smoke expected success with OPENAI_API_KEY set, got ${aiResponse.status}: ${JSON.stringify(aiPayload)}`
    );
  }
  results.push("AI improve");
} else {
  if (aiResponse.status !== 503 || aiPayload?.error?.code !== "AI_UNAVAILABLE") {
    throw new Error(
      `AI unavailable smoke expected 503 AI_UNAVAILABLE, got ${aiResponse.status}: ${JSON.stringify(aiPayload)}`
    );
  }
  results.push("AI unavailable");
}

const aiHistory = await request(`/tasks/${firstTask.id}/ai-suggestions`);
if (!Array.isArray(aiHistory.suggestions)) {
  throw new Error("AI suggestion history did not return a suggestion list.");
}
results.push("AI history");

const aiNextActionsResponse = await fetch(`${apiBaseUrl}/boards/${boardId}/ai/next-actions`, {
  method: "POST",
  headers: {
    ...(cookie ? { cookie } : {}),
    "content-type": "application/json"
  },
  body: JSON.stringify({ maxSuggestions: 1 })
});
const aiNextActionsPayload = await aiNextActionsResponse.json().catch(() => null);

if (process.env.OPENAI_API_KEY) {
  if (!aiNextActionsResponse.ok) {
    throw new Error(
      `AI next actions smoke expected success with OPENAI_API_KEY set, got ${aiNextActionsResponse.status}: ${JSON.stringify(aiNextActionsPayload)}`
    );
  }
  results.push("AI next actions");
} else {
  if (
    aiNextActionsResponse.status !== 503 ||
    aiNextActionsPayload?.error?.code !== "AI_UNAVAILABLE"
  ) {
    throw new Error(
      `AI next actions unavailable smoke expected 503 AI_UNAVAILABLE, got ${aiNextActionsResponse.status}: ${JSON.stringify(aiNextActionsPayload)}`
    );
  }
  results.push("AI next actions unavailable");
}

console.info(`Local smoke PASS: ${results.join(", ")}.`);
