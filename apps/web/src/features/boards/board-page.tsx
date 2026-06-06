import type {
  AiSuggestion,
  BoardColumn,
  BoardSnapshot,
  BoardTaskCard,
  TaskDetail,
  TaskPriority
} from "@agentboard/shared";
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Circle,
  GripVertical,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  UserRound,
  X
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../../components/ui/button";
import { InlineAlert } from "../../components/ui/inline-alert";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { Textarea } from "../../components/ui/textarea";
import { getUserFacingApiError } from "../../lib/api-errors";
import { cn } from "../../lib/utils";
import {
  findTaskInBoard,
  useApplyAiSuggestionMutation,
  useBoard,
  useCreateChecklistItemMutation,
  useCreateCommentMutation,
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useImproveTaskWithAiMutation,
  useMoveTaskMutation,
  useRejectAiSuggestionMutation,
  useTaskDetail,
  useUpdateChecklistItemMutation,
  useUpdateTaskMutation
} from "./board-queries";

type BoardPageProps = {
  boardId: string;
};

type TaskFormState = {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  isBlocked: boolean;
  blockedReason: string;
};

type BoardBlockedFilter = "all" | "blocked" | "open";
type BoardDueFilter = "all" | "overdue" | "today" | "week" | "none";

type BoardFiltersState = {
  q: string;
  priority: "all" | TaskPriority;
  blocked: BoardBlockedFilter;
  assigneeId: string;
  labelId: string;
  due: BoardDueFilter;
};

const priorityValues: TaskPriority[] = ["low", "medium", "high", "urgent"];
const blockedFilterValues: BoardBlockedFilter[] = ["all", "blocked", "open"];
const dueFilterValues: BoardDueFilter[] = ["all", "overdue", "today", "week", "none"];

const defaultBoardFilters: BoardFiltersState = {
  q: "",
  priority: "all",
  blocked: "all",
  assigneeId: "all",
  labelId: "all",
  due: "all"
};

const taskPriorityTone: Record<TaskPriority, string> = {
  low: "border-border bg-muted/40 text-muted-foreground",
  medium: "border-border bg-secondary text-secondary-foreground",
  high: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  urgent: "border-destructive/25 bg-destructive/10 text-destructive"
};

const initialTaskForm: TaskFormState = {
  title: "",
  description: "",
  priority: "medium",
  dueDate: "",
  isBlocked: false,
  blockedReason: ""
};

function getTaskLocation(board: BoardSnapshot, taskId: string) {
  for (const column of board.columns) {
    const tasks = board.tasksByColumn[column.id] ?? [];
    const taskIndex = tasks.findIndex((task) => task.id === taskId);

    if (taskIndex >= 0) {
      return { column, tasks, taskIndex };
    }
  }

  return null;
}

function getTargetFromDrag(board: BoardSnapshot, activeTaskId: string, overId: string) {
  const overColumn = board.columns.find((column) => column.id === overId);

  if (overColumn) {
    return {
      targetColumnId: overColumn.id,
      targetIndex: board.tasksByColumn[overColumn.id]?.length ?? 0
    };
  }

  const overTask = findTaskInBoard(board, overId);

  if (!overTask) {
    return null;
  }

  const targetTasks = board.tasksByColumn[overTask.columnId] ?? [];
  const overIndex = targetTasks.findIndex((task) => task.id === overTask.id);

  if (overIndex < 0 || overTask.id === activeTaskId) {
    return null;
  }

  return {
    targetColumnId: overTask.columnId,
    targetIndex: overIndex
  };
}

function formatDueDate(value: string | null, locale: string) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
}

function formatTimestamp(value: string | null, locale: string) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

function isTaskPriority(value: string | null): value is TaskPriority {
  return priorityValues.includes(value as TaskPriority);
}

function isBlockedFilter(value: string | null): value is BoardBlockedFilter {
  return blockedFilterValues.includes(value as BoardBlockedFilter);
}

function isDueFilter(value: string | null): value is BoardDueFilter {
  return dueFilterValues.includes(value as BoardDueFilter);
}

function readBoardFiltersFromUrl(): BoardFiltersState {
  if (typeof window === "undefined") {
    return defaultBoardFilters;
  }

  const params = new URLSearchParams(window.location.search);
  const priority = params.get("priority");
  const blocked = params.get("blocked");
  const due = params.get("due");

  return {
    q: params.get("q") ?? "",
    priority: isTaskPriority(priority) ? priority : "all",
    blocked: isBlockedFilter(blocked) ? blocked : "all",
    assigneeId: params.get("assignee") ?? "all",
    labelId: params.get("label") ?? "all",
    due: isDueFilter(due) ? due : "all"
  };
}

function writeBoardFiltersToUrl(filters: BoardFiltersState) {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const entries: Array<[keyof BoardFiltersState, string]> = [
    ["q", "q"],
    ["priority", "priority"],
    ["blocked", "blocked"],
    ["assigneeId", "assignee"],
    ["labelId", "label"],
    ["due", "due"]
  ];

  entries.forEach(([key, param]) => {
    const value = filters[key].trim();

    if (value && value !== "all") {
      params.set(param, value);
    } else {
      params.delete(param);
    }
  });

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState(null, "", nextUrl);
}

function hasActiveBoardFilters(filters: BoardFiltersState) {
  return (
    filters.q.trim() !== "" ||
    filters.priority !== "all" ||
    filters.blocked !== "all" ||
    filters.assigneeId !== "all" ||
    filters.labelId !== "all" ||
    filters.due !== "all"
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function matchesDueFilter(task: BoardTaskCard, due: BoardDueFilter) {
  if (due === "all") {
    return true;
  }

  if (due === "none") {
    return task.dueDate === null;
  }

  if (!task.dueDate) {
    return false;
  }

  const today = toDateKey(new Date());
  const weekEnd = toDateKey(addDays(new Date(), 7));

  if (due === "overdue") {
    return task.completedAt === null && task.dueDate < today;
  }

  if (due === "today") {
    return task.dueDate === today;
  }

  return task.dueDate >= today && task.dueDate <= weekEnd;
}

function filterBoardTask(task: BoardTaskCard, filters: BoardFiltersState) {
  const query = filters.q.trim().toLowerCase();

  if (query && !`${task.title} ${task.descriptionPreview ?? ""}`.toLowerCase().includes(query)) {
    return false;
  }

  if (filters.priority !== "all" && task.priority !== filters.priority) {
    return false;
  }

  if (filters.blocked === "blocked" && !task.isBlocked) {
    return false;
  }

  if (filters.blocked === "open" && task.isBlocked) {
    return false;
  }

  if (
    filters.assigneeId !== "all" &&
    !task.assignees.some((assignee) => assignee.id === filters.assigneeId)
  ) {
    return false;
  }

  if (filters.labelId !== "all" && !task.labels.some((label) => label.id === filters.labelId)) {
    return false;
  }

  return matchesDueFilter(task, filters.due);
}

function getFilteredTasksByColumn(board: BoardSnapshot, filters: BoardFiltersState) {
  return Object.fromEntries(
    board.columns.map((column) => [
      column.id,
      (board.tasksByColumn[column.id] ?? []).filter((task) => filterBoardTask(task, filters))
    ])
  ) as BoardSnapshot["tasksByColumn"];
}

function useDismissedTip(tipId: string) {
  const storageKey = `agentboard.tip.${tipId}`;
  const [dismissed, setDismissed] = React.useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(storageKey) === "dismissed";
  });

  const dismiss = React.useCallback(() => {
    setDismissed(true);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, "dismissed");
    }
  }, [storageKey]);

  return { dismissed, dismiss };
}

function DetailSection({
  title,
  children,
  actions
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-md border border-border bg-background p-3">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {actions}
      </header>
      {children}
    </section>
  );
}

function EmptyDetailState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function BoardFilterBar({
  board,
  filters,
  onChange,
  onReset,
  resultCount,
  totalCount,
  searchInputRef
}: {
  board: BoardSnapshot;
  filters: BoardFiltersState;
  onChange: (filters: BoardFiltersState) => void;
  onReset: () => void;
  resultCount: number;
  totalCount: number;
  searchInputRef: React.RefObject<HTMLInputElement>;
}) {
  const { t } = useTranslation();
  const hasFilters = hasActiveBoardFilters(filters);

  return (
    <section
      aria-label={t("board.filters.title")}
      className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="board-search">{t("board.filters.search")}</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              id="board-search"
              onChange={(event) => onChange({ ...filters, q: event.target.value })}
              placeholder={t("board.filters.searchPlaceholder")}
              ref={searchInputRef}
              value={filters.q}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="board-priority-filter">{t("board.filters.priority")}</Label>
            <Select
              id="board-priority-filter"
              onChange={(event) =>
                onChange({
                  ...filters,
                  priority:
                    event.target.value === "all" ? "all" : (event.target.value as TaskPriority)
                })
              }
              value={filters.priority}
            >
              <option value="all">{t("board.filters.allPriorities")}</option>
              {priorityValues.map((priority) => (
                <option key={priority} value={priority}>
                  {t(`board.priority.${priority}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="board-blocked-filter">{t("board.filters.blocked")}</Label>
            <Select
              id="board-blocked-filter"
              onChange={(event) =>
                onChange({ ...filters, blocked: event.target.value as BoardBlockedFilter })
              }
              value={filters.blocked}
            >
              {blockedFilterValues.map((blocked) => (
                <option key={blocked} value={blocked}>
                  {t(`board.filters.blockedOptions.${blocked}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="board-assignee-filter">{t("board.filters.assignee")}</Label>
            <Select
              id="board-assignee-filter"
              onChange={(event) => onChange({ ...filters, assigneeId: event.target.value })}
              value={filters.assigneeId}
            >
              <option value="all">{t("board.filters.allAssignees")}</option>
              {board.availableMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="board-label-filter">{t("board.filters.label")}</Label>
            <Select
              id="board-label-filter"
              onChange={(event) => onChange({ ...filters, labelId: event.target.value })}
              value={filters.labelId}
            >
              <option value="all">{t("board.filters.allLabels")}</option>
              {board.availableLabels.map((label) => (
                <option key={label.id} value={label.id}>
                  {label.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="board-due-filter">{t("board.filters.due")}</Label>
            <Select
              id="board-due-filter"
              onChange={(event) =>
                onChange({ ...filters, due: event.target.value as BoardDueFilter })
              }
              value={filters.due}
            >
              {dueFilterValues.map((due) => (
                <option key={due} value={due}>
                  {t(`board.filters.dueOptions.${due}`)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-border pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          {t("board.filters.resultCount", { count: resultCount, total: totalCount })}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span>{t("board.shortcuts.search")}</span>
          <span>{t("board.shortcuts.newTask")}</span>
          {hasFilters ? (
            <Button onClick={onReset} size="sm" type="button" variant="ghost">
              {t("board.filters.reset")}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function BoardTip({
  id,
  title,
  children
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { dismissed, dismiss } = useDismissedTip(id);

  if (dismissed) {
    return null;
  }

  return (
    <article className="rounded-md border border-border bg-background p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{children}</p>
        </div>
        <Button
          aria-label={t("common.dismiss")}
          onClick={dismiss}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}

function BoardTips({ board }: { board: BoardSnapshot }) {
  const { t } = useTranslation();
  const hasWipLimit = board.columns.some((column) => column.wip.limit !== null);

  return (
    <section aria-label={t("board.tips.title")} className="grid gap-3 md:grid-cols-3">
      <BoardTip id={`${board.id}.welcome`} title={t("board.tips.welcome.title")}>
        {t("board.tips.welcome.body")}
      </BoardTip>
      {hasWipLimit ? (
        <BoardTip id={`${board.id}.wip`} title={t("board.tips.wip.title")}>
          {t("board.tips.wip.body")}
        </BoardTip>
      ) : null}
      <BoardTip id={`${board.id}.ai`} title={t("board.tips.ai.title")}>
        {t("board.tips.ai.body")}
      </BoardTip>
    </section>
  );
}

function DialogFrame({
  title,
  children,
  onClose
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = React.useId();

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-auto rounded-lg border border-border bg-card shadow-shell"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="text-base font-semibold" id={titleId}>
            {title}
          </h2>
          <Button
            aria-label={t("common.close")}
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </header>
        {children}
      </section>
    </div>
  );
}

function SheetFrame({
  title,
  children,
  onClose
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = React.useId();

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-foreground/35">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="ml-auto flex h-full w-full flex-col overflow-hidden border-l border-border bg-card shadow-shell sm:max-w-2xl"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="text-base font-semibold" id={titleId}>
            {title}
          </h2>
          <Button
            aria-label={t("common.close")}
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </header>
        {children}
      </section>
    </div>
  );
}

function TaskFields({
  form,
  setForm,
  showBlocked
}: {
  form: TaskFormState;
  setForm: React.Dispatch<React.SetStateAction<TaskFormState>>;
  showBlocked: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="task-title">{t("board.task.title")}</Label>
        <Input
          id="task-title"
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          value={form.title}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-description">{t("board.task.description")}</Label>
        <Textarea
          id="task-description"
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
          value={form.description}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="task-priority">{t("board.task.priority")}</Label>
          <Select
            id="task-priority"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                priority: event.target.value as TaskPriority
              }))
            }
            value={form.priority}
          >
            {priorityValues.map((priority) => (
              <option key={priority} value={priority}>
                {t(`board.priority.${priority}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-due-date">{t("board.task.dueDate")}</Label>
          <Input
            id="task-due-date"
            onChange={(event) =>
              setForm((current) => ({ ...current, dueDate: event.target.value }))
            }
            type="date"
            value={form.dueDate}
          />
        </div>
      </div>
      {showBlocked ? (
        <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              checked={form.isBlocked}
              className="h-4 w-4"
              onChange={(event) =>
                setForm((current) => ({ ...current, isBlocked: event.target.checked }))
              }
              type="checkbox"
            />
            {t("board.task.blocked")}
          </label>
          {form.isBlocked ? (
            <div className="space-y-2">
              <Label htmlFor="task-blocked-reason">{t("board.task.blockedReason")}</Label>
              <Textarea
                id="task-blocked-reason"
                onChange={(event) =>
                  setForm((current) => ({ ...current, blockedReason: event.target.value }))
                }
                value={form.blockedReason}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CreateTaskDialog({
  board,
  column,
  onClose
}: {
  board: BoardSnapshot;
  column: BoardColumn;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = React.useState<TaskFormState>(initialTaskForm);
  const [error, setError] = React.useState<string | null>(null);
  const createTask = useCreateTaskMutation(board.id);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.title.trim()) {
      setError(t("validation.required"));
      return;
    }

    createTask.mutate(
      {
        boardId: board.id,
        columnId: column.id,
        title: form.title,
        description: form.description.trim() ? form.description : null,
        priority: form.priority,
        dueDate: form.dueDate || null,
        assigneeIds: [],
        labelIds: []
      },
      { onSuccess: onClose }
    );
  };

  return (
    <DialogFrame onClose={onClose} title={t("board.create.title")}>
      <form className="space-y-4 p-4" onSubmit={handleSubmit}>
        <p className="text-sm text-muted-foreground">
          {t("board.create.column", { column: column.name })}
        </p>
        <TaskFields form={form} setForm={setForm} showBlocked={false} />
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        {createTask.error ? (
          <InlineAlert>{getUserFacingApiError(createTask.error, t)}</InlineAlert>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">
            {t("common.cancel")}
          </Button>
          <Button disabled={createTask.isPending} type="submit">
            {t("board.create.submit")}
          </Button>
        </div>
      </form>
    </DialogFrame>
  );
}

function TaskDetailSheet({
  board,
  taskId,
  onClose
}: {
  board: BoardSnapshot;
  taskId: string;
  onClose: () => void;
}) {
  const { i18n, t } = useTranslation();
  const task = useTaskDetail(taskId);
  const updateTask = useUpdateTaskMutation(board.id, taskId);
  const deleteTask = useDeleteTaskMutation(board.id);
  const moveTask = useMoveTaskMutation(board.id);
  const createChecklistItem = useCreateChecklistItemMutation(board.id, taskId);
  const updateChecklistItem = useUpdateChecklistItemMutation(board.id, taskId);
  const createComment = useCreateCommentMutation(board.id, taskId);
  const improveWithAi = useImproveTaskWithAiMutation(taskId);
  const applyAiSuggestion = useApplyAiSuggestionMutation(board.id, taskId);
  const rejectAiSuggestion = useRejectAiSuggestionMutation();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [form, setForm] = React.useState<TaskFormState>(initialTaskForm);
  const [checklistTitle, setChecklistTitle] = React.useState("");
  const [commentBody, setCommentBody] = React.useState("");
  const [aiSuggestion, setAiSuggestion] = React.useState<AiSuggestion | null>(null);

  React.useEffect(() => {
    if (task.data) {
      setForm({
        title: task.data.title,
        description: task.data.description ?? "",
        priority: task.data.priority,
        dueDate: toDateInputValue(task.data.dueDate),
        isBlocked: task.data.isBlocked,
        blockedReason: task.data.blockedReason ?? ""
      });
    }
  }, [task.data]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    updateTask.mutate({
      title: form.title,
      description: form.description.trim() ? form.description : null,
      priority: form.priority,
      dueDate: form.dueDate || null,
      isBlocked: form.isBlocked,
      blockedReason: form.isBlocked && form.blockedReason.trim() ? form.blockedReason : null
    });
  };

  const handleAssigneeToggle = (userId: string) => {
    if (!task.data) {
      return;
    }

    const nextAssigneeIds = task.data.assignees.some((assignee) => assignee.id === userId)
      ? task.data.assignees
          .filter((assignee) => assignee.id !== userId)
          .map((assignee) => assignee.id)
      : [...task.data.assignees.map((assignee) => assignee.id), userId];

    updateTask.mutate({ assigneeIds: nextAssigneeIds });
  };

  const handleLabelToggle = (labelId: string) => {
    if (!task.data) {
      return;
    }

    const nextLabelIds = task.data.labels.some((label) => label.id === labelId)
      ? task.data.labels.filter((label) => label.id !== labelId).map((label) => label.id)
      : [...task.data.labels.map((label) => label.id), labelId];

    updateTask.mutate({ labelIds: nextLabelIds });
  };

  const handleChecklistSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!checklistTitle.trim()) {
      return;
    }

    createChecklistItem.mutate(
      { title: checklistTitle },
      {
        onSuccess: () => setChecklistTitle("")
      }
    );
  };

  const handleCommentSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!commentBody.trim()) {
      return;
    }

    createComment.mutate(
      { body: commentBody },
      {
        onSuccess: () => setCommentBody("")
      }
    );
  };

  const currentTask = findTaskInBoard(board, taskId);
  const currentColumn = currentTask
    ? board.columns.find((column) => column.id === currentTask.columnId)
    : null;
  const isSaving =
    updateTask.isPending ||
    moveTask.isPending ||
    createChecklistItem.isPending ||
    updateChecklistItem.isPending ||
    createComment.isPending;

  return (
    <SheetFrame onClose={onClose} title={t("board.detail.title")}>
      <div className="flex-1 overflow-auto bg-muted/20 p-3 sm:p-4">
        {task.isLoading ? (
          <div aria-live="polite" className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("board.detail.loading")}</p>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : null}
        {task.error ? (
          <div className="space-y-3">
            <InlineAlert>{getUserFacingApiError(task.error, t)}</InlineAlert>
            <Button onClick={() => void task.refetch()} type="button" variant="outline">
              {t("board.detail.retry")}
            </Button>
          </div>
        ) : null}
        {task.data ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-background p-3 shadow-sm sm:p-4">
              <form className="space-y-5" onSubmit={handleSubmit}>
                <TaskFields form={form} setForm={setForm} showBlocked />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="task-move">{t("board.detail.status")}</Label>
                    <Select
                      disabled={moveTask.isPending}
                      id="task-move"
                      onChange={(event) => {
                        if (!event.target.value || event.target.value === currentColumn?.id) {
                          return;
                        }

                        const targetTasks = board.tasksByColumn[event.target.value] ?? [];
                        moveTask.mutate({
                          taskId,
                          body: {
                            targetColumnId: event.target.value,
                            targetIndex: targetTasks.length,
                            boardVersion: board.version
                          }
                        });
                      }}
                      value={currentColumn?.id ?? ""}
                    >
                      {board.columns.map((column) => (
                        <option key={column.id} value={column.id}>
                          {column.name}
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("board.move.mobileHint")}</p>
                  </div>
                  <MetadataPillGrid task={task.data} columnName={currentColumn?.name ?? null} />
                </div>
                {updateTask.error ? (
                  <InlineAlert>{getUserFacingApiError(updateTask.error, t)}</InlineAlert>
                ) : null}
                {moveTask.error ? (
                  <InlineAlert>{getUserFacingApiError(moveTask.error, t)}</InlineAlert>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                  <p aria-live="polite" className="text-xs text-muted-foreground">
                    {isSaving ? t("board.detail.saving") : t("board.detail.saveHint")}
                  </p>
                  <Button disabled={updateTask.isPending} type="submit">
                    {updateTask.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    {t("common.save")}
                  </Button>
                </div>
              </form>
            </div>

            <AiImprovePanel
              applyError={applyAiSuggestion.error}
              improveError={improveWithAi.error}
              isApplying={applyAiSuggestion.isPending}
              isImproving={improveWithAi.isPending}
              isRejecting={rejectAiSuggestion.isPending}
              onApply={() => {
                if (!aiSuggestion) {
                  return;
                }

                applyAiSuggestion.mutate(
                  {
                    suggestionId: aiSuggestion.id,
                    body: {
                      ...aiSuggestion.suggestedPayload,
                      applyTitle: true,
                      applyDescription: true,
                      applyPriority: true,
                      applyAcceptanceCriteria: true,
                      applyChecklistItems: true
                    }
                  },
                  {
                    onSuccess: (result) => setAiSuggestion(result.suggestion)
                  }
                );
              }}
              onImprove={() =>
                improveWithAi.mutate(undefined, {
                  onSuccess: (result) => setAiSuggestion(result.suggestion)
                })
              }
              onReject={() => {
                if (!aiSuggestion) {
                  return;
                }

                rejectAiSuggestion.mutate(aiSuggestion.id, {
                  onSuccess: (result) => setAiSuggestion(result.suggestion)
                });
              }}
              rejectError={rejectAiSuggestion.error}
              suggestion={aiSuggestion}
              task={task.data}
            />

            <DetailSection title={t("board.detail.assignees")}>
              <div className="flex flex-wrap gap-2">
                {board.availableMembers.length > 0 ? (
                  board.availableMembers.map((member) => {
                    const selected = task.data.assignees.some(
                      (assignee) => assignee.id === member.id
                    );

                    return (
                      <button
                        aria-pressed={selected}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition",
                          selected
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        )}
                        disabled={updateTask.isPending}
                        key={member.id}
                        onClick={() => handleAssigneeToggle(member.id)}
                        type="button"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-[0.65rem] font-semibold">
                          {getInitials(member.name)}
                        </span>
                        {member.name}
                      </button>
                    );
                  })
                ) : (
                  <EmptyDetailState>{t("board.detail.emptyAssignees")}</EmptyDetailState>
                )}
              </div>
            </DetailSection>

            <DetailSection title={t("board.detail.labels")}>
              <div className="flex flex-wrap gap-2">
                {board.availableLabels.length > 0 ? (
                  board.availableLabels.map((label) => {
                    const selected = task.data.labels.some(
                      (taskLabel) => taskLabel.id === label.id
                    );

                    return (
                      <button
                        aria-pressed={selected}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition",
                          selected
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        )}
                        disabled={updateTask.isPending}
                        key={label.id}
                        onClick={() => handleLabelToggle(label.id)}
                        type="button"
                      >
                        <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                        {label.name}
                      </button>
                    );
                  })
                ) : (
                  <EmptyDetailState>{t("board.detail.emptyLabels")}</EmptyDetailState>
                )}
              </div>
            </DetailSection>

            <ChecklistSection
              addError={createChecklistItem.error}
              checklistTitle={checklistTitle}
              isAdding={createChecklistItem.isPending}
              isUpdating={updateChecklistItem.isPending}
              onChecklistTitleChange={setChecklistTitle}
              onSubmit={handleChecklistSubmit}
              onToggle={(itemId, isDone) =>
                updateChecklistItem.mutate({ itemId, body: { isDone: !isDone } })
              }
              task={task.data}
            />

            <CommentsSection
              addError={createComment.error}
              commentBody={commentBody}
              isAdding={createComment.isPending}
              onCommentBodyChange={setCommentBody}
              onSubmit={handleCommentSubmit}
              task={task.data}
            />

            <ActivitySection task={task.data} />

            <DetailSection title={t("board.detail.metadata")}>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <MetadataRow
                  label={t("board.detail.createdBy")}
                  value={task.data.createdBy?.name ?? t("board.detail.system")}
                />
                <MetadataRow
                  label={t("board.detail.createdAt")}
                  value={formatTimestamp(task.data.createdAt, i18n.language)}
                />
                <MetadataRow
                  label={t("board.detail.startedAt")}
                  value={
                    formatTimestamp(task.data.startedAt, i18n.language) ??
                    t("board.detail.notStarted")
                  }
                />
                <MetadataRow
                  label={t("board.detail.completedAt")}
                  value={
                    formatTimestamp(task.data.completedAt, i18n.language) ??
                    t("board.detail.notCompleted")
                  }
                />
              </dl>
            </DetailSection>

            {updateTask.error ? (
              <InlineAlert>{getUserFacingApiError(updateTask.error, t)}</InlineAlert>
            ) : null}
            {createChecklistItem.error ? (
              <InlineAlert>{getUserFacingApiError(createChecklistItem.error, t)}</InlineAlert>
            ) : null}
            {updateChecklistItem.error ? (
              <InlineAlert>{getUserFacingApiError(updateChecklistItem.error, t)}</InlineAlert>
            ) : null}
            {createComment.error ? (
              <InlineAlert>{getUserFacingApiError(createComment.error, t)}</InlineAlert>
            ) : null}
            {deleteTask.error ? (
              <InlineAlert>{getUserFacingApiError(deleteTask.error, t)}</InlineAlert>
            ) : null}
            <div className="flex flex-wrap justify-between gap-2 rounded-md border border-border bg-background p-3 shadow-sm">
              <Button onClick={() => setConfirmDelete(true)} type="button" variant="destructive">
                {t("board.delete.button")}
              </Button>
              <div className="flex gap-2">
                <Button onClick={onClose} type="button" variant="outline">
                  {t("common.close")}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {confirmDelete ? (
        <DialogFrame onClose={() => setConfirmDelete(false)} title={t("board.delete.title")}>
          <div className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground">{t("board.delete.description")}</p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setConfirmDelete(false)} type="button" variant="outline">
                {t("common.cancel")}
              </Button>
              <Button
                disabled={deleteTask.isPending}
                onClick={() =>
                  deleteTask.mutate(taskId, {
                    onSuccess: () => {
                      setConfirmDelete(false);
                      onClose();
                    }
                  })
                }
                type="button"
                variant="destructive"
              >
                {t("board.delete.confirm")}
              </Button>
            </div>
          </div>
        </DialogFrame>
      ) : null}
    </SheetFrame>
  );
}

function MetadataPillGrid({ task, columnName }: { task: TaskDetail; columnName: string | null }) {
  const { i18n, t } = useTranslation();
  const dueDate = formatDueDate(task.dueDate, i18n.language);

  return (
    <div className="grid gap-2 rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
      <span>
        {t("board.detail.status")}: {columnName ?? t("board.detail.unknown")}
      </span>
      <span>
        {t("board.task.priority")}: {t(`board.priority.${task.priority}`)}
      </span>
      <span>
        {t("board.task.dueDate")}: {dueDate ?? t("board.detail.noDueDate")}
      </span>
      <span>
        {t("board.task.blocked")}:{" "}
        {task.isBlocked ? t("board.detail.blockedYes") : t("board.detail.blockedNo")}
      </span>
    </div>
  );
}

function AiImprovePanel({
  task,
  suggestion,
  isImproving,
  isApplying,
  isRejecting,
  improveError,
  applyError,
  rejectError,
  onImprove,
  onApply,
  onReject
}: {
  task: TaskDetail;
  suggestion: AiSuggestion | null;
  isImproving: boolean;
  isApplying: boolean;
  isRejecting: boolean;
  improveError: unknown;
  applyError: unknown;
  rejectError: unknown;
  onImprove: () => void;
  onApply: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation();
  const isPending = suggestion?.status === "pending";

  return (
    <DetailSection
      actions={
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {t("board.ai.powered")}
        </span>
      }
      title={t("board.ai.title")}
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("board.ai.description")}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={isImproving || !task.title.trim()}
            onClick={onImprove}
            type="button"
            variant={suggestion ? "outline" : "default"}
          >
            {isImproving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {isImproving ? t("board.ai.loading") : t("board.ai.improve")}
          </Button>
        </div>
        {!task.title.trim() ? <InlineAlert>{t("board.ai.titleRequired")}</InlineAlert> : null}
        {improveError ? (
          <InlineAlert>{getUserFacingApiError(improveError, t, "ai")}</InlineAlert>
        ) : null}

        {suggestion ? (
          <div className="space-y-3 rounded-md border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                {t(`board.ai.status.${suggestion.status}`)}
              </span>
              <span className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">
                {suggestion.model}
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2 rounded-md border border-border bg-background p-3">
                <h4 className="text-sm font-semibold">{t("board.ai.original")}</h4>
                <ComparisonRow label={t("board.task.title")} value={task.title} />
                <ComparisonRow
                  label={t("board.task.description")}
                  value={task.description || t("board.detail.emptyDescription")}
                />
                <ComparisonRow
                  label={t("board.task.priority")}
                  value={t(`board.priority.${task.priority}`)}
                />
              </div>
              <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                <h4 className="text-sm font-semibold">{t("board.ai.improved")}</h4>
                <ComparisonRow
                  label={t("board.task.title")}
                  value={suggestion.suggestedPayload.improvedTitle}
                />
                <ComparisonRow
                  label={t("board.task.description")}
                  value={suggestion.suggestedPayload.improvedDescription}
                />
                <ComparisonRow
                  label={t("board.ai.recommendedPriority")}
                  value={t(`board.priority.${suggestion.suggestedPayload.recommendedPriority}`)}
                />
              </div>
            </div>

            <AiList
              emptyLabel={t("board.ai.emptyAcceptanceCriteria")}
              items={suggestion.suggestedPayload.acceptanceCriteria}
              title={t("board.ai.acceptanceCriteria")}
            />
            <AiList
              emptyLabel={t("board.ai.emptyChecklist")}
              items={suggestion.suggestedPayload.suggestedChecklistItems}
              title={t("board.ai.suggestedChecklist")}
            />
            <AiList
              emptyLabel={t("board.ai.emptyRiskNotes")}
              items={suggestion.suggestedPayload.riskNotes}
              title={t("board.ai.riskNotes")}
            />

            {applyError ? (
              <InlineAlert>{getUserFacingApiError(applyError, t, "ai")}</InlineAlert>
            ) : null}
            {rejectError ? (
              <InlineAlert>{getUserFacingApiError(rejectError, t, "ai")}</InlineAlert>
            ) : null}

            {isPending ? (
              <div className="flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:justify-end">
                <Button
                  disabled={isApplying || isRejecting}
                  onClick={onReject}
                  type="button"
                  variant="outline"
                >
                  {isRejecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {t("board.ai.reject")}
                </Button>
                <Button disabled={isApplying || isRejecting} onClick={onApply} type="button">
                  {isApplying ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {t("board.ai.apply")}
                </Button>
              </div>
            ) : (
              <InlineAlert>{t(`board.ai.reviewed.${suggestion.status}`)}</InlineAlert>
            )}
          </div>
        ) : null}
      </div>
    </DetailSection>
  );
}

function ComparisonRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm leading-6 text-foreground">{value}</dd>
    </div>
  );
}

function AiList({
  title,
  items,
  emptyLabel
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li className="flex gap-2 text-sm leading-6" key={item}>
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function ChecklistSection({
  task,
  checklistTitle,
  onChecklistTitleChange,
  onSubmit,
  onToggle,
  isAdding,
  isUpdating,
  addError
}: {
  task: TaskDetail;
  checklistTitle: string;
  onChecklistTitleChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onToggle: (itemId: string, isDone: boolean) => void;
  isAdding: boolean;
  isUpdating: boolean;
  addError: unknown;
}) {
  const { t } = useTranslation();

  return (
    <DetailSection
      actions={
        <span className="text-xs text-muted-foreground">
          {t("board.card.checklist", {
            completed: task.checklist.completed,
            total: task.checklist.total
          })}
        </span>
      }
      title={t("board.detail.checklist")}
    >
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onSubmit}>
        <Label className="sr-only" htmlFor="new-checklist-item">
          {t("board.detail.addChecklistLabel")}
        </Label>
        <Input
          id="new-checklist-item"
          onChange={(event) => onChecklistTitleChange(event.target.value)}
          placeholder={t("board.detail.addChecklistPlaceholder")}
          value={checklistTitle}
        />
        <Button disabled={isAdding || !checklistTitle.trim()} type="submit" variant="outline">
          {isAdding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {t("board.detail.addChecklist")}
        </Button>
      </form>
      {task.checklistItems.length > 0 ? (
        <ul className="space-y-2">
          {task.checklistItems.map((item) => (
            <li
              className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2"
              key={item.id}
            >
              <button
                aria-label={
                  item.isDone
                    ? t("board.detail.markChecklistOpen")
                    : t("board.detail.markChecklistDone")
                }
                className="mt-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={isUpdating}
                onClick={() => onToggle(item.id, item.isDone)}
                type="button"
              >
                {item.isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                ) : (
                  <Circle className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              <span
                className={cn(
                  "text-sm leading-5",
                  item.isDone ? "text-muted-foreground line-through" : "text-foreground"
                )}
              >
                {item.title}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyDetailState>{t("board.detail.emptyChecklist")}</EmptyDetailState>
      )}
      {addError ? <InlineAlert>{getUserFacingApiError(addError, t)}</InlineAlert> : null}
    </DetailSection>
  );
}

function CommentsSection({
  task,
  commentBody,
  onCommentBodyChange,
  onSubmit,
  isAdding,
  addError
}: {
  task: TaskDetail;
  commentBody: string;
  onCommentBodyChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isAdding: boolean;
  addError: unknown;
}) {
  const { i18n, t } = useTranslation();

  return (
    <DetailSection
      actions={
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          {t("board.detail.commentCount", { count: task.commentsCount })}
        </span>
      }
      title={t("board.detail.comments")}
    >
      {task.comments.length > 0 ? (
        <ul className="space-y-3">
          {task.comments.map((comment) => (
            <li className="rounded-md border border-border bg-card p-3" key={comment.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-[0.7rem] font-semibold">
                    {getInitials(comment.author.name)}
                  </span>
                  <span className="text-sm font-medium">{comment.author.name}</span>
                </div>
                <time className="text-xs text-muted-foreground" dateTime={comment.createdAt}>
                  {formatTimestamp(comment.createdAt, i18n.language)}
                </time>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {comment.body}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyDetailState>{t("board.detail.emptyComments")}</EmptyDetailState>
      )}
      <form className="space-y-2" onSubmit={onSubmit}>
        <Label htmlFor="new-comment">{t("board.detail.addCommentLabel")}</Label>
        <Textarea
          id="new-comment"
          onChange={(event) => onCommentBodyChange(event.target.value)}
          placeholder={t("board.detail.addCommentPlaceholder")}
          value={commentBody}
        />
        <div className="flex justify-end">
          <Button disabled={isAdding || !commentBody.trim()} type="submit" variant="outline">
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {t("board.detail.addComment")}
          </Button>
        </div>
      </form>
      {addError ? <InlineAlert>{getUserFacingApiError(addError, t)}</InlineAlert> : null}
    </DetailSection>
  );
}

function ActivitySection({ task }: { task: TaskDetail }) {
  const { i18n, t } = useTranslation();

  return (
    <DetailSection title={t("board.detail.activity")}>
      {task.activity.length > 0 ? (
        <ol className="space-y-3">
          {task.activity.map((event) => (
            <li className="flex gap-3" key={event.id}>
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
                <UserRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  {t(`board.activity.${event.type}`)}
                  {event.actor ? (
                    <span className="text-muted-foreground"> {event.actor.name}</span>
                  ) : null}
                </p>
                <time className="text-xs text-muted-foreground" dateTime={event.createdAt}>
                  {formatTimestamp(event.createdAt, i18n.language)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyDetailState>{t("board.detail.emptyActivity")}</EmptyDetailState>
      )}
    </DetailSection>
  );
}

function TaskCard({
  task,
  onOpen,
  dragging
}: {
  task: BoardTaskCard;
  onOpen?: () => void;
  dragging?: boolean;
}) {
  const { i18n, t } = useTranslation();
  const dueDate = formatDueDate(task.dueDate, i18n.language);
  const isOverdue =
    task.dueDate !== null &&
    task.completedAt === null &&
    new Date(`${task.dueDate}T00:00:00Z`) < new Date(new Date().toISOString().slice(0, 10));
  const assignee = task.assignees[0];
  const initials = assignee?.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      aria-label={t("board.card.openTask", { title: task.title })}
      className={cn(
        "w-full rounded-md border border-border bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/25 hover:bg-muted/20 hover:shadow-shell focus-visible:ring-2 focus-visible:ring-ring",
        task.isBlocked ? "border-destructive/40 bg-destructive/5" : null,
        dragging ? "opacity-60" : null
      )}
      onClick={onOpen}
      type="button"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-5">{task.title}</h3>
        <GripVertical
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-label={t("board.card.dragHint")}
        />
      </div>
      {task.descriptionPreview ? (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {task.descriptionPreview}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className={cn("rounded border px-1.5 py-0.5", taskPriorityTone[task.priority])}>
          {t(`board.priority.${task.priority}`)}
        </span>
        {dueDate ? (
          <span
            className={cn(
              "inline-flex items-center gap-1",
              isOverdue ? "font-medium text-destructive" : null
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {dueDate}
          </span>
        ) : null}
        {task.checklist.total > 0 ? (
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {task.checklist.completed}/{task.checklist.total}
          </span>
        ) : null}
        {task.commentsCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            {task.commentsCount}
          </span>
        ) : null}
        {task.isBlocked ? (
          <span className="inline-flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {t("board.card.blocked")}
          </span>
        ) : null}
      </div>
      {task.labels.length > 0 || assignee ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-1">
            {task.labels.slice(0, 3).map((label) => (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-xs" key={label.id}>
                {label.name}
              </span>
            ))}
            {task.labels.length > 3 ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                +{task.labels.length - 3}
              </span>
            ) : null}
          </div>
          {assignee ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[0.65rem] font-semibold">
              {initials}
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}

function SortableTaskCard({ task, onOpen }: { task: BoardTaskCard; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: task.id });
  const style = transform
    ? {
        transform: `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard dragging={isDragging} onOpen={onOpen} task={task} />
    </div>
  );
}

function BoardColumnView({
  column,
  tasks,
  onCreateTask,
  onOpenTask
}: {
  column: BoardColumn;
  tasks: BoardTaskCard[];
  onCreateTask: (column: BoardColumn) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <section
      className="flex min-h-52 flex-col rounded-lg border border-border bg-card/80 p-3 shadow-sm lg:w-80 lg:shrink-0"
      ref={setNodeRef}
    >
      <header className="mb-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{column.name}</h2>
          <span className="rounded bg-secondary px-2 py-1 text-xs text-muted-foreground">
            {t("board.column.taskCount", { count: tasks.length })}
          </span>
        </div>
        {column.wip.limit !== null ? (
          <div
            className={cn(
              "rounded-md border px-2 py-1 text-xs font-medium",
              column.wip.exceeded
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-border text-muted-foreground"
            )}
          >
            {t("board.wip.count", { count: column.wip.count, limit: column.wip.limit })}
            {column.wip.exceeded ? ` ${t("board.wip.warning")}` : null}
          </div>
        ) : null}
      </header>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2">
          {tasks.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              {t("board.column.empty")}
            </div>
          ) : null}
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} onOpen={() => onOpenTask(task.id)} task={task} />
          ))}
        </div>
      </SortableContext>
      <Button
        className="mt-3 w-full"
        onClick={() => onCreateTask(column)}
        type="button"
        variant="outline"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t("board.create.button")}
      </Button>
    </section>
  );
}

export function BoardPage({ boardId }: BoardPageProps) {
  const { t } = useTranslation();
  const board = useBoard(boardId);
  const moveTask = useMoveTaskMutation(boardId);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [createColumn, setCreateColumn] = React.useState<BoardColumn | null>(null);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<BoardFiltersState>(() => readBoardFiltersFromUrl());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const hasFilters = hasActiveBoardFilters(filters);

  React.useEffect(() => {
    writeBoardFiltersToUrl(filters);
  }, [filters]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "/" && !isTextEntryTarget(event.target)) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (event.key.toLowerCase() === "n" && !isTextEntryTarget(event.target)) {
        if (createColumn || selectedTaskId || !board.data?.columns[0]) {
          return;
        }

        event.preventDefault();
        setCreateColumn(board.data.columns[0]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [board.data, createColumn, selectedTaskId]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null);

    if (!board.data || !event.over) {
      return;
    }

    const activeId = String(event.active.id);
    const dragBoard = hasFilters
      ? {
          ...board.data,
          tasksByColumn: getFilteredTasksByColumn(board.data, filters)
        }
      : board.data;
    const target = getTargetFromDrag(dragBoard, activeId, String(event.over.id));
    const current = getTaskLocation(board.data, activeId);

    if (!target || !current) {
      return;
    }

    if (target.targetColumnId === current.column.id && target.targetIndex === current.taskIndex) {
      return;
    }

    moveTask.mutate({
      taskId: activeId,
      body: {
        targetColumnId: target.targetColumnId,
        targetIndex: target.targetIndex,
        boardVersion: board.data.version
      }
    });
  };

  if (board.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (board.error) {
    return <InlineAlert>{getUserFacingApiError(board.error, t)}</InlineAlert>;
  }

  if (!board.data) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
        {t("board.empty")}
      </div>
    );
  }

  const activeTask = activeTaskId ? findTaskInBoard(board.data, activeTaskId) : null;
  const filteredTasksByColumn = getFilteredTasksByColumn(board.data, filters);
  const totalTaskCount = board.data.columns.reduce(
    (count, column) => count + (board.data.tasksByColumn[column.id]?.length ?? 0),
    0
  );
  const filteredTaskCount = board.data.columns.reduce(
    (count, column) => count + (filteredTasksByColumn[column.id]?.length ?? 0),
    0
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {board.data.workspace.name} / {board.data.project.name}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{board.data.name}</h1>
        </div>
        <p className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
          {t("board.version", { version: board.data.version })}
        </p>
      </header>
      {moveTask.error ? (
        <InlineAlert>{getUserFacingApiError(moveTask.error, t)}</InlineAlert>
      ) : null}
      <BoardTips board={board.data} />
      <BoardFilterBar
        board={board.data}
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(defaultBoardFilters)}
        resultCount={filteredTaskCount}
        searchInputRef={searchInputRef}
        totalCount={totalTaskCount}
      />
      {hasFilters && filteredTaskCount === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          {t("board.filters.empty")}
        </div>
      ) : null}
      <DndContext
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <div className="grid gap-4 lg:flex lg:overflow-x-auto lg:pb-4">
          {board.data.columns.map((column) => (
            <BoardColumnView
              column={column}
              key={column.id}
              onCreateTask={setCreateColumn}
              onOpenTask={setSelectedTaskId}
              tasks={filteredTasksByColumn[column.id] ?? []}
            />
          ))}
        </div>
        <DragOverlay>{activeTask ? <TaskCard dragging task={activeTask} /> : null}</DragOverlay>
      </DndContext>
      {createColumn ? (
        <CreateTaskDialog
          board={board.data}
          column={createColumn}
          onClose={() => setCreateColumn(null)}
        />
      ) : null}
      {selectedTaskId ? (
        <TaskDetailSheet
          board={board.data}
          onClose={() => setSelectedTaskId(null)}
          taskId={selectedTaskId}
        />
      ) : null}
    </div>
  );
}
