import type {
  ActivityEventType,
  ColumnBehavior,
  ColumnSystemKey,
  LabelColor,
  TaskPriority
} from "@agentboard/shared";
import { and, eq } from "drizzle-orm";

import { createDatabaseClient } from "./client";
import {
  aiSuggestions,
  boardColumns,
  boards,
  labels,
  projects,
  taskActivityEvents,
  taskAssignees,
  taskChecklistItems,
  taskComments,
  taskLabels,
  tasks,
  users,
  workspaceMembers,
  workspaces
} from "./schema";

function takeFirst<T>(rows: T[], entity: string): T {
  const row = rows[0];

  if (!row) {
    throw new Error(`Expected ${entity} to be returned.`);
  }

  return row;
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

async function main() {
  const { client, db } = createDatabaseClient();

  try {
    await db.transaction(async (tx) => {
      const now = new Date();

      async function upsertUser(input: {
        name: string;
        email: string;
        avatarUrl?: string;
        isDemo?: boolean;
      }) {
        return takeFirst(
          await tx
            .insert(users)
            .values({
              name: input.name,
              email: input.email,
              avatarUrl: input.avatarUrl ?? null,
              isDemo: input.isDemo ?? true,
              locale: "en",
              theme: "system",
              updatedAt: now
            })
            .onConflictDoUpdate({
              target: users.email,
              set: {
                name: input.name,
                avatarUrl: input.avatarUrl ?? null,
                isDemo: input.isDemo ?? true,
                updatedAt: now
              }
            })
            .returning(),
          `user ${input.email}`
        );
      }

      const owner = await upsertUser({
        name: "Maya Kowalska",
        email: "demo_owner@agentboard.local"
      });
      const engineer = await upsertUser({
        name: "Leo Novak",
        email: "demo_engineer@agentboard.local"
      });
      const reviewer = await upsertUser({
        name: "Nina Carter",
        email: "demo_reviewer@agentboard.local"
      });
      const strategist = await upsertUser({
        name: "Oskar Zielinski",
        email: "demo_strategist@agentboard.local"
      });

      const workspace = takeFirst(
        await tx
          .insert(workspaces)
          .values({
            name: "Scale Software Demo",
            slug: "scale-software-demo",
            createdBy: owner.id,
            isDemo: true,
            updatedAt: now
          })
          .onConflictDoUpdate({
            target: workspaces.slug,
            set: {
              name: "Scale Software Demo",
              createdBy: owner.id,
              isDemo: true,
              updatedAt: now
            }
          })
          .returning(),
        "demo workspace"
      );

      for (const member of [
        { userId: owner.id, role: "owner" as const },
        { userId: engineer.id, role: "member" as const },
        { userId: reviewer.id, role: "member" as const },
        { userId: strategist.id, role: "member" as const }
      ]) {
        await tx
          .insert(workspaceMembers)
          .values({
            workspaceId: workspace.id,
            userId: member.userId,
            role: member.role
          })
          .onConflictDoUpdate({
            target: [workspaceMembers.workspaceId, workspaceMembers.userId],
            set: { role: member.role }
          });
      }

      const project = takeFirst(
        await tx
          .insert(projects)
          .values({
            workspaceId: workspace.id,
            slug: "ai-client-automation",
            name: "AI Client Automation",
            description: "Delivery board for an AI agency automation engagement.",
            status: "active",
            createdBy: owner.id,
            updatedAt: now
          })
          .onConflictDoUpdate({
            target: [projects.workspaceId, projects.slug],
            set: {
              name: "AI Client Automation",
              description: "Delivery board for an AI agency automation engagement.",
              status: "active",
              createdBy: owner.id,
              updatedAt: now
            }
          })
          .returning(),
        "demo project"
      );

      const board = takeFirst(
        await tx
          .insert(boards)
          .values({
            workspaceId: workspace.id,
            projectId: project.id,
            slug: "delivery-board",
            name: "Delivery Board",
            description: "Seeded Kanban board for recruiter demo review.",
            version: 1,
            updatedAt: now
          })
          .onConflictDoUpdate({
            target: [boards.projectId, boards.slug],
            set: {
              workspaceId: workspace.id,
              name: "Delivery Board",
              description: "Seeded Kanban board for recruiter demo review.",
              updatedAt: now
            }
          })
          .returning(),
        "demo board"
      );

      async function upsertColumn(input: {
        name: string;
        systemKey: ColumnSystemKey;
        behavior: ColumnBehavior;
        position: number;
        wipLimit: number | null;
        colorKey: string;
      }) {
        const existing = await tx
          .select()
          .from(boardColumns)
          .where(
            and(eq(boardColumns.boardId, board.id), eq(boardColumns.systemKey, input.systemKey))
          )
          .limit(1);

        if (existing[0]) {
          return takeFirst(
            await tx
              .update(boardColumns)
              .set({
                name: input.name,
                behavior: input.behavior,
                position: input.position,
                wipLimit: input.wipLimit,
                colorKey: input.colorKey,
                isArchived: false,
                updatedAt: now
              })
              .where(eq(boardColumns.id, existing[0].id))
              .returning(),
            `column ${input.systemKey}`
          );
        }

        return takeFirst(
          await tx
            .insert(boardColumns)
            .values({
              workspaceId: workspace.id,
              boardId: board.id,
              ...input
            })
            .returning(),
          `column ${input.systemKey}`
        );
      }

      const seededColumns = await Promise.all([
        upsertColumn({
          name: "Backlog",
          systemKey: "backlog",
          behavior: "none",
          position: 0,
          wipLimit: null,
          colorKey: "slate"
        }),
        upsertColumn({
          name: "Ready",
          systemKey: "ready",
          behavior: "none",
          position: 1,
          wipLimit: 8,
          colorKey: "blue"
        }),
        upsertColumn({
          name: "In Progress",
          systemKey: "in_progress",
          behavior: "starts_work",
          position: 2,
          wipLimit: 3,
          colorKey: "violet"
        }),
        upsertColumn({
          name: "Review",
          systemKey: "review",
          behavior: "active",
          position: 3,
          wipLimit: 4,
          colorKey: "amber"
        }),
        upsertColumn({
          name: "Blocked",
          systemKey: "blocked",
          behavior: "blocks_work",
          position: 4,
          wipLimit: null,
          colorKey: "red"
        }),
        upsertColumn({
          name: "Done",
          systemKey: "done",
          behavior: "completes_work",
          position: 5,
          wipLimit: null,
          colorKey: "green"
        })
      ]);

      const columnsByKey = new Map(seededColumns.map((column) => [column.systemKey, column]));

      function columnFor(systemKey: ColumnSystemKey) {
        const column = columnsByKey.get(systemKey);

        if (!column) {
          throw new Error(`Missing seeded column ${systemKey}.`);
        }

        return column;
      }

      async function upsertLabel(input: { name: string; colorKey: LabelColor }) {
        return takeFirst(
          await tx
            .insert(labels)
            .values({
              workspaceId: workspace.id,
              name: input.name,
              colorKey: input.colorKey,
              updatedAt: now
            })
            .onConflictDoUpdate({
              target: [labels.workspaceId, labels.name],
              set: {
                colorKey: input.colorKey,
                updatedAt: now
              }
            })
            .returning(),
          `label ${input.name}`
        );
      }

      const seededLabels = await Promise.all([
        upsertLabel({ name: "AI Assist", colorKey: "violet" }),
        upsertLabel({ name: "Client Risk", colorKey: "red" }),
        upsertLabel({ name: "Automation", colorKey: "blue" }),
        upsertLabel({ name: "QA", colorKey: "amber" }),
        upsertLabel({ name: "Discovery", colorKey: "green" })
      ]);
      const labelsByName = new Map(seededLabels.map((label) => [label.name, label]));

      function labelFor(name: string) {
        const label = labelsByName.get(name);

        if (!label) {
          throw new Error(`Missing seeded label ${name}.`);
        }

        return label;
      }

      async function upsertTask(input: {
        title: string;
        description: string | null;
        columnKey: ColumnSystemKey;
        priority: TaskPriority;
        position: number;
        isBlocked?: boolean;
        blockedReason?: string | null;
        dueDate?: Date | null;
        createdBy: string;
        startedAt?: Date | null;
        completedAt?: Date | null;
      }) {
        const column = columnFor(input.columnKey);
        const existing = await tx
          .select()
          .from(tasks)
          .where(and(eq(tasks.boardId, board.id), eq(tasks.title, input.title)))
          .limit(1);

        const taskValues = {
          workspaceId: workspace.id,
          projectId: project.id,
          boardId: board.id,
          columnId: column.id,
          title: input.title,
          description: input.description,
          priority: input.priority,
          position: input.position,
          isBlocked: input.isBlocked ?? false,
          blockedReason: input.blockedReason ?? null,
          dueDate: input.dueDate ?? null,
          createdBy: input.createdBy,
          startedAt: input.startedAt ?? null,
          completedAt: input.completedAt ?? null,
          archivedAt: null,
          updatedAt: now
        };

        if (existing[0]) {
          return takeFirst(
            await tx.update(tasks).set(taskValues).where(eq(tasks.id, existing[0].id)).returning(),
            `task ${input.title}`
          );
        }

        return takeFirst(
          await tx.insert(tasks).values(taskValues).returning(),
          `task ${input.title}`
        );
      }

      const seededTasks = await Promise.all([
        upsertTask({
          title: "Map client onboarding workflow",
          description:
            "Interview the operations lead and convert the current onboarding steps into a clear automation map.",
          columnKey: "backlog",
          priority: "medium",
          position: 0,
          dueDate: daysFromNow(8),
          createdBy: strategist.id
        }),
        upsertTask({
          title: "Make this automation task clearer",
          description: "Need better task for client thing. Maybe use AI and checklist.",
          columnKey: "backlog",
          priority: "low",
          position: 1,
          dueDate: daysFromNow(5),
          createdBy: owner.id
        }),
        upsertTask({
          title: "Draft agent handoff checklist",
          description:
            "Define the minimum context an implementation agent needs before touching client automation code.",
          columnKey: "ready",
          priority: "high",
          position: 0,
          dueDate: daysFromNow(2),
          createdBy: strategist.id
        }),
        upsertTask({
          title: "Define CRM sync acceptance criteria",
          description:
            "Document expected field mappings, sync direction, retry behavior, and failure visibility.",
          columnKey: "ready",
          priority: "medium",
          position: 1,
          dueDate: daysFromNow(3),
          createdBy: owner.id
        }),
        upsertTask({
          title: "Build invoice extraction agent prototype",
          description:
            "Create a focused prototype that extracts supplier, amount, due date, and tax ID from PDF invoices.",
          columnKey: "in_progress",
          priority: "urgent",
          position: 0,
          dueDate: daysFromNow(1),
          createdBy: engineer.id,
          startedAt: daysFromNow(-2)
        }),
        upsertTask({
          title: "Implement prompt evaluation dataset",
          description:
            "Add representative examples for correct, ambiguous, and failed automation requests.",
          columnKey: "in_progress",
          priority: "high",
          position: 1,
          dueDate: daysFromNow(4),
          createdBy: engineer.id,
          startedAt: daysFromNow(-1)
        }),
        upsertTask({
          title: "Connect Slack approval notifications",
          description:
            "Notify client approvers when an automation proposal is ready for review or rejected by QA.",
          columnKey: "in_progress",
          priority: "medium",
          position: 2,
          dueDate: daysFromNow(6),
          createdBy: engineer.id,
          startedAt: daysFromNow(-1)
        }),
        upsertTask({
          title: "Add retry policy for webhook worker",
          description:
            "Persist failed webhook attempts and retry with bounded exponential backoff and clear activity logs.",
          columnKey: "in_progress",
          priority: "high",
          position: 3,
          dueDate: daysFromNow(7),
          createdBy: engineer.id,
          startedAt: daysFromNow(-1)
        }),
        upsertTask({
          title: "Review dashboard metric definitions",
          description:
            "Check that active, completed, overdue, blocked, and WIP calculations match the product docs.",
          columnKey: "review",
          priority: "medium",
          position: 0,
          dueDate: daysFromNow(2),
          createdBy: reviewer.id,
          startedAt: daysFromNow(-3)
        }),
        upsertTask({
          title: "QA multilingual task detail copy",
          description:
            "Review English, Polish, and Czech UI labels for task properties and AI improvement actions.",
          columnKey: "review",
          priority: "medium",
          position: 1,
          dueDate: daysFromNow(3),
          createdBy: reviewer.id,
          startedAt: daysFromNow(-2)
        }),
        upsertTask({
          title: "Resolve OpenAI quota limits for demo tenant",
          description:
            "Confirm provider quota and fallback messaging before enabling public AI Improve in the demo.",
          columnKey: "blocked",
          priority: "urgent",
          position: 0,
          isBlocked: true,
          blockedReason: "Waiting for provider quota confirmation.",
          dueDate: daysFromNow(-1),
          createdBy: owner.id,
          startedAt: daysFromNow(-4)
        }),
        upsertTask({
          title: "Ship discovery workshop template",
          description:
            "Finalize the client workshop agenda and reusable task intake prompts for new automation projects.",
          columnKey: "done",
          priority: "low",
          position: 0,
          dueDate: daysFromNow(-3),
          createdBy: strategist.id,
          startedAt: daysFromNow(-8),
          completedAt: daysFromNow(-2)
        }),
        upsertTask({
          title: "Create initial demo workspace seed",
          description:
            "Prepare baseline data that shows WIP overload, blocked work, overdue risk, and completed delivery.",
          columnKey: "done",
          priority: "medium",
          position: 1,
          dueDate: daysFromNow(-5),
          createdBy: engineer.id,
          startedAt: daysFromNow(-7),
          completedAt: daysFromNow(-4)
        })
      ]);
      const tasksByTitle = new Map(seededTasks.map((task) => [task.title, task]));

      function taskFor(title: string) {
        const task = tasksByTitle.get(title);

        if (!task) {
          throw new Error(`Missing seeded task ${title}.`);
        }

        return task;
      }

      const taskAssignments = [
        { task: "Build invoice extraction agent prototype", userId: engineer.id },
        { task: "Implement prompt evaluation dataset", userId: engineer.id },
        { task: "Connect Slack approval notifications", userId: engineer.id },
        { task: "Add retry policy for webhook worker", userId: engineer.id },
        { task: "Review dashboard metric definitions", userId: reviewer.id },
        { task: "QA multilingual task detail copy", userId: reviewer.id },
        { task: "Draft agent handoff checklist", userId: strategist.id },
        { task: "Resolve OpenAI quota limits for demo tenant", userId: owner.id }
      ];

      for (const assignment of taskAssignments) {
        await tx
          .insert(taskAssignees)
          .values({
            taskId: taskFor(assignment.task).id,
            userId: assignment.userId
          })
          .onConflictDoNothing({
            target: [taskAssignees.taskId, taskAssignees.userId]
          });
      }

      const taskLabelLinks = [
        { task: "Build invoice extraction agent prototype", label: "AI Assist" },
        { task: "Build invoice extraction agent prototype", label: "Automation" },
        { task: "Implement prompt evaluation dataset", label: "AI Assist" },
        { task: "Connect Slack approval notifications", label: "Automation" },
        { task: "Review dashboard metric definitions", label: "QA" },
        { task: "QA multilingual task detail copy", label: "QA" },
        { task: "Resolve OpenAI quota limits for demo tenant", label: "Client Risk" },
        { task: "Map client onboarding workflow", label: "Discovery" },
        { task: "Make this automation task clearer", label: "AI Assist" }
      ];

      for (const link of taskLabelLinks) {
        await tx
          .insert(taskLabels)
          .values({
            taskId: taskFor(link.task).id,
            labelId: labelFor(link.label).id
          })
          .onConflictDoNothing({
            target: [taskLabels.taskId, taskLabels.labelId]
          });
      }

      async function upsertChecklistItem(input: {
        taskTitle: string;
        title: string;
        position: number;
        isDone?: boolean;
      }) {
        const task = taskFor(input.taskTitle);
        const existing = await tx
          .select()
          .from(taskChecklistItems)
          .where(
            and(
              eq(taskChecklistItems.taskId, task.id),
              eq(taskChecklistItems.position, input.position)
            )
          )
          .limit(1);

        const completedAt = input.isDone ? now : null;
        const values = {
          workspaceId: workspace.id,
          taskId: task.id,
          title: input.title,
          isDone: input.isDone ?? false,
          position: input.position,
          completedAt,
          updatedAt: now
        };

        if (existing[0]) {
          await tx
            .update(taskChecklistItems)
            .set(values)
            .where(eq(taskChecklistItems.id, existing[0].id));
          return;
        }

        await tx.insert(taskChecklistItems).values(values);
      }

      await Promise.all([
        upsertChecklistItem({
          taskTitle: "Build invoice extraction agent prototype",
          title: "Parse supplier name and invoice amount",
          position: 0,
          isDone: true
        }),
        upsertChecklistItem({
          taskTitle: "Build invoice extraction agent prototype",
          title: "Capture due date and tax identifier",
          position: 1
        }),
        upsertChecklistItem({
          taskTitle: "Draft agent handoff checklist",
          title: "Add required repository context",
          position: 0,
          isDone: true
        }),
        upsertChecklistItem({
          taskTitle: "Draft agent handoff checklist",
          title: "Add acceptance criteria template",
          position: 1
        }),
        upsertChecklistItem({
          taskTitle: "Make this automation task clearer",
          title: "Use AI Improve to generate acceptance criteria",
          position: 0
        })
      ]);

      async function upsertComment(input: { taskTitle: string; authorId: string; body: string }) {
        const task = taskFor(input.taskTitle);
        const existing = await tx
          .select()
          .from(taskComments)
          .where(and(eq(taskComments.taskId, task.id), eq(taskComments.body, input.body)))
          .limit(1);

        const values = {
          workspaceId: workspace.id,
          taskId: task.id,
          authorId: input.authorId,
          body: input.body,
          updatedAt: now
        };

        if (existing[0]) {
          await tx.update(taskComments).set(values).where(eq(taskComments.id, existing[0].id));
          return;
        }

        await tx.insert(taskComments).values(values);
      }

      await Promise.all([
        upsertComment({
          taskTitle: "Build invoice extraction agent prototype",
          authorId: reviewer.id,
          body: "Please keep the prototype narrow enough that we can review extraction quality quickly."
        }),
        upsertComment({
          taskTitle: "Resolve OpenAI quota limits for demo tenant",
          authorId: owner.id,
          body: "Do not enable public AI actions until the missing-key and quota fallback states are verified."
        }),
        upsertComment({
          taskTitle: "Make this automation task clearer",
          authorId: strategist.id,
          body: "This task is intentionally vague so the AI Improve flow has a useful before/after example."
        })
      ]);

      async function upsertActivityEvent(input: {
        taskTitle: string;
        actorId: string;
        type: ActivityEventType;
        message: string;
        metadata?: Record<string, unknown>;
      }) {
        const task = taskFor(input.taskTitle);
        const existing = await tx
          .select()
          .from(taskActivityEvents)
          .where(
            and(
              eq(taskActivityEvents.taskId, task.id),
              eq(taskActivityEvents.type, input.type),
              eq(taskActivityEvents.message, input.message)
            )
          )
          .limit(1);

        const values = {
          workspaceId: workspace.id,
          taskId: task.id,
          actorId: input.actorId,
          type: input.type,
          message: input.message,
          metadata: input.metadata ?? {}
        };

        if (existing[0]) {
          return;
        }

        await tx.insert(taskActivityEvents).values(values);
      }

      await Promise.all([
        upsertActivityEvent({
          taskTitle: "Build invoice extraction agent prototype",
          actorId: engineer.id,
          type: "task.created",
          message: "Task created for invoice extraction prototype."
        }),
        upsertActivityEvent({
          taskTitle: "Build invoice extraction agent prototype",
          actorId: engineer.id,
          type: "task.moved",
          message: "Task moved into In Progress.",
          metadata: { from: "Ready", to: "In Progress" }
        }),
        upsertActivityEvent({
          taskTitle: "Resolve OpenAI quota limits for demo tenant",
          actorId: owner.id,
          type: "task.blocked",
          message: "Task marked blocked while waiting for quota confirmation."
        }),
        upsertActivityEvent({
          taskTitle: "Create initial demo workspace seed",
          actorId: engineer.id,
          type: "task.completed",
          message: "Task completed after seed data was prepared."
        })
      ]);

      const aiExampleTask = taskFor("Make this automation task clearer");
      const existingSuggestion = await tx
        .select()
        .from(aiSuggestions)
        .where(
          and(eq(aiSuggestions.taskId, aiExampleTask.id), eq(aiSuggestions.model, "gpt-5-nano"))
        )
        .limit(1);

      if (!existingSuggestion[0]) {
        await tx.insert(aiSuggestions).values({
          workspaceId: workspace.id,
          taskId: aiExampleTask.id,
          createdBy: owner.id,
          model: "gpt-5-nano",
          status: "pending",
          originalPayload: {
            title: aiExampleTask.title,
            description: aiExampleTask.description,
            priority: aiExampleTask.priority
          },
          suggestedPayload: {
            improvedTitle: "Clarify client automation requirements and acceptance criteria",
            improvedDescription:
              "Turn the vague automation request into a concise implementation brief for the client workflow.",
            acceptanceCriteria: [
              "Current client process is summarized in 5-8 clear steps.",
              "Inputs, outputs, and owner for each automation step are documented.",
              "Known risks and missing client decisions are listed before implementation starts."
            ],
            suggestedSubtasks: [
              "Interview client operations owner",
              "Map current tools and handoff points",
              "Draft acceptance criteria for the automation workflow"
            ],
            riskNotes: ["Client process may vary by account segment."],
            recommendedPriority: "medium",
            confidence: 0.82
          }
        });

        await tx.insert(taskActivityEvents).values({
          workspaceId: workspace.id,
          taskId: aiExampleTask.id,
          actorId: owner.id,
          type: "ai.suggestion_created",
          message: "AI suggested improvements for this intentionally vague task.",
          metadata: { model: "gpt-5-nano" }
        });
      }
    });
  } finally {
    await client.end();
  }
}

main()
  .then(() => {
    console.log("AgentBoard demo seed completed.");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
