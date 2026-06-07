import type {
  ApiError,
  ApiSuccess,
  AiNextActionsRequest,
  AiNextActionsResponseData,
  AiSuggestionsResponseData,
  ApplyAiSuggestionRequest,
  ApplyAiSuggestionResponseData,
  BoardSnapshot,
  ChecklistResponseData,
  CommentResponseData,
  CreateChecklistItemRequest,
  CreateCommentRequest,
  CreateProjectRequest,
  CreateProjectResponseData,
  CreateTaskRequest,
  CreateTaskResponseData,
  DashboardMetrics,
  DeleteChecklistItemResponseData,
  DeleteCommentResponseData,
  DeleteTaskResponseData,
  DemoLoginRequest,
  DemoLoginResponseData,
  ImproveTaskWithAiResponseData,
  LoginRequest,
  LogoutResponseData,
  MoveTaskRequest,
  MoveTaskResponseData,
  ProjectsResponseData,
  ProjectTemplatesResponseData,
  RegisterRequest,
  RejectAiSuggestionResponseData,
  SessionResponse,
  TaskDetail,
  UpdateBoardColumnRequest,
  UpdateBoardColumnResponseData,
  UpdateChecklistItemRequest,
  UpdateCommentRequest,
  UpdateProjectRequest,
  UpdateProjectResponseData,
  UpdateTaskRequest,
  UpdateTaskResponseData,
  WeeklyReportResponse
} from "@agentboard/shared";

export class ApiClientError extends Error {
  readonly code: ApiError["error"]["code"];
  readonly requestId: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, payload: ApiError) {
    super(payload.error.message);
    this.name = "ApiClientError";
    this.code = payload.error.code;
    this.requestId = payload.error.requestId;
    this.status = status;
    this.details = payload.error.details;
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "object"
  );
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  return JSON.parse(text) as unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const requestInit: RequestInit = {
    method: options.method ?? "GET",
    credentials: "include"
  };

  if (options.body !== undefined) {
    requestInit.headers = { "content-type": "application/json" };
    requestInit.body = JSON.stringify(options.body);
  }

  if (options.signal) {
    requestInit.signal = options.signal;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, requestInit);
  const payload = await readJson(response);

  if (!response.ok) {
    if (isApiError(payload)) {
      throw new ApiClientError(response.status, payload);
    }

    throw new ApiClientError(response.status, {
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected API error.",
        requestId: "unknown"
      }
    });
  }

  return (payload as ApiSuccess<T>).data;
}

export const authApi = {
  me: (signal?: AbortSignal) =>
    apiRequest<SessionResponse>("/api/auth/me", signal ? { signal } : undefined),
  login: (body: LoginRequest) =>
    apiRequest<SessionResponse>("/api/auth/login", { method: "POST", body }),
  register: (body: RegisterRequest) =>
    apiRequest<SessionResponse>("/api/auth/register", { method: "POST", body }),
  demo: (body: DemoLoginRequest = {}) =>
    apiRequest<DemoLoginResponseData>("/api/auth/demo", { method: "POST", body }),
  logout: () => apiRequest<LogoutResponseData>("/api/auth/logout", { method: "POST" })
};

export const boardApi = {
  getBoard: (boardId: string, signal?: AbortSignal) =>
    apiRequest<BoardSnapshot>(`/api/boards/${boardId}`, signal ? { signal } : undefined),
  suggestNextActions: (boardId: string, body: AiNextActionsRequest) =>
    apiRequest<AiNextActionsResponseData>(`/api/boards/${boardId}/ai/next-actions`, {
      method: "POST",
      body
    }),
  updateColumn: (columnId: string, body: UpdateBoardColumnRequest) =>
    apiRequest<UpdateBoardColumnResponseData>(`/api/board-columns/${columnId}`, {
      method: "PATCH",
      body
    })
};

export const dashboardApi = {
  getDashboard: (workspaceId: string, projectId?: string | null, signal?: AbortSignal) => {
    const params = new URLSearchParams();

    if (projectId) {
      params.set("projectId", projectId);
    }

    const query = params.toString();
    const path = `/api/workspaces/${workspaceId}/dashboard${query ? `?${query}` : ""}`;

    return apiRequest<DashboardMetrics>(path, signal ? { signal } : undefined);
  },
  getWeeklyReport: (
    workspaceId: string,
    projectId?: string | null,
    weekStart?: string | null,
    signal?: AbortSignal
  ) => {
    const params = new URLSearchParams();

    if (projectId) {
      params.set("projectId", projectId);
    }

    if (weekStart) {
      params.set("weekStart", weekStart);
    }

    const query = params.toString();
    const path = `/api/workspaces/${workspaceId}/reports/weekly${query ? `?${query}` : ""}`;

    return apiRequest<WeeklyReportResponse>(path, signal ? { signal } : undefined);
  }
};

export const projectApi = {
  listTemplates: (signal?: AbortSignal) =>
    apiRequest<ProjectTemplatesResponseData>(
      "/api/project-templates",
      signal ? { signal } : undefined
    ),
  listProjects: (workspaceId: string, signal?: AbortSignal) =>
    apiRequest<ProjectsResponseData>(
      `/api/workspaces/${workspaceId}/projects`,
      signal ? { signal } : undefined
    ),
  createProject: (workspaceId: string, body: CreateProjectRequest) =>
    apiRequest<CreateProjectResponseData>(`/api/workspaces/${workspaceId}/projects`, {
      method: "POST",
      body
    }),
  updateProject: (projectId: string, body: UpdateProjectRequest) =>
    apiRequest<UpdateProjectResponseData>(`/api/projects/${projectId}`, {
      method: "PATCH",
      body
    })
};

export const taskApi = {
  getTask: (taskId: string, signal?: AbortSignal) =>
    apiRequest<TaskDetail>(`/api/tasks/${taskId}`, signal ? { signal } : undefined),
  createTask: (body: CreateTaskRequest) =>
    apiRequest<CreateTaskResponseData>("/api/tasks", { method: "POST", body }),
  updateTask: (taskId: string, body: UpdateTaskRequest) =>
    apiRequest<UpdateTaskResponseData>(`/api/tasks/${taskId}`, { method: "PATCH", body }),
  createChecklistItem: (taskId: string, body: CreateChecklistItemRequest) =>
    apiRequest<ChecklistResponseData>(`/api/tasks/${taskId}/checklist-items`, {
      method: "POST",
      body
    }),
  updateChecklistItem: (itemId: string, body: UpdateChecklistItemRequest) =>
    apiRequest<ChecklistResponseData>(`/api/tasks/checklist-items/${itemId}`, {
      method: "PATCH",
      body
    }),
  deleteChecklistItem: (itemId: string) =>
    apiRequest<DeleteChecklistItemResponseData>(`/api/tasks/checklist-items/${itemId}`, {
      method: "DELETE"
    }),
  createComment: (taskId: string, body: CreateCommentRequest) =>
    apiRequest<CommentResponseData>(`/api/tasks/${taskId}/comments`, { method: "POST", body }),
  updateComment: (commentId: string, body: UpdateCommentRequest) =>
    apiRequest<CommentResponseData>(`/api/tasks/comments/${commentId}`, {
      method: "PATCH",
      body
    }),
  deleteComment: (commentId: string) =>
    apiRequest<DeleteCommentResponseData>(`/api/tasks/comments/${commentId}`, {
      method: "DELETE"
    }),
  deleteTask: (taskId: string) =>
    apiRequest<DeleteTaskResponseData>(`/api/tasks/${taskId}`, { method: "DELETE" }),
  moveTask: (taskId: string, body: MoveTaskRequest) =>
    apiRequest<MoveTaskResponseData>(`/api/tasks/${taskId}/move`, { method: "POST", body }),
  improveWithAi: (taskId: string) =>
    apiRequest<ImproveTaskWithAiResponseData>(`/api/tasks/${taskId}/ai/improve`, {
      method: "POST"
    }),
  listAiSuggestions: (taskId: string, signal?: AbortSignal) =>
    apiRequest<AiSuggestionsResponseData>(
      `/api/tasks/${taskId}/ai-suggestions`,
      signal ? { signal } : undefined
    ),
  applyAiSuggestion: (suggestionId: string, body: ApplyAiSuggestionRequest) =>
    apiRequest<ApplyAiSuggestionResponseData>(`/api/ai-suggestions/${suggestionId}/apply`, {
      method: "POST",
      body
    }),
  rejectAiSuggestion: (suggestionId: string) =>
    apiRequest<RejectAiSuggestionResponseData>(`/api/ai-suggestions/${suggestionId}/reject`, {
      method: "POST"
    })
};
