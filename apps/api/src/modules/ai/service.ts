import type { DatabaseClient } from "@agentboard/db";
import {
  aiSuggestions,
  boardColumns,
  boards,
  taskActivityEvents,
  taskChecklistItems,
  tasks
} from "@agentboard/db";
import {
  aiTaskImprovementSchema,
  type AiSuggestion,
  type AiTaskImprovement,
  type ApplyAiSuggestionRequest,
  type TaskPriority
} from "@agentboard/shared";
import { and, eq, isNull, sql } from "drizzle-orm";

import type { ApiEnv } from "../../env";
import {
  aiUnavailable,
  AppError,
  conflict,
  notFound,
  rateLimited,
  validationError
} from "../../lib/errors";
import { getBoardSnapshot } from "../boards/snapshot";
import { assertWorkspaceMember } from "../workspaces/ownership";
import { getTaskDetail } from "../tasks/detail";

type TransactionClient = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];
type AiMutationClient = DatabaseClient | TransactionClient;

const aiResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "improvedTitle",
    "improvedDescription",
    "acceptanceCriteria",
    "suggestedChecklistItems",
    "riskNotes",
    "recommendedPriority"
  ],
  properties: {
    improvedTitle: { type: "string", minLength: 3, maxLength: 120 },
    improvedDescription: { type: "string", minLength: 20, maxLength: 5000 },
    acceptanceCriteria: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 500 }
    },
    suggestedChecklistItems: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 240 }
    },
    riskNotes: {
      type: "array",
      maxItems: 5,
      items: { type: "string", minLength: 1, maxLength: 500 }
    },
    recommendedPriority: { type: "string", enum: ["low", "medium", "high", "urgent"] }
  }
} as const;

function toIsoTimestamp(value: Date | null) {
  return value ? value.toISOString() : null;
}

function mapSuggestion(row: typeof aiSuggestions.$inferSelect): AiSuggestion {
  const suggestedPayload = aiTaskImprovementSchema.parse(row.suggestedPayload);

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    taskId: row.taskId,
    model: row.model,
    status: row.status,
    originalPayload: row.originalPayload,
    suggestedPayload,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    appliedAt: toIsoTimestamp(row.appliedAt)
  };
}

async function insertActivity(input: {
  db: AiMutationClient;
  workspaceId: string;
  taskId: string;
  actorId: string;
  type: typeof taskActivityEvents.$inferInsert.type;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await input.db.insert(taskActivityEvents).values({
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    actorId: input.actorId,
    type: input.type,
    message: input.message,
    metadata: input.metadata ?? {}
  });
}

function assertAiEnabled(env: ApiEnv) {
  if (!env.AI_FEATURE_ENABLED) {
    throw aiUnavailable("AI is disabled in this environment.");
  }

  if (!env.OPENAI_API_KEY) {
    throw aiUnavailable("AI is unavailable because OPENAI_API_KEY is not configured.");
  }
}

function trimList(values: string[], limit: number) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function buildOriginalPayload(input: {
  task: Awaited<ReturnType<typeof getTaskDetail>>;
  column: typeof boardColumns.$inferSelect;
}) {
  return {
    title: input.task.title,
    description: input.task.description,
    priority: input.task.priority,
    columnName: input.column.name,
    columnSystemKey: input.column.systemKey,
    labels: input.task.labels.map((label) => label.name),
    dueDate: input.task.dueDate,
    checklistItems: input.task.checklistItems.map((item) => ({
      title: item.title,
      isDone: item.isDone
    })),
    recentComments: input.task.comments.slice(-3).map((comment) => ({
      authorName: comment.author.name,
      body: comment.body.slice(0, 500)
    }))
  };
}

function buildPrompt(originalPayload: Record<string, unknown>) {
  return [
    "Improve this software delivery task for an AI development agency.",
    "Return only JSON that matches the provided schema.",
    "Do not invent external business context.",
    "Keep the result actionable, concise, and implementation-ready.",
    "Write in the same language as the task content unless the task content is too short; then use English.",
    "Use acceptance criteria for concrete verification steps.",
    "Suggest checklist items only when useful.",
    "Mention risks or missing information in risk notes.",
    "Do not include markdown tables.",
    "",
    JSON.stringify(originalPayload, null, 2)
  ].join("\n");
}

function extractOutputText(payload: unknown) {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const response = payload as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ type?: string; text?: unknown; refusal?: unknown }> }>;
  };

  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  for (const output of response.output ?? []) {
    for (const content of output.content ?? []) {
      if (typeof content.refusal === "string") {
        throw aiUnavailable("AI could not improve this task.");
      }

      if (typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return null;
}

async function callOpenAi(input: {
  env: ApiEnv;
  originalPayload: Record<string, unknown>;
}): Promise<AiTaskImprovement> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.env.OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: input.env.OPENAI_MODEL,
        input: [
          {
            role: "system",
            content:
              "You improve software delivery tasks for an AI development agency. Return structured JSON only."
          },
          {
            role: "user",
            content: buildPrompt(input.originalPayload)
          }
        ],
        max_output_tokens: input.env.OPENAI_MAX_OUTPUT_TOKENS,
        text: {
          format: {
            type: "json_schema",
            name: "agentboard_task_improvement",
            description: "Delivery-ready AI task improvement suggestion.",
            strict: true,
            schema: aiResponseJsonSchema
          }
        }
      }),
      signal: controller.signal
    });

    const responsePayload = (await response.json().catch(() => ({}))) as unknown;

    if (!response.ok) {
      const status = response.status;

      if (status === 429) {
        throw rateLimited("AI rate or quota limit was reached.");
      }

      throw aiUnavailable("AI improvement failed. Your task was not changed.", {
        status
      });
    }

    const outputText = extractOutputText(responsePayload);

    if (!outputText) {
      throw aiUnavailable("AI returned an empty response.");
    }

    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(outputText);
    } catch {
      throw aiUnavailable("AI returned invalid JSON.");
    }

    const parsedSuggestion = aiTaskImprovementSchema.safeParse(parsedJson);

    if (!parsedSuggestion.success) {
      throw aiUnavailable("AI response did not match the expected structure.", {
        issues: parsedSuggestion.error.flatten()
      });
    }

    return {
      ...parsedSuggestion.data,
      acceptanceCriteria: trimList(parsedSuggestion.data.acceptanceCriteria, 8),
      suggestedChecklistItems: trimList(parsedSuggestion.data.suggestedChecklistItems, 8),
      riskNotes: trimList(parsedSuggestion.data.riskNotes, 5)
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw aiUnavailable("AI improvement timed out. Your task was not changed.");
    }

    throw aiUnavailable("AI improvement failed. Your task was not changed.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function improveTaskWithAi(input: {
  db: DatabaseClient;
  env: ApiEnv;
  userId: string;
  taskId: string;
}) {
  assertAiEnabled(input.env);

  const [taskRow] = await input.db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, input.taskId), isNull(tasks.archivedAt)))
    .limit(1);

  if (!taskRow) {
    throw notFound("Task was not found.");
  }

  await assertWorkspaceMember(input.db, input.userId, taskRow.workspaceId);

  const [column] = await input.db
    .select()
    .from(boardColumns)
    .where(
      and(
        eq(boardColumns.id, taskRow.columnId),
        eq(boardColumns.boardId, taskRow.boardId),
        eq(boardColumns.workspaceId, taskRow.workspaceId),
        eq(boardColumns.isArchived, false)
      )
    )
    .limit(1);

  if (!column) {
    throw notFound("Task column was not found.");
  }

  const task = await getTaskDetail(input.db, input.userId, input.taskId);

  if (!task.title.trim()) {
    throw validationError("This task needs at least a title before AI can improve it.");
  }

  const originalPayload = buildOriginalPayload({ task, column });
  const suggestedPayload = await callOpenAi({
    env: input.env,
    originalPayload
  });

  const [suggestion] = await input.db.transaction(async (tx) => {
    const [createdSuggestion] = await tx
      .insert(aiSuggestions)
      .values({
        workspaceId: taskRow.workspaceId,
        taskId: taskRow.id,
        createdBy: input.userId,
        model: input.env.OPENAI_MODEL,
        status: "pending",
        originalPayload,
        suggestedPayload,
        updatedAt: new Date()
      })
      .returning();

    if (!createdSuggestion) {
      throw new Error("Expected AI suggestion to be returned.");
    }

    await insertActivity({
      db: tx,
      workspaceId: taskRow.workspaceId,
      taskId: taskRow.id,
      actorId: input.userId,
      type: "ai.suggestion_created",
      message: "AI suggested improvements for this task.",
      metadata: { suggestionId: createdSuggestion.id, model: input.env.OPENAI_MODEL }
    });

    return [createdSuggestion];
  });

  return mapSuggestion(suggestion);
}

function buildAppliedDescription(input: {
  suggestedPayload: AiTaskImprovement;
  applyDescription: boolean;
  applyAcceptanceCriteria: boolean;
}) {
  const parts: string[] = [];

  if (input.applyDescription) {
    parts.push(input.suggestedPayload.improvedDescription);
  }

  if (input.applyAcceptanceCriteria && input.suggestedPayload.acceptanceCriteria.length > 0) {
    parts.push(
      [
        "Acceptance criteria:",
        ...input.suggestedPayload.acceptanceCriteria.map((item) => `- ${item}`)
      ].join("\n")
    );
  }

  if (input.suggestedPayload.riskNotes.length > 0) {
    parts.push(
      ["Risk notes:", ...input.suggestedPayload.riskNotes.map((item) => `- ${item}`)].join("\n")
    );
  }

  return parts.join("\n\n");
}

function mergeSuggestedPayload(
  existing: AiTaskImprovement,
  body: ApplyAiSuggestionRequest
): AiTaskImprovement {
  return aiTaskImprovementSchema.parse({
    improvedTitle: body.improvedTitle ?? existing.improvedTitle,
    improvedDescription: body.improvedDescription ?? existing.improvedDescription,
    acceptanceCriteria: body.acceptanceCriteria ?? existing.acceptanceCriteria,
    suggestedChecklistItems: body.suggestedChecklistItems ?? existing.suggestedChecklistItems,
    riskNotes: body.riskNotes ?? existing.riskNotes,
    recommendedPriority: body.recommendedPriority ?? existing.recommendedPriority
  });
}

export async function applyAiSuggestion(input: {
  db: DatabaseClient;
  userId: string;
  suggestionId: string;
  body: ApplyAiSuggestionRequest;
}) {
  const result = await input.db.transaction(async (tx) => {
    const [suggestion] = await tx
      .select()
      .from(aiSuggestions)
      .where(eq(aiSuggestions.id, input.suggestionId))
      .limit(1);

    if (!suggestion) {
      throw notFound("AI suggestion was not found.");
    }

    if (suggestion.status !== "pending") {
      throw conflict("AI suggestion has already been reviewed.");
    }

    await assertWorkspaceMember(tx, input.userId, suggestion.workspaceId);

    const [task] = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, suggestion.taskId), isNull(tasks.archivedAt)))
      .limit(1);

    if (!task || task.workspaceId !== suggestion.workspaceId) {
      throw notFound("Task was not found.");
    }

    const suggestedPayload = mergeSuggestedPayload(
      aiTaskImprovementSchema.parse(suggestion.suggestedPayload),
      input.body
    );
    const taskUpdates: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };

    if (input.body.applyTitle) {
      taskUpdates.title = suggestedPayload.improvedTitle;
    }

    if (input.body.applyDescription || input.body.applyAcceptanceCriteria) {
      taskUpdates.description = buildAppliedDescription({
        suggestedPayload,
        applyDescription: input.body.applyDescription,
        applyAcceptanceCriteria: input.body.applyAcceptanceCriteria
      });
    }

    if (input.body.applyPriority) {
      taskUpdates.priority = suggestedPayload.recommendedPriority as TaskPriority;
    }

    await tx.update(tasks).set(taskUpdates).where(eq(tasks.id, task.id));

    if (input.body.applyChecklistItems && suggestedPayload.suggestedChecklistItems.length > 0) {
      const [positionRow] = await tx
        .select({ maxPosition: sql<number | null>`max(${taskChecklistItems.position})` })
        .from(taskChecklistItems)
        .where(eq(taskChecklistItems.taskId, task.id));
      const maxPosition = positionRow?.maxPosition ?? 0;

      await tx.insert(taskChecklistItems).values(
        suggestedPayload.suggestedChecklistItems.map((title, index) => ({
          workspaceId: task.workspaceId,
          taskId: task.id,
          title,
          position: maxPosition + (index + 1) * 1000,
          updatedAt: new Date()
        }))
      );
    }

    const fullyApplied =
      input.body.applyTitle &&
      input.body.applyDescription &&
      input.body.applyPriority &&
      input.body.applyAcceptanceCriteria &&
      input.body.applyChecklistItems;
    const [updatedSuggestion] = await tx
      .update(aiSuggestions)
      .set({
        status: fullyApplied ? "accepted" : "partially_applied",
        suggestedPayload,
        updatedAt: new Date(),
        appliedAt: new Date()
      })
      .where(eq(aiSuggestions.id, suggestion.id))
      .returning();

    if (!updatedSuggestion) {
      throw new Error("Expected updated AI suggestion to be returned.");
    }

    await tx
      .update(boards)
      .set({ version: sql`${boards.version} + 1`, updatedAt: new Date() })
      .where(eq(boards.id, task.boardId));

    await insertActivity({
      db: tx,
      workspaceId: task.workspaceId,
      taskId: task.id,
      actorId: input.userId,
      type: "ai.suggestion_applied",
      message: "AI suggestion applied.",
      metadata: { suggestionId: suggestion.id, status: updatedSuggestion.status }
    });

    return {
      suggestion: updatedSuggestion,
      taskId: task.id,
      boardId: task.boardId
    };
  });

  return {
    suggestion: mapSuggestion(result.suggestion),
    task: await getTaskDetail(input.db, input.userId, result.taskId),
    board: await getBoardSnapshot(input.db, input.userId, result.boardId)
  };
}

export async function rejectAiSuggestion(input: {
  db: DatabaseClient;
  userId: string;
  suggestionId: string;
}) {
  const updated = await input.db.transaction(async (tx) => {
    const [suggestion] = await tx
      .select()
      .from(aiSuggestions)
      .where(eq(aiSuggestions.id, input.suggestionId))
      .limit(1);

    if (!suggestion) {
      throw notFound("AI suggestion was not found.");
    }

    if (suggestion.status !== "pending") {
      throw conflict("AI suggestion has already been reviewed.");
    }

    await assertWorkspaceMember(tx, input.userId, suggestion.workspaceId);

    const [updatedSuggestion] = await tx
      .update(aiSuggestions)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(aiSuggestions.id, suggestion.id))
      .returning();

    if (!updatedSuggestion) {
      throw new Error("Expected updated AI suggestion to be returned.");
    }

    await insertActivity({
      db: tx,
      workspaceId: suggestion.workspaceId,
      taskId: suggestion.taskId,
      actorId: input.userId,
      type: "ai.suggestion_rejected",
      message: "AI suggestion rejected.",
      metadata: { suggestionId: suggestion.id }
    });

    return updatedSuggestion;
  });

  return mapSuggestion(updated);
}
