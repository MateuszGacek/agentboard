import type { DatabaseClient } from "@kanban/db";
import {
  boardColumns,
  boards,
  labels,
  projects,
  taskActivityEvents,
  taskChecklistItems,
  taskLabels,
  tasks
} from "@kanban/db";
import type {
  CreateProjectRequest,
  ProjectTemplateKey,
  ProjectTemplateSummary,
  UpdateProjectRequest,
  WorkspaceProject
} from "@kanban/shared";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { conflict, notFound } from "../../lib/errors";
import { assertWorkspaceMember } from "../workspaces/ownership";

type TransactionClient = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];
type ProjectMutationClient = DatabaseClient | TransactionClient;

type TemplateTask = {
  title: string;
  description: string;
  columnSystemKey: (typeof defaultColumns)[number]["systemKey"];
  priority: "low" | "medium" | "high" | "urgent";
  labels: Array<(typeof defaultLabels)[number]["name"]>;
  checklist: string[];
};

const defaultColumns = [
  {
    name: "Backlog",
    systemKey: "backlog",
    behavior: "none",
    position: 1000,
    wipLimit: null,
    colorKey: "slate"
  },
  {
    name: "Ready",
    systemKey: "ready",
    behavior: "none",
    position: 2000,
    wipLimit: 8,
    colorKey: "blue"
  },
  {
    name: "In Progress",
    systemKey: "in_progress",
    behavior: "starts_work",
    position: 3000,
    wipLimit: 3,
    colorKey: "violet"
  },
  {
    name: "Review",
    systemKey: "review",
    behavior: "active",
    position: 4000,
    wipLimit: 4,
    colorKey: "amber"
  },
  {
    name: "Blocked",
    systemKey: "blocked",
    behavior: "blocks_work",
    position: 5000,
    wipLimit: null,
    colorKey: "red"
  },
  {
    name: "Done",
    systemKey: "done",
    behavior: "completes_work",
    position: 6000,
    wipLimit: null,
    colorKey: "green"
  }
] as const;

const defaultLabels = [
  { name: "AI Assist", colorKey: "violet" },
  { name: "Client Risk", colorKey: "red" },
  { name: "Automation", colorKey: "blue" },
  { name: "QA", colorKey: "amber" },
  { name: "Discovery", colorKey: "green" }
] as const;

const projectTemplates = [
  {
    key: "blank",
    name: "Blank delivery workflow",
    description: "Start with default workflow columns and no seeded tasks.",
    recommended: false,
    tasks: []
  },
  {
    key: "ai-agency-delivery",
    name: "AI agency delivery",
    description:
      "A recruiter-ready AI software agency project with discovery, build, QA, and client-risk tasks.",
    recommended: true,
    tasks: [
      {
        title: "Confirm automation success criteria",
        description:
          "Align the client-facing success criteria before implementation so AI automation work is measurable and reviewable.",
        columnSystemKey: "backlog",
        priority: "high",
        labels: ["Discovery", "Client Risk"],
        checklist: ["Define measurable outcomes", "List edge cases", "Confirm owner sign-off"]
      },
      {
        title: "Prepare AI workflow prompt brief",
        description:
          "Write the implementation prompt brief, expected inputs, expected outputs, and review constraints for the delivery team.",
        columnSystemKey: "ready",
        priority: "medium",
        labels: ["AI Assist", "Automation"],
        checklist: ["Draft prompt context", "Add failure modes", "Review with delivery lead"]
      },
      {
        title: "Implement first automation path",
        description:
          "Build the first persisted automation path with safe backend handling and clear operator-facing status states.",
        columnSystemKey: "in_progress",
        priority: "high",
        labels: ["Automation"],
        checklist: ["Add API mutation", "Persist result state", "Add smoke coverage"]
      },
      {
        title: "Validate AI output quality gate",
        description:
          "Review generated output against acceptance criteria and capture risks before client handoff.",
        columnSystemKey: "review",
        priority: "medium",
        labels: ["QA", "AI Assist"],
        checklist: ["Check formatting", "Check factual constraints", "Record residual risks"]
      },
      {
        title: "Resolve blocked client credential access",
        description:
          "Client credential access is blocking final validation. Track the dependency and unblock before production use.",
        columnSystemKey: "blocked",
        priority: "urgent",
        labels: ["Client Risk"],
        checklist: ["Confirm missing credential", "Request access", "Retry validation"]
      }
    ]
  },
  {
    key: "web-app-delivery",
    name: "Web app delivery",
    description: "A concise web app build board for frontend, backend, QA, and release readiness.",
    recommended: false,
    tasks: [
      {
        title: "Lock app acceptance criteria",
        description:
          "Capture the core user journeys, mobile requirements, and release acceptance criteria before implementation starts.",
        columnSystemKey: "backlog",
        priority: "high",
        labels: ["Discovery"],
        checklist: ["List core routes", "Define mobile target widths", "Agree release checks"]
      },
      {
        title: "Build responsive application shell",
        description:
          "Implement navigation, protected routes, and responsive layout behavior for the application shell.",
        columnSystemKey: "ready",
        priority: "medium",
        labels: ["Automation"],
        checklist: ["Add shell routes", "Verify mobile nav", "Check keyboard access"]
      },
      {
        title: "Run UI regression pass",
        description:
          "Review key screens across supported widths and fix layout overflow before handoff.",
        columnSystemKey: "review",
        priority: "medium",
        labels: ["QA"],
        checklist: ["Check 360px", "Check tablet", "Check desktop"]
      }
    ]
  },
  {
    key: "qa-hardening",
    name: "QA hardening",
    description:
      "A focused hardening board for smoke tests, regressions, accessibility, and deployment readiness.",
    recommended: false,
    tasks: [
      {
        title: "Extend local smoke coverage",
        description:
          "Add smoke coverage for the latest product path and keep the script safe for local-only execution.",
        columnSystemKey: "ready",
        priority: "high",
        labels: ["QA"],
        checklist: ["Cover happy path", "Cover unavailable states", "Keep non-local guard"]
      },
      {
        title: "Fix mobile overflow risks",
        description:
          "Audit compact viewports and fix any layout that clips controls, cards, or important task metadata.",
        columnSystemKey: "in_progress",
        priority: "medium",
        labels: ["QA", "Client Risk"],
        checklist: ["Check dashboard", "Check board", "Check task sheet"]
      },
      {
        title: "Document remaining limitations",
        description:
          "Update status and architecture docs with exact command results and known product limitations.",
        columnSystemKey: "review",
        priority: "low",
        labels: ["Discovery"],
        checklist: ["Update STATUS.md", "Update API docs", "Update UX docs"]
      }
    ]
  },
  {
    key: "discovery-sprint",
    name: "Discovery sprint",
    description:
      "A lightweight board for client discovery, risk capture, prototype planning, and handoff.",
    recommended: false,
    tasks: [
      {
        title: "Map stakeholder workflow",
        description:
          "Interview stakeholders and capture the current workflow, handoffs, decision points, and bottlenecks.",
        columnSystemKey: "backlog",
        priority: "medium",
        labels: ["Discovery"],
        checklist: ["List stakeholders", "Document current process", "Highlight bottlenecks"]
      },
      {
        title: "Identify prototype risks",
        description:
          "Capture technical, data, and operational risks before committing to the prototype scope.",
        columnSystemKey: "ready",
        priority: "high",
        labels: ["Client Risk"],
        checklist: ["List data dependencies", "List integration risks", "Agree mitigations"]
      },
      {
        title: "Draft prototype task list",
        description:
          "Convert discovery findings into a small implementation-ready backlog for the first prototype.",
        columnSystemKey: "review",
        priority: "medium",
        labels: ["Discovery", "Automation"],
        checklist: ["Write task titles", "Add acceptance criteria", "Review with client"]
      }
    ]
  }
] satisfies Array<{
  key: ProjectTemplateKey;
  name: string;
  description: string;
  recommended: boolean;
  tasks: TemplateTask[];
}>;

function slugBase(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "project"
  );
}

async function createUniqueProjectSlug(
  db: ProjectMutationClient,
  workspaceId: string,
  name: string
) {
  const base = slugBase(name);

  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const existing = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.slug, candidate)))
      .limit(1);

    if (existing.length === 0) {
      return candidate;
    }
  }

  throw conflict("A project with a similar name already exists.");
}

async function ensureDefaultLabels(db: ProjectMutationClient, workspaceId: string) {
  const existingLabels = await db.select().from(labels).where(eq(labels.workspaceId, workspaceId));
  const existingNames = new Set(existingLabels.map((label) => label.name));
  const missingLabels = defaultLabels.filter((label) => !existingNames.has(label.name));

  if (missingLabels.length > 0) {
    await db.insert(labels).values(
      missingLabels.map((label) => ({
        workspaceId,
        name: label.name,
        colorKey: label.colorKey
      }))
    );
  }

  const rows = await db.select().from(labels).where(eq(labels.workspaceId, workspaceId));
  return new Map(rows.map((label) => [label.name, label]));
}

export function listProjectTemplates(): ProjectTemplateSummary[] {
  return projectTemplates.map((template) => ({
    key: template.key,
    name: template.name,
    description: template.description,
    taskCount: template.tasks.length,
    labelNames: [...new Set(template.tasks.flatMap((task) => task.labels))],
    recommended: template.recommended
  }));
}

function getProjectTemplate(key: ProjectTemplateKey): (typeof projectTemplates)[number] {
  const template = projectTemplates.find((candidate) => candidate.key === key);

  if (template) {
    return template;
  }

  const fallbackTemplate = projectTemplates[0];

  if (!fallbackTemplate) {
    throw new Error("Expected at least one project template to be configured.");
  }

  return fallbackTemplate;
}

async function seedProjectTemplate(input: {
  db: ProjectMutationClient;
  workspaceId: string;
  projectId: string;
  boardId: string;
  userId: string;
  templateKey: ProjectTemplateKey;
}) {
  const template = getProjectTemplate(input.templateKey);

  if (template.tasks.length === 0) {
    return;
  }

  const columns = await input.db
    .select()
    .from(boardColumns)
    .where(eq(boardColumns.boardId, input.boardId));
  const columnBySystemKey = new Map(columns.map((column) => [column.systemKey, column]));
  const labelByName = await ensureDefaultLabels(input.db, input.workspaceId);
  const columnTaskCounts = new Map<string, number>();

  for (const templateTask of template.tasks) {
    const column =
      columnBySystemKey.get(templateTask.columnSystemKey) ??
      columnBySystemKey.get("backlog") ??
      columns[0];

    if (!column) {
      throw new Error("Expected project template board to have at least one column.");
    }

    const nextCount = (columnTaskCounts.get(column.id) ?? 0) + 1;
    columnTaskCounts.set(column.id, nextCount);

    const [task] = await input.db
      .insert(tasks)
      .values({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        boardId: input.boardId,
        columnId: column.id,
        title: templateTask.title,
        description: templateTask.description,
        priority: templateTask.priority,
        position: nextCount * 1000,
        isBlocked: column.systemKey === "blocked",
        blockedReason:
          column.systemKey === "blocked" ? "Seeded template dependency to review." : null,
        createdBy: input.userId,
        startedAt:
          column.behavior === "starts_work" || column.behavior === "active" ? new Date() : null,
        completedAt: column.behavior === "completes_work" ? new Date() : null,
        updatedAt: new Date()
      })
      .returning();

    if (!task) {
      throw new Error("Expected template task to be returned.");
    }

    if (templateTask.checklist.length > 0) {
      await input.db.insert(taskChecklistItems).values(
        templateTask.checklist.map((title, index) => ({
          workspaceId: input.workspaceId,
          taskId: task.id,
          title,
          position: (index + 1) * 1000
        }))
      );
    }

    const taskLabelIds = templateTask.labels
      .map((labelName) => labelByName.get(labelName)?.id)
      .filter((labelId): labelId is string => Boolean(labelId));

    if (taskLabelIds.length > 0) {
      await input.db
        .insert(taskLabels)
        .values(taskLabelIds.map((labelId) => ({ taskId: task.id, labelId })));
    }

    await input.db.insert(taskActivityEvents).values({
      workspaceId: input.workspaceId,
      taskId: task.id,
      actorId: input.userId,
      type: "task.created",
      message: "Task created from project template.",
      metadata: { templateKey: input.templateKey }
    });
  }
}

async function getPrimaryBoard(
  db: ProjectMutationClient,
  projectId: string
): Promise<WorkspaceProject["primaryBoard"]> {
  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.projectId, projectId))
    .orderBy(asc(boards.createdAt))
    .limit(1);

  if (!board) {
    return null;
  }

  const taskRows = await db
    .select({
      columnBehavior: boardColumns.behavior
    })
    .from(tasks)
    .innerJoin(boardColumns, eq(tasks.columnId, boardColumns.id))
    .where(and(eq(tasks.boardId, board.id), isNull(tasks.archivedAt)));

  return {
    id: board.id,
    workspaceId: board.workspaceId,
    projectId: board.projectId,
    name: board.name,
    slug: board.slug,
    version: board.version,
    taskCount: taskRows.length,
    activeTaskCount: taskRows.filter((row) => row.columnBehavior !== "completes_work").length
  };
}

async function toWorkspaceProject(input: {
  db: ProjectMutationClient;
  project: typeof projects.$inferSelect;
}): Promise<WorkspaceProject> {
  return {
    id: input.project.id,
    workspaceId: input.project.workspaceId,
    name: input.project.name,
    slug: input.project.slug,
    description: input.project.description,
    status: input.project.status,
    createdAt: input.project.createdAt.toISOString(),
    updatedAt: input.project.updatedAt.toISOString(),
    primaryBoard: await getPrimaryBoard(input.db, input.project.id)
  };
}

export async function listWorkspaceProjects(
  db: DatabaseClient,
  input: { userId: string; workspaceId: string }
): Promise<WorkspaceProject[]> {
  await assertWorkspaceMember(db, input.userId, input.workspaceId);

  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, input.workspaceId))
    .orderBy(asc(projects.status), desc(projects.updatedAt), asc(projects.name));

  return Promise.all(rows.map((project) => toWorkspaceProject({ db, project })));
}

export async function getProjectListItem(
  db: DatabaseClient,
  input: { userId: string; projectId: string }
): Promise<WorkspaceProject> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);

  if (!project) {
    throw notFound("Project was not found.");
  }

  await assertWorkspaceMember(db, input.userId, project.workspaceId);

  return toWorkspaceProject({ db, project });
}

export async function createWorkspaceProject(
  db: DatabaseClient,
  input: { userId: string; workspaceId: string; body: CreateProjectRequest }
) {
  const createdProjectId = await db.transaction(async (tx) => {
    await assertWorkspaceMember(tx, input.userId, input.workspaceId);

    const now = new Date();
    const slug = await createUniqueProjectSlug(tx, input.workspaceId, input.body.name);
    const description = input.body.description?.trim() ? input.body.description : null;
    const boardName = input.body.boardName ?? `${input.body.name} Board`;

    const [project] = await tx
      .insert(projects)
      .values({
        workspaceId: input.workspaceId,
        slug,
        name: input.body.name,
        description,
        status: "active",
        createdBy: input.userId,
        updatedAt: now
      })
      .returning();

    if (!project) {
      throw new Error("Expected created project to be returned.");
    }

    const [board] = await tx
      .insert(boards)
      .values({
        workspaceId: input.workspaceId,
        projectId: project.id,
        slug: slugBase(boardName),
        name: boardName,
        description: "Default Kanban board for this project.",
        version: 1,
        updatedAt: now
      })
      .returning();

    if (!board) {
      throw new Error("Expected created board to be returned.");
    }

    await tx.insert(boardColumns).values(
      defaultColumns.map((column) => ({
        workspaceId: input.workspaceId,
        boardId: board.id,
        ...column
      }))
    );

    await ensureDefaultLabels(tx, input.workspaceId);
    await seedProjectTemplate({
      db: tx,
      workspaceId: input.workspaceId,
      projectId: project.id,
      boardId: board.id,
      userId: input.userId,
      templateKey: input.body.templateKey
    });

    return project.id;
  });

  return getProjectListItem(db, { userId: input.userId, projectId: createdProjectId });
}

export async function updateProject(
  db: DatabaseClient,
  input: { userId: string; projectId: string; body: UpdateProjectRequest }
) {
  const projectId = await db.transaction(async (tx) => {
    const [project] = await tx
      .select()
      .from(projects)
      .where(eq(projects.id, input.projectId))
      .limit(1);

    if (!project) {
      throw notFound("Project was not found.");
    }

    await assertWorkspaceMember(tx, input.userId, project.workspaceId);

    const updates: Partial<typeof projects.$inferInsert> = {
      updatedAt: new Date()
    };

    if (input.body.name !== undefined) updates.name = input.body.name;
    if (input.body.description !== undefined) updates.description = input.body.description;
    if (input.body.status !== undefined) {
      updates.status = input.body.status;
      updates.archivedAt = input.body.status === "archived" ? new Date() : null;
    }

    await tx.update(projects).set(updates).where(eq(projects.id, project.id));

    return project.id;
  });

  return getProjectListItem(db, { userId: input.userId, projectId });
}
