import type { DatabaseClient } from "@agentboard/db";
import {
  boardColumns,
  boards,
  labels,
  projects,
  taskAssignees,
  taskChecklistItems,
  taskComments,
  taskLabels,
  tasks,
  users,
  workspaceMembers,
  workspaces
} from "@agentboard/db";
import { randomUUID } from "node:crypto";

function takeFirst<T>(rows: T[], entity: string): T {
  const row = rows[0];

  if (!row) {
    throw new Error(`Expected ${entity} to be returned.`);
  }

  return row;
}

function randomSuffix() {
  return randomUUID().slice(0, 8);
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export async function createIsolatedDemoWorkspace(db: DatabaseClient) {
  return db.transaction(async (tx) => {
    const suffix = randomSuffix();
    const now = new Date();
    const demoUser = takeFirst(
      await tx
        .insert(users)
        .values({
          name: "Demo Lead",
          email: `demo-${suffix}@agentboard.local`,
          passwordHash: null,
          avatarUrl: null,
          locale: "en",
          theme: "system",
          isDemo: true,
          updatedAt: now
        })
        .returning(),
      "demo user"
    );

    const demoWorkspace = takeFirst(
      await tx
        .insert(workspaces)
        .values({
          name: "ScopePilot Demo",
          slug: `scale-software-demo-${suffix}`,
          createdBy: demoUser.id,
          isDemo: true,
          updatedAt: now
        })
        .returning(),
      "demo workspace"
    );

    await tx.insert(workspaceMembers).values({
      workspaceId: demoWorkspace.id,
      userId: demoUser.id,
      role: "owner"
    });

    const demoProject = takeFirst(
      await tx
        .insert(projects)
        .values({
          workspaceId: demoWorkspace.id,
          slug: `ai-delivery-${suffix}`,
          name: "Client Intake Automation",
          description: "Demo project for turning a broad AI delivery idea into scoped work.",
          status: "active",
          createdBy: demoUser.id,
          updatedAt: now
        })
        .returning(),
      "demo project"
    );

    const demoBoard = takeFirst(
      await tx
        .insert(boards)
        .values({
          workspaceId: demoWorkspace.id,
          projectId: demoProject.id,
          slug: `delivery-board-${suffix}`,
          name: "Scope Workflow",
          description: "Demo delivery workflow with saved tasks, blockers, and review signals.",
          version: 1,
          updatedAt: now
        })
        .returning(),
      "demo board"
    );

    const insertedColumns = await tx
      .insert(boardColumns)
      .values([
        {
          workspaceId: demoWorkspace.id,
          boardId: demoBoard.id,
          name: "Backlog",
          systemKey: "backlog",
          behavior: "none",
          position: 1000,
          colorKey: "slate"
        },
        {
          workspaceId: demoWorkspace.id,
          boardId: demoBoard.id,
          name: "Ready",
          systemKey: "ready",
          behavior: "starts_work",
          position: 2000,
          colorKey: "blue"
        },
        {
          workspaceId: demoWorkspace.id,
          boardId: demoBoard.id,
          name: "In Progress",
          systemKey: "in_progress",
          behavior: "active",
          position: 3000,
          wipLimit: 2,
          colorKey: "violet"
        },
        {
          workspaceId: demoWorkspace.id,
          boardId: demoBoard.id,
          name: "Review",
          systemKey: "review",
          behavior: "active",
          position: 4000,
          colorKey: "amber"
        },
        {
          workspaceId: demoWorkspace.id,
          boardId: demoBoard.id,
          name: "Done",
          systemKey: "done",
          behavior: "completes_work",
          position: 5000,
          colorKey: "green"
        }
      ])
      .returning();

    const backlog = takeFirst(
      insertedColumns.filter((column) => column.systemKey === "backlog"),
      "backlog column"
    );
    const inProgress = takeFirst(
      insertedColumns.filter((column) => column.systemKey === "in_progress"),
      "in-progress column"
    );
    const review = takeFirst(
      insertedColumns.filter((column) => column.systemKey === "review"),
      "review column"
    );
    const done = takeFirst(
      insertedColumns.filter((column) => column.systemKey === "done"),
      "done column"
    );

    const insertedLabels = await tx
      .insert(labels)
      .values([
        {
          workspaceId: demoWorkspace.id,
          name: "AI",
          colorKey: "violet"
        },
        {
          workspaceId: demoWorkspace.id,
          name: "Client",
          colorKey: "blue"
        },
        {
          workspaceId: demoWorkspace.id,
          name: "Risk",
          colorKey: "red"
        }
      ])
      .returning();

    const insertedTasks = await tx
      .insert(tasks)
      .values([
        {
          workspaceId: demoWorkspace.id,
          projectId: demoProject.id,
          boardId: demoBoard.id,
          columnId: backlog.id,
          title: "Clarify AI intake scope",
          description: "Turn broad client intake notes into acceptance criteria.",
          priority: "medium",
          position: 1000,
          createdBy: demoUser.id,
          dueDate: daysFromNow(4),
          updatedAt: now
        },
        {
          workspaceId: demoWorkspace.id,
          projectId: demoProject.id,
          boardId: demoBoard.id,
          columnId: inProgress.id,
          title: "Implement answer quality checks",
          description: "Compare generated answers against source snippets before client review.",
          priority: "high",
          position: 1000,
          createdBy: demoUser.id,
          startedAt: now,
          updatedAt: now
        },
        {
          workspaceId: demoWorkspace.id,
          projectId: demoProject.id,
          boardId: demoBoard.id,
          columnId: inProgress.id,
          title: "Unblock billing handoff",
          description: "Waiting for finance contact details from the client.",
          priority: "urgent",
          position: 2000,
          isBlocked: true,
          blockedReason: "Client has not confirmed billing owner.",
          createdBy: demoUser.id,
          startedAt: now,
          dueDate: daysFromNow(-1),
          updatedAt: now
        },
        {
          workspaceId: demoWorkspace.id,
          projectId: demoProject.id,
          boardId: demoBoard.id,
          columnId: review.id,
          title: "Review prompt quality report",
          description: "Check regression notes before sharing with stakeholders.",
          priority: "medium",
          position: 1000,
          createdBy: demoUser.id,
          startedAt: now,
          updatedAt: now
        },
        {
          workspaceId: demoWorkspace.id,
          projectId: demoProject.id,
          boardId: demoBoard.id,
          columnId: done.id,
          title: "Ship first ScopePilot demo space",
          description: "Seeded workflow is ready for product review.",
          priority: "low",
          position: 1000,
          createdBy: demoUser.id,
          startedAt: now,
          completedAt: now,
          updatedAt: now
        }
      ])
      .returning();

    for (const task of insertedTasks) {
      await tx.insert(taskAssignees).values({
        taskId: task.id,
        userId: demoUser.id
      });
    }

    const firstTask = takeFirst(insertedTasks, "demo task");
    const firstLabel = takeFirst(insertedLabels, "demo label");

    await tx.insert(taskChecklistItems).values([
      {
        workspaceId: demoWorkspace.id,
        taskId: firstTask.id,
        title: "Confirm the desired outcome",
        isDone: true,
        position: 1000,
        completedAt: now
      },
      {
        workspaceId: demoWorkspace.id,
        taskId: firstTask.id,
        title: "Write measurable acceptance criteria",
        isDone: false,
        position: 2000
      }
    ]);

    await tx.insert(taskComments).values({
      workspaceId: demoWorkspace.id,
      taskId: firstTask.id,
      authorId: demoUser.id,
      body: "This task is intentionally broad enough for the AI clarification flow.",
      updatedAt: now
    });

    await tx.insert(taskLabels).values({
      taskId: firstTask.id,
      labelId: firstLabel.id
    });

    return {
      user: demoUser,
      workspace: demoWorkspace,
      project: demoProject,
      board: demoBoard
    };
  });
}
