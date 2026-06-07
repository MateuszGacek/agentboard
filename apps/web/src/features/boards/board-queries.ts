import type {
  AiNextActionsRequest,
  AiNextActionSuggestion,
  ApplyAiSuggestionRequest,
  BoardSnapshot,
  BoardTaskCard,
  CreateChecklistItemRequest,
  CreateCommentRequest,
  CreateTaskRequest,
  MoveTaskRequest,
  UpdateBoardColumnRequest,
  UpdateChecklistItemRequest,
  UpdateCommentRequest,
  UpdateTaskRequest
} from "@agentboard/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { boardApi, taskApi } from "../../lib/api-client";

export const boardQueryKey = (boardId: string) => ["board", boardId] as const;
export const taskDetailQueryKey = (taskId: string | null) => ["task", taskId] as const;
export const aiSuggestionsQueryKey = (taskId: string | null) =>
  ["task-ai-suggestions", taskId] as const;

export function useBoard(boardId: string) {
  return useQuery({
    queryKey: boardQueryKey(boardId),
    queryFn: ({ signal }) => boardApi.getBoard(boardId, signal)
  });
}

export function useTaskDetail(taskId: string | null) {
  return useQuery({
    queryKey: taskDetailQueryKey(taskId),
    queryFn: ({ signal }) => {
      if (!taskId) {
        throw new Error("Task ID is required.");
      }

      return taskApi.getTask(taskId, signal);
    },
    enabled: Boolean(taskId)
  });
}

export function useTaskAiSuggestions(taskId: string | null) {
  return useQuery({
    queryKey: aiSuggestionsQueryKey(taskId),
    queryFn: ({ signal }) => {
      if (!taskId) {
        throw new Error("Task ID is required.");
      }

      return taskApi.listAiSuggestions(taskId, signal);
    },
    enabled: Boolean(taskId)
  });
}

export function useUpdateBoardColumnMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ columnId, body }: { columnId: string; body: UpdateBoardColumnRequest }) =>
      boardApi.updateColumn(columnId, body),
    onSuccess: ({ board }) => {
      queryClient.setQueryData(boardQueryKey(boardId), board);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
    }
  });
}

export function useCreateTaskMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTaskRequest) => taskApi.createTask(body),
    onSuccess: ({ board }) => {
      queryClient.setQueryData(boardQueryKey(boardId), board);
    }
  });
}

export function useSuggestBoardNextActionsMutation(boardId: string) {
  return useMutation({
    mutationFn: (body: AiNextActionsRequest) => boardApi.suggestNextActions(boardId, body)
  });
}

export function useCreateTaskFromAiSuggestionMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      board,
      suggestion
    }: {
      board: BoardSnapshot;
      suggestion: AiNextActionSuggestion;
    }) => {
      const targetColumn =
        board.columns.find((column) => column.systemKey === suggestion.targetColumnSystemKey) ??
        board.columns[0];

      if (!targetColumn) {
        throw new Error("Board must have at least one column.");
      }

      const created = await taskApi.createTask({
        boardId: board.id,
        columnId: targetColumn.id,
        title: suggestion.title,
        description: [
          suggestion.description,
          suggestion.acceptanceCriteria.length > 0
            ? `\nAcceptance criteria:\n${suggestion.acceptanceCriteria.map((item) => `- ${item}`).join("\n")}`
            : "",
          suggestion.riskNotes.length > 0
            ? `\nRisk notes:\n${suggestion.riskNotes.map((item) => `- ${item}`).join("\n")}`
            : ""
        ]
          .join("")
          .trim(),
        priority: suggestion.priority,
        dueDate: null,
        assigneeIds: [],
        labelIds: []
      });

      let result = created;

      for (const title of suggestion.checklistItems) {
        result = await taskApi.createChecklistItem(created.task.id, { title });
      }

      return result;
    },
    onSuccess: ({ board, task }) => {
      queryClient.setQueryData(boardQueryKey(boardId), board);
      queryClient.setQueryData(taskDetailQueryKey(task.id), task);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
    }
  });
}

export function useUpdateTaskMutation(boardId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateTaskRequest) => taskApi.updateTask(taskId, body),
    onSuccess: ({ board, task }) => {
      queryClient.setQueryData(taskDetailQueryKey(taskId), task);

      if (board) {
        queryClient.setQueryData(boardQueryKey(boardId), board);
      }
    }
  });
}

function updateTaskDetailCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  boardId: string,
  taskId: string,
  result: { task: import("@agentboard/shared").TaskDetail; board?: BoardSnapshot }
) {
  queryClient.setQueryData(taskDetailQueryKey(taskId), result.task);

  if (result.board) {
    queryClient.setQueryData(boardQueryKey(boardId), result.board);
  }
}

export function useCreateChecklistItemMutation(boardId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateChecklistItemRequest) => taskApi.createChecklistItem(taskId, body),
    onSuccess: (result) => updateTaskDetailCaches(queryClient, boardId, taskId, result),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(taskId) });
    }
  });
}

export function useUpdateChecklistItemMutation(boardId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: UpdateChecklistItemRequest }) =>
      taskApi.updateChecklistItem(itemId, body),
    onSuccess: (result) => updateTaskDetailCaches(queryClient, boardId, taskId, result),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(taskId) });
    }
  });
}

export function useDeleteChecklistItemMutation(boardId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => taskApi.deleteChecklistItem(itemId),
    onSuccess: (result) => updateTaskDetailCaches(queryClient, boardId, taskId, result),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(taskId) });
    }
  });
}

export function useCreateCommentMutation(boardId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateCommentRequest) => taskApi.createComment(taskId, body),
    onSuccess: (result) => updateTaskDetailCaches(queryClient, boardId, taskId, result),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(taskId) });
    }
  });
}

export function useUpdateCommentMutation(boardId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: UpdateCommentRequest }) =>
      taskApi.updateComment(commentId, body),
    onSuccess: (result) => updateTaskDetailCaches(queryClient, boardId, taskId, result),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(taskId) });
    }
  });
}

export function useDeleteCommentMutation(boardId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => taskApi.deleteComment(commentId),
    onSuccess: (result) => updateTaskDetailCaches(queryClient, boardId, taskId, result),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(taskId) });
    }
  });
}

export function useImproveTaskWithAiMutation(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => taskApi.improveWithAi(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiSuggestionsQueryKey(taskId) });
    }
  });
}

export function useApplyAiSuggestionMutation(boardId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      suggestionId,
      body
    }: {
      suggestionId: string;
      body: ApplyAiSuggestionRequest;
    }) => taskApi.applyAiSuggestion(suggestionId, body),
    onSuccess: (result) => {
      updateTaskDetailCaches(queryClient, boardId, taskId, result);
      void queryClient.invalidateQueries({ queryKey: aiSuggestionsQueryKey(taskId) });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(taskId) });
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
    }
  });
}

export function useRejectAiSuggestionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (suggestionId: string) => taskApi.rejectAiSuggestion(suggestionId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: aiSuggestionsQueryKey(result.suggestion.taskId)
      });
    }
  });
}

export function useDeleteTaskMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => taskApi.deleteTask(taskId),
    onSuccess: ({ board }, taskId) => {
      queryClient.setQueryData(boardQueryKey(boardId), board);
      queryClient.removeQueries({ queryKey: taskDetailQueryKey(taskId) });
    }
  });
}

function reorderBoardSnapshot(
  board: BoardSnapshot,
  taskId: string,
  targetColumnId: string,
  targetIndex: number
): BoardSnapshot {
  const sourceColumn = board.columns.find((column) =>
    (board.tasksByColumn[column.id] ?? []).some((task) => task.id === taskId)
  );

  if (!sourceColumn) {
    return board;
  }

  const sourceTasks = [...(board.tasksByColumn[sourceColumn.id] ?? [])];
  const task = sourceTasks.find((candidate) => candidate.id === taskId);

  if (!task) {
    return board;
  }

  const nextTasksByColumn: BoardSnapshot["tasksByColumn"] = {
    ...board.tasksByColumn,
    [sourceColumn.id]: sourceTasks.filter((candidate) => candidate.id !== taskId)
  };
  const targetTasks = [...(nextTasksByColumn[targetColumnId] ?? [])];
  const clampedIndex = Math.min(targetIndex, targetTasks.length);
  targetTasks.splice(clampedIndex, 0, { ...task, columnId: targetColumnId });
  nextTasksByColumn[targetColumnId] = targetTasks;

  const nextColumns = board.columns.map((column) => {
    const tasksInColumn = nextTasksByColumn[column.id] ?? [];
    const wipCount = tasksInColumn.filter((card) => card.completedAt === null).length;
    const wipLimit = column.wipLimit;

    return {
      ...column,
      taskCount: tasksInColumn.length,
      wip: {
        limit: wipLimit,
        count: wipCount,
        exceeded: wipLimit !== null && wipCount > wipLimit
      }
    };
  });

  return {
    ...board,
    columns: nextColumns,
    tasksByColumn: nextTasksByColumn
  };
}

export function useMoveTaskMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, body }: { taskId: string; body: MoveTaskRequest }) =>
      taskApi.moveTask(taskId, body),
    onMutate: async ({ taskId, body }) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey(boardId) });
      const previousBoard = queryClient.getQueryData<BoardSnapshot>(boardQueryKey(boardId));

      if (previousBoard) {
        queryClient.setQueryData(
          boardQueryKey(boardId),
          reorderBoardSnapshot(previousBoard, taskId, body.targetColumnId, body.targetIndex)
        );
      }

      return { previousBoard };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(boardQueryKey(boardId), context.previousBoard);
      }
    },
    onSuccess: ({ board }) => {
      queryClient.setQueryData(boardQueryKey(boardId), board);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
    }
  });
}

export function findTaskInBoard(board: BoardSnapshot, taskId: string): BoardTaskCard | null {
  for (const column of board.columns) {
    const task = board.tasksByColumn[column.id]?.find((candidate) => candidate.id === taskId);

    if (task) {
      return task;
    }
  }

  return null;
}
