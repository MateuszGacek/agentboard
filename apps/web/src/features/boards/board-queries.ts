import type {
  ApplyAiSuggestionRequest,
  BoardSnapshot,
  BoardTaskCard,
  CreateChecklistItemRequest,
  CreateCommentRequest,
  CreateTaskRequest,
  MoveTaskRequest,
  UpdateChecklistItemRequest,
  UpdateTaskRequest
} from "@agentboard/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { boardApi, taskApi } from "../../lib/api-client";

export const boardQueryKey = (boardId: string) => ["board", boardId] as const;
export const taskDetailQueryKey = (taskId: string | null) => ["task", taskId] as const;

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

export function useCreateTaskMutation(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTaskRequest) => taskApi.createTask(body),
    onSuccess: ({ board }) => {
      queryClient.setQueryData(boardQueryKey(boardId), board);
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

export function useImproveTaskWithAiMutation(taskId: string) {
  return useMutation({
    mutationFn: () => taskApi.improveWithAi(taskId)
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
    onSuccess: (result) => updateTaskDetailCaches(queryClient, boardId, taskId, result),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(taskId) });
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
    }
  });
}

export function useRejectAiSuggestionMutation() {
  return useMutation({
    mutationFn: (suggestionId: string) => taskApi.rejectAiSuggestion(suggestionId)
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
