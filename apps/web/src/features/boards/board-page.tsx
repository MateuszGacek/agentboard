import type {
  AiNextActionSuggestion,
  AiSuggestion,
  BoardColumn,
  BoardSnapshot,
  BoardTaskCard,
  ColumnSystemKey,
  TaskDetail,
  TaskPriority
} from "@kanban/shared";
import { columnSystemKeyValues } from "@kanban/shared";
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
  ArrowDown,
  ArrowUp,
  Bookmark,
  Check,
  CalendarDays,
  CheckCircle2,
  Circle,
  GripVertical,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
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
  useCreateTaskFromAiSuggestionMutation,
  useCreateTaskMutation,
  useDeleteChecklistItemMutation,
  useDeleteCommentMutation,
  useDeleteTaskMutation,
  useImproveTaskWithAiMutation,
  useMoveTaskMutation,
  useRejectAiSuggestionMutation,
  useSuggestBoardNextActionsMutation,
  useTaskDetail,
  useTaskAiSuggestions,
  useUpdateBoardColumnMutation,
  useUpdateChecklistItemMutation,
  useUpdateCommentMutation,
  useUpdateTaskMutation
} from "./board-queries";
import { useSession } from "../auth/auth-queries";

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
  columnSystemKey: "all" | ColumnSystemKey;
  due: BoardDueFilter;
};

type SavedBoardView = {
  id: string;
  name: string;
  filters: BoardFiltersState;
  createdAt: string;
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
  columnSystemKey: "all",
  due: "all"
};

function savedViewsStorageKey(boardId: string) {
  return `kanban.boardViews.${boardId}`;
}

function readSavedBoardViews(boardId: string): SavedBoardView[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(savedViewsStorageKey(boardId)) ?? "[]");
    return Array.isArray(parsed) ? (parsed as SavedBoardView[]) : [];
  } catch {
    return [];
  }
}

function writeSavedBoardViews(boardId: string, views: SavedBoardView[]) {
  window.localStorage.setItem(savedViewsStorageKey(boardId), JSON.stringify(views));
}

function boardViewPresets(currentUserId: string | null): Array<{
  id: string;
  labelKey: string;
  filters: BoardFiltersState;
}> {
  return [
    {
      id: "my-work",
      labelKey: "board.savedViews.presets.myWork",
      filters: {
        ...defaultBoardFilters,
        assigneeId: currentUserId ?? "all"
      }
    },
    {
      id: "blocked",
      labelKey: "board.savedViews.presets.blocked",
      filters: { ...defaultBoardFilters, blocked: "blocked" }
    },
    {
      id: "due-soon",
      labelKey: "board.savedViews.presets.dueSoon",
      filters: { ...defaultBoardFilters, due: "week" }
    },
    {
      id: "overdue",
      labelKey: "board.savedViews.presets.overdue",
      filters: { ...defaultBoardFilters, due: "overdue" }
    },
    {
      id: "high-priority",
      labelKey: "board.savedViews.presets.highPriority",
      filters: { ...defaultBoardFilters, priority: "high" }
    },
    {
      id: "in-progress",
      labelKey: "board.savedViews.presets.inProgress",
      filters: { ...defaultBoardFilters, columnSystemKey: "in_progress" }
    }
  ];
}

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

const boardCommandEvents = {
  createTask: "kanban:board-create-task",
  focusSearch: "kanban:board-focus-search",
  clearFilters: "kanban:board-clear-filters"
} as const;

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

function isColumnSystemKey(value: string | null): value is ColumnSystemKey {
  return columnSystemKeyValues.includes(value as ColumnSystemKey);
}

function readBoardFiltersFromUrl(): BoardFiltersState {
  if (typeof window === "undefined") {
    return defaultBoardFilters;
  }

  const params = new URLSearchParams(window.location.search);
  const priority = params.get("priority");
  const blocked = params.get("blocked");
  const due = params.get("due");
  const column = params.get("column");

  return {
    q: params.get("q") ?? "",
    priority: isTaskPriority(priority) ? priority : "all",
    blocked: isBlockedFilter(blocked) ? blocked : "all",
    assigneeId: params.get("assignee") ?? "all",
    labelId: params.get("label") ?? "all",
    columnSystemKey: isColumnSystemKey(column) ? column : "all",
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
    ["columnSystemKey", "column"],
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
    filters.columnSystemKey !== "all" ||
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
      filters.columnSystemKey !== "all" && column.systemKey !== filters.columnSystemKey
        ? []
        : (board.tasksByColumn[column.id] ?? []).filter((task) => filterBoardTask(task, filters))
    ])
  ) as BoardSnapshot["tasksByColumn"];
}

function useDismissedTip(tipId: string) {
  const storageKey = `kanban.tip.${tipId}`;
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
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
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
            <Label htmlFor="board-column-filter">{t("board.filters.column")}</Label>
            <Select
              id="board-column-filter"
              onChange={(event) =>
                onChange({
                  ...filters,
                  columnSystemKey:
                    event.target.value === "all" ? "all" : (event.target.value as ColumnSystemKey)
                })
              }
              value={filters.columnSystemKey}
            >
              <option value="all">{t("board.filters.allColumns")}</option>
              {board.columns.map((column) => (
                <option key={column.id} value={column.systemKey}>
                  {column.name}
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
        <p aria-live="polite" className="inline-flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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

function SavedViewsBar({
  board,
  currentUserId,
  filters,
  onApply
}: {
  board: BoardSnapshot;
  currentUserId: string | null;
  filters: BoardFiltersState;
  onApply: (filters: BoardFiltersState) => void;
}) {
  const { t } = useTranslation();
  const [views, setViews] = React.useState<SavedBoardView[]>(() => readSavedBoardViews(board.id));
  const [name, setName] = React.useState("");
  const presets = boardViewPresets(currentUserId).filter(
    (preset) => preset.id !== "my-work" || currentUserId !== null
  );

  const persist = (nextViews: SavedBoardView[]) => {
    setViews(nextViews);
    writeSavedBoardViews(board.id, nextViews);
  };

  const saveCurrent = () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    persist([
      {
        id: crypto.randomUUID(),
        name: trimmedName,
        filters,
        createdAt: new Date().toISOString()
      },
      ...views
    ]);
    setName("");
  };

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">{t("board.savedViews.title")}</h2>
          <p className="text-xs leading-5 text-muted-foreground">
            {t("board.savedViews.description")}
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:w-80 sm:flex-row">
          <Input
            aria-label={t("board.savedViews.name")}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("board.savedViews.name")}
            value={name}
          />
          <Button disabled={!name.trim()} onClick={saveCurrent} type="button" variant="outline">
            <Bookmark className="h-4 w-4" aria-hidden="true" />
            {t("board.savedViews.save")}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.id}
            onClick={() => onApply(preset.filters)}
            size="sm"
            type="button"
            variant="outline"
          >
            {t(preset.labelKey)}
          </Button>
        ))}
      </div>
      {views.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {views.map((view) => (
            <span
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-background p-1"
              key={view.id}
            >
              <button
                className="min-h-8 truncate px-2 text-sm font-medium hover:text-primary"
                onClick={() => onApply(view.filters)}
                type="button"
              >
                {view.name}
              </button>
              <Button
                aria-label={t("board.savedViews.delete", { name: view.name })}
                onClick={() => persist(views.filter((candidate) => candidate.id !== view.id))}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function AiNextActionsPanel({ board }: { board: BoardSnapshot }) {
  const { t } = useTranslation();
  const suggestNextActions = useSuggestBoardNextActionsMutation(board.id);
  const createFromSuggestion = useCreateTaskFromAiSuggestionMutation(board.id);
  const [focus, setFocus] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<AiNextActionSuggestion[]>([]);
  const [createdSuggestionIds, setCreatedSuggestionIds] = React.useState<string[]>([]);

  const handleSuggest = () => {
    suggestNextActions.mutate(
      {
        focus: focus.trim() || undefined,
        maxSuggestions: 3
      },
      {
        onSuccess: (result) => {
          setSuggestions(result.suggestions);
          setCreatedSuggestionIds([]);
        }
      }
    );
  };

  const handleCreate = (suggestion: AiNextActionSuggestion) => {
    createFromSuggestion.mutate(
      { board, suggestion },
      {
        onSuccess: () =>
          setCreatedSuggestionIds((current) =>
            current.includes(suggestion.id) ? current : [...current, suggestion.id]
          )
      }
    );
  };

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
            <h2 className="text-sm font-semibold">{t("board.aiNext.title")}</h2>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{t("board.aiNext.description")}</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row lg:w-[34rem]">
          <Input
            onChange={(event) => setFocus(event.target.value)}
            placeholder={t("board.aiNext.focusPlaceholder")}
            value={focus}
          />
          <Button disabled={suggestNextActions.isPending} onClick={handleSuggest} type="button">
            {suggestNextActions.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {t("board.aiNext.suggest")}
          </Button>
        </div>
      </div>
      {suggestNextActions.error ? (
        <InlineAlert>{getUserFacingApiError(suggestNextActions.error, t, "ai")}</InlineAlert>
      ) : null}
      {createFromSuggestion.error ? (
        <InlineAlert>{getUserFacingApiError(createFromSuggestion.error, t)}</InlineAlert>
      ) : null}
      {suggestions.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {suggestions.map((suggestion) => {
            const created = createdSuggestionIds.includes(suggestion.id);

            return (
              <article
                className="rounded-md border border-border bg-background p-3"
                key={suggestion.id}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="break-words text-sm font-semibold">{suggestion.title}</h3>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {t(`board.priority.${suggestion.priority}`)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {suggestion.description}
                </p>
                {suggestion.checklistItems.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {suggestion.checklistItems.slice(0, 3).map((item) => (
                      <li className="flex gap-2" key={item}>
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Button
                  className="mt-3 w-full"
                  disabled={created || createFromSuggestion.isPending}
                  onClick={() => handleCreate(suggestion)}
                  size="sm"
                  type="button"
                  variant={created ? "outline" : "default"}
                >
                  {created ? t("board.aiNext.created") : t("board.aiNext.createTask")}
                </Button>
              </article>
            );
          })}
        </div>
      ) : null}
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
  description,
  children,
  onClose
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = React.useId();
  const descriptionId = React.useId();

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
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg animate-dialog-in overflow-auto rounded-lg border border-border bg-card shadow-shell"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="text-base font-semibold" id={titleId}>
            {title}
          </h2>
          {description ? (
            <p className="sr-only" id={descriptionId}>
              {description}
            </p>
          ) : null}
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
  description,
  children,
  onClose
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = React.useId();
  const descriptionId = React.useId();

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
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="ml-auto flex h-full w-full animate-sheet-in flex-col overflow-hidden border-l border-border bg-card shadow-shell sm:max-w-2xl"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="text-base font-semibold" id={titleId}>
            {title}
          </h2>
          {description ? (
            <p className="sr-only" id={descriptionId}>
              {description}
            </p>
          ) : null}
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
  showBlocked,
  titleAutoFocus = false
}: {
  form: TaskFormState;
  setForm: React.Dispatch<React.SetStateAction<TaskFormState>>;
  showBlocked: boolean;
  titleAutoFocus?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="task-title">{t("board.task.title")}</Label>
        <Input
          autoFocus={titleAutoFocus}
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
  const [columnId, setColumnId] = React.useState(column.id);
  const [assigneeIds, setAssigneeIds] = React.useState<string[]>([]);
  const [labelIds, setLabelIds] = React.useState<string[]>([]);
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
        columnId,
        title: form.title,
        description: form.description.trim() ? form.description : null,
        priority: form.priority,
        dueDate: form.dueDate || null,
        assigneeIds,
        labelIds
      },
      { onSuccess: onClose }
    );
  };

  const description = t("board.create.column", { column: column.name });

  return (
    <DialogFrame description={description} onClose={onClose} title={t("board.create.title")}>
      <form className="space-y-4 p-4" onSubmit={handleSubmit}>
        <p className="text-sm text-muted-foreground">{description}</p>
        <TaskFields form={form} setForm={setForm} showBlocked={false} titleAutoFocus />
        <div className="space-y-2">
          <Label htmlFor="create-task-column">{t("board.detail.status")}</Label>
          <Select
            id="create-task-column"
            onChange={(event) => setColumnId(event.target.value)}
            value={columnId}
          >
            {board.columns.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("board.detail.assignees")}</p>
            {board.availableMembers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {board.availableMembers.map((member) => {
                  const selected = assigneeIds.includes(member.id);

                  return (
                    <button
                      aria-pressed={selected}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                      key={member.id}
                      onClick={() =>
                        setAssigneeIds((current) =>
                          current.includes(member.id)
                            ? current.filter((id) => id !== member.id)
                            : [...current, member.id]
                        )
                      }
                      type="button"
                    >
                      <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                      {member.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyDetailState>{t("board.detail.emptyAssignees")}</EmptyDetailState>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("board.detail.labels")}</p>
            {board.availableLabels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {board.availableLabels.map((label) => {
                  const selected = labelIds.includes(label.id);

                  return (
                    <button
                      aria-pressed={selected}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                      key={label.id}
                      onClick={() =>
                        setLabelIds((current) =>
                          current.includes(label.id)
                            ? current.filter((id) => id !== label.id)
                            : [...current, label.id]
                        )
                      }
                      type="button"
                    >
                      <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                      {label.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyDetailState>{t("board.detail.emptyLabels")}</EmptyDetailState>
            )}
          </div>
        </div>
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

function ColumnSettingsDialog({
  column,
  isSaving,
  error,
  onClose,
  onSubmit
}: {
  column: BoardColumn;
  isSaving: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (body: { name: string; wipLimit: number | null }) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = React.useState(column.name);
  const [wipLimit, setWipLimit] = React.useState(column.wipLimit?.toString() ?? "");
  const [localError, setLocalError] = React.useState<string | null>(null);

  const description = t("board.columnSettings.description", { column: column.name });

  return (
    <DialogFrame
      description={description}
      onClose={onClose}
      title={t("board.columnSettings.title")}
    >
      <form
        className="space-y-4 p-4"
        onSubmit={(event) => {
          event.preventDefault();

          if (!name.trim()) {
            setLocalError(t("validation.required"));
            return;
          }

          const parsedWipLimit = wipLimit.trim() ? Number(wipLimit) : null;

          if (
            parsedWipLimit !== null &&
            (!Number.isInteger(parsedWipLimit) || parsedWipLimit < 1 || parsedWipLimit > 99)
          ) {
            setLocalError(t("board.columnSettings.invalidWip"));
            return;
          }

          onSubmit({ name, wipLimit: parsedWipLimit });
        }}
      >
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="space-y-2">
          <Label htmlFor="column-name">{t("board.columnSettings.name")}</Label>
          <Input
            id="column-name"
            onChange={(event) => {
              setName(event.target.value);
              setLocalError(null);
            }}
            value={name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="column-wip-limit">{t("board.columnSettings.wipLimit")}</Label>
          <Input
            id="column-wip-limit"
            inputMode="numeric"
            max={99}
            min={1}
            onChange={(event) => {
              setWipLimit(event.target.value);
              setLocalError(null);
            }}
            placeholder={t("board.columnSettings.noWipLimit")}
            type="number"
            value={wipLimit}
          />
          <p className="text-xs text-muted-foreground">{t("board.columnSettings.wipHelp")}</p>
        </div>
        {localError ? <InlineAlert>{localError}</InlineAlert> : null}
        {error ? <InlineAlert>{getUserFacingApiError(error, t)}</InlineAlert> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose} type="button" variant="outline">
            {t("common.cancel")}
          </Button>
          <Button disabled={isSaving} type="submit">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {t("common.save")}
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
  const aiSuggestions = useTaskAiSuggestions(taskId);
  const updateTask = useUpdateTaskMutation(board.id, taskId);
  const deleteTask = useDeleteTaskMutation(board.id);
  const moveTask = useMoveTaskMutation(board.id);
  const createChecklistItem = useCreateChecklistItemMutation(board.id, taskId);
  const updateChecklistItem = useUpdateChecklistItemMutation(board.id, taskId);
  const deleteChecklistItem = useDeleteChecklistItemMutation(board.id, taskId);
  const createComment = useCreateCommentMutation(board.id, taskId);
  const updateComment = useUpdateCommentMutation(board.id, taskId);
  const deleteComment = useDeleteCommentMutation(board.id, taskId);
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
    deleteChecklistItem.isPending ||
    createComment.isPending ||
    updateComment.isPending ||
    deleteComment.isPending;

  return (
    <SheetFrame
      description={t("board.detail.description")}
      onClose={onClose}
      title={t("board.detail.title")}
    >
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
              suggestions={aiSuggestions.data?.suggestions ?? []}
              suggestionsError={aiSuggestions.error}
              suggestionsLoading={aiSuggestions.isLoading}
              onSelectSuggestion={setAiSuggestion}
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
              isDeleting={deleteChecklistItem.isPending}
              isUpdating={updateChecklistItem.isPending}
              onChecklistTitleChange={setChecklistTitle}
              onDelete={(itemId) => deleteChecklistItem.mutate(itemId)}
              onMove={(itemId, position) =>
                updateChecklistItem.mutate({ itemId, body: { position } })
              }
              onRename={(itemId, title) => updateChecklistItem.mutate({ itemId, body: { title } })}
              onSubmit={handleChecklistSubmit}
              onToggle={(itemId, isDone) =>
                updateChecklistItem.mutate({ itemId, body: { isDone: !isDone } })
              }
              updateError={updateChecklistItem.error ?? deleteChecklistItem.error}
              task={task.data}
            />

            <CommentsSection
              addError={createComment.error}
              commentBody={commentBody}
              isAdding={createComment.isPending}
              isDeleting={deleteComment.isPending}
              isUpdating={updateComment.isPending}
              onCommentBodyChange={setCommentBody}
              onDelete={(commentId) => deleteComment.mutate(commentId)}
              onEdit={(commentId, body) => updateComment.mutate({ commentId, body: { body } })}
              onSubmit={handleCommentSubmit}
              updateError={updateComment.error ?? deleteComment.error}
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
            {deleteChecklistItem.error ? (
              <InlineAlert>{getUserFacingApiError(deleteChecklistItem.error, t)}</InlineAlert>
            ) : null}
            {createComment.error ? (
              <InlineAlert>{getUserFacingApiError(createComment.error, t)}</InlineAlert>
            ) : null}
            {updateComment.error ? (
              <InlineAlert>{getUserFacingApiError(updateComment.error, t)}</InlineAlert>
            ) : null}
            {deleteComment.error ? (
              <InlineAlert>{getUserFacingApiError(deleteComment.error, t)}</InlineAlert>
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
        <DialogFrame
          description={t("board.delete.description")}
          onClose={() => setConfirmDelete(false)}
          title={t("board.delete.title")}
        >
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
  onReject,
  suggestions,
  suggestionsLoading,
  suggestionsError,
  onSelectSuggestion
}: {
  task: TaskDetail;
  suggestion: AiSuggestion | null;
  suggestions: AiSuggestion[];
  suggestionsLoading: boolean;
  suggestionsError: unknown;
  isImproving: boolean;
  isApplying: boolean;
  isRejecting: boolean;
  improveError: unknown;
  applyError: unknown;
  rejectError: unknown;
  onImprove: () => void;
  onApply: () => void;
  onReject: () => void;
  onSelectSuggestion: (suggestion: AiSuggestion) => void;
}) {
  const { i18n, t } = useTranslation();
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

        <div className="space-y-2 rounded-md border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">{t("board.ai.history")}</h4>
            <span className="text-xs text-muted-foreground">
              {t("board.ai.historyCount", { count: suggestions.length })}
            </span>
          </div>
          {suggestionsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {suggestionsError ? (
            <InlineAlert>{getUserFacingApiError(suggestionsError, t, "ai")}</InlineAlert>
          ) : null}
          {!suggestionsLoading && suggestions.length === 0 ? (
            <EmptyDetailState>{t("board.ai.emptyHistory")}</EmptyDetailState>
          ) : null}
          {suggestions.length > 0 ? (
            <ul className="space-y-2">
              {suggestions.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    aria-pressed={suggestion?.id === candidate.id}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left text-sm transition hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring",
                      suggestion?.id === candidate.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background"
                    )}
                    onClick={() => onSelectSuggestion(candidate)}
                    type="button"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 break-words font-medium">
                        {candidate.suggestedPayload.improvedTitle}
                      </span>
                      <span className="shrink-0 rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">
                        {t(`board.ai.status.${candidate.status}`)}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {candidate.model} / {formatTimestamp(candidate.createdAt, i18n.language)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

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
  onDelete,
  onMove,
  onRename,
  onSubmit,
  onToggle,
  isAdding,
  isDeleting,
  isUpdating,
  addError,
  updateError
}: {
  task: TaskDetail;
  checklistTitle: string;
  onChecklistTitleChange: (value: string) => void;
  onDelete: (itemId: string) => void;
  onMove: (itemId: string, position: number) => void;
  onRename: (itemId: string, title: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onToggle: (itemId: string, isDone: boolean) => void;
  isAdding: boolean;
  isDeleting: boolean;
  isUpdating: boolean;
  addError: unknown;
  updateError: unknown;
}) {
  const { t } = useTranslation();
  const [editingItem, setEditingItem] = React.useState<{ id: string; title: string } | null>(null);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = React.useState<string | null>(null);
  const sortedItems = [...task.checklistItems].sort(
    (left, right) => left.position - right.position
  );

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
      {sortedItems.length > 0 ? (
        <ul className="space-y-2">
          {sortedItems.map((item, index) => {
            const previousItem = sortedItems[index - 1] ?? null;
            const nextItem = sortedItems[index + 1] ?? null;

            return (
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
                <div className="min-w-0 flex-1">
                  {editingItem?.id === item.id ? (
                    <form
                      className="flex flex-col gap-2 sm:flex-row"
                      onSubmit={(event) => {
                        event.preventDefault();

                        if (!editingItem.title.trim()) {
                          return;
                        }

                        onRename(item.id, editingItem.title);
                        setEditingItem(null);
                      }}
                    >
                      <Input
                        aria-label={t("board.detail.editChecklistLabel")}
                        onChange={(event) =>
                          setEditingItem({ id: item.id, title: event.target.value })
                        }
                        value={editingItem.title}
                      />
                      <div className="flex gap-2">
                        <Button disabled={isUpdating} size="sm" type="submit">
                          {t("common.save")}
                        </Button>
                        <Button
                          onClick={() => setEditingItem(null)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {t("common.cancel")}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <span
                      className={cn(
                        "break-words text-sm leading-5",
                        item.isDone ? "text-muted-foreground line-through" : "text-foreground"
                      )}
                    >
                      {item.title}
                    </span>
                  )}
                </div>
                {editingItem?.id !== item.id ? (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      aria-label={t("board.detail.moveChecklistUp")}
                      disabled={isUpdating || !previousItem}
                      onClick={() => {
                        if (previousItem) {
                          onMove(item.id, previousItem.position - 1);
                        }
                      }}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label={t("board.detail.moveChecklistDown")}
                      disabled={isUpdating || !nextItem}
                      onClick={() => {
                        if (nextItem) {
                          onMove(item.id, nextItem.position + 1);
                        }
                      }}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    {confirmDeleteItemId === item.id ? (
                      <>
                        <Button
                          disabled={isDeleting}
                          onClick={() => {
                            onDelete(item.id);
                            setConfirmDeleteItemId(null);
                          }}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          {t("common.delete")}
                        </Button>
                        <Button
                          onClick={() => setConfirmDeleteItemId(null)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {t("common.cancel")}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          aria-label={t("board.detail.editChecklist")}
                          disabled={isUpdating}
                          onClick={() => setEditingItem({ id: item.id, title: item.title })}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          aria-label={t("board.detail.deleteChecklist")}
                          disabled={isDeleting}
                          onClick={() => setConfirmDeleteItemId(item.id)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyDetailState>{t("board.detail.emptyChecklist")}</EmptyDetailState>
      )}
      {addError ? <InlineAlert>{getUserFacingApiError(addError, t)}</InlineAlert> : null}
      {updateError ? <InlineAlert>{getUserFacingApiError(updateError, t)}</InlineAlert> : null}
    </DetailSection>
  );
}

function CommentsSection({
  task,
  commentBody,
  onCommentBodyChange,
  onDelete,
  onEdit,
  onSubmit,
  isAdding,
  isDeleting,
  isUpdating,
  addError,
  updateError
}: {
  task: TaskDetail;
  commentBody: string;
  onCommentBodyChange: (value: string) => void;
  onDelete: (commentId: string) => void;
  onEdit: (commentId: string, body: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isAdding: boolean;
  isDeleting: boolean;
  isUpdating: boolean;
  addError: unknown;
  updateError: unknown;
}) {
  const { i18n, t } = useTranslation();
  const [editingComment, setEditingComment] = React.useState<{
    id: string;
    body: string;
  } | null>(null);
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = React.useState<string | null>(null);

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
              {editingComment?.id === comment.id ? (
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();

                    if (!editingComment.body.trim()) {
                      return;
                    }

                    onEdit(comment.id, editingComment.body);
                    setEditingComment(null);
                  }}
                >
                  <Label className="sr-only" htmlFor={`edit-comment-${comment.id}`}>
                    {t("board.detail.editCommentLabel")}
                  </Label>
                  <Textarea
                    id={`edit-comment-${comment.id}`}
                    onChange={(event) =>
                      setEditingComment({ id: comment.id, body: event.target.value })
                    }
                    value={editingComment.body}
                  />
                  <div className="flex justify-end gap-2">
                    <Button disabled={isUpdating} size="sm" type="submit">
                      {t("common.save")}
                    </Button>
                    <Button
                      onClick={() => setEditingComment(null)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {comment.body}
                  </p>
                  <div className="mt-3 flex flex-wrap justify-end gap-1">
                    {confirmDeleteCommentId === comment.id ? (
                      <>
                        <Button
                          disabled={isDeleting}
                          onClick={() => {
                            onDelete(comment.id);
                            setConfirmDeleteCommentId(null);
                          }}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          {t("common.delete")}
                        </Button>
                        <Button
                          onClick={() => setConfirmDeleteCommentId(null)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {t("common.cancel")}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          aria-label={t("board.detail.editComment")}
                          disabled={isUpdating}
                          onClick={() => setEditingComment({ id: comment.id, body: comment.body })}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          aria-label={t("board.detail.deleteComment")}
                          disabled={isDeleting}
                          onClick={() => setConfirmDeleteCommentId(comment.id)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
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
      {updateError ? <InlineAlert>{getUserFacingApiError(updateError, t)}</InlineAlert> : null}
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
        <h3 className="min-w-0 break-words text-sm font-semibold leading-5">{task.title}</h3>
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
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
              <span
                className="max-w-full rounded bg-secondary px-1.5 py-0.5 text-xs"
                key={label.id}
              >
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
  onEditColumn,
  onOpenTask
}: {
  column: BoardColumn;
  tasks: BoardTaskCard[];
  onCreateTask: (column: BoardColumn) => void;
  onEditColumn: (column: BoardColumn) => void;
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
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 break-words text-sm font-semibold">{column.name}</h2>
          <div className="flex shrink-0 items-center gap-1">
            <span className="rounded bg-secondary px-2 py-1 text-xs text-muted-foreground">
              {t("board.column.taskCount", { count: tasks.length })}
            </span>
            <Button
              aria-label={t("board.columnSettings.open")}
              onClick={() => onEditColumn(column)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
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
  const session = useSession();
  const moveTask = useMoveTaskMutation(boardId);
  const updateColumn = useUpdateBoardColumnMutation(boardId);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [createColumn, setCreateColumn] = React.useState<BoardColumn | null>(null);
  const [editingColumn, setEditingColumn] = React.useState<BoardColumn | null>(null);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<BoardFiltersState>(() => readBoardFiltersFromUrl());
  const [filtersOpen, setFiltersOpen] = React.useState(() => hasActiveBoardFilters(filters));
  const [activeMobileColumnId, setActiveMobileColumnId] = React.useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const hasFilters = hasActiveBoardFilters(filters);

  React.useEffect(() => {
    writeBoardFiltersToUrl(filters);
  }, [filters]);

  React.useEffect(() => {
    if (!board.data) {
      return;
    }

    setActiveMobileColumnId((current) => current ?? board.data.columns[0]?.id ?? null);
  }, [board.data]);

  React.useEffect(() => {
    if (!board.data || filters.columnSystemKey === "all") {
      return;
    }

    const filteredColumn = board.data.columns.find(
      (column) => column.systemKey === filters.columnSystemKey
    );

    if (filteredColumn) {
      setActiveMobileColumnId(filteredColumn.id);
    }
  }, [board.data, filters.columnSystemKey]);

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

  React.useEffect(() => {
    const createFirstTask = () => {
      const targetColumn =
        board.data?.columns.find((column) => column.id === activeMobileColumnId) ??
        board.data?.columns[0];

      if (targetColumn) {
        setCreateColumn(targetColumn);
      }
    };
    const focusSearch = () => {
      setFiltersOpen(true);
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    };
    const clearFilters = () => {
      setFilters(defaultBoardFilters);
      setFiltersOpen(false);
    };

    window.addEventListener(boardCommandEvents.createTask, createFirstTask);
    window.addEventListener(boardCommandEvents.focusSearch, focusSearch);
    window.addEventListener(boardCommandEvents.clearFilters, clearFilters);
    return () => {
      window.removeEventListener(boardCommandEvents.createTask, createFirstTask);
      window.removeEventListener(boardCommandEvents.focusSearch, focusSearch);
      window.removeEventListener(boardCommandEvents.clearFilters, clearFilters);
    };
  }, [activeMobileColumnId, board.data]);

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
  const activeMobileColumn =
    board.data.columns.find((column) => column.id === activeMobileColumnId) ??
    board.data.columns[0] ??
    null;
  const currentUserId =
    session.data?.user &&
    board.data.availableMembers.some((member) => member.id === session.data?.user.id)
      ? session.data.user.id
      : null;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-muted-foreground">
            {board.data.workspace.name} / {board.data.project.name}
          </p>
          <h1 className="mt-1 break-words text-2xl font-semibold">{board.data.name}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            disabled={!board.data.columns[0]}
            onClick={() => {
              const firstColumn = board.data?.columns[0];

              if (firstColumn) {
                setCreateColumn(firstColumn);
              }
            }}
            type="button"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("board.create.button")}
          </Button>
          <p className="w-fit rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
            {t("board.version", { version: board.data.version })}
          </p>
        </div>
      </header>
      {moveTask.error ? (
        <InlineAlert>{getUserFacingApiError(moveTask.error, t)}</InlineAlert>
      ) : null}
      <BoardTips board={board.data} />
      <AiNextActionsPanel board={board.data} />
      <section className="space-y-3">
        <SavedViewsBar
          board={board.data}
          currentUserId={currentUserId}
          filters={filters}
          onApply={(nextFilters) => {
            setFilters(nextFilters);
            setFiltersOpen(hasActiveBoardFilters(nextFilters));
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            onClick={() => setFiltersOpen((current) => !current)}
            type="button"
            variant={hasFilters ? "default" : "outline"}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {filtersOpen ? t("board.filters.hide") : t("board.filters.show")}
          </Button>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {t("board.filters.resultCount", { count: filteredTaskCount, total: totalTaskCount })}
          </p>
        </div>
        {filtersOpen ? (
          <BoardFilterBar
            board={board.data}
            filters={filters}
            onChange={setFilters}
            onReset={() => {
              setFilters(defaultBoardFilters);
              setFiltersOpen(false);
            }}
            resultCount={filteredTaskCount}
            searchInputRef={searchInputRef}
            totalCount={totalTaskCount}
          />
        ) : null}
      </section>
      {hasFilters && filteredTaskCount === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          {t("board.filters.empty")}
        </div>
      ) : null}
      <div className="sticky top-16 z-10 -mx-4 flex gap-2 overflow-x-auto border-y border-border bg-background/95 px-4 py-2 backdrop-blur lg:hidden">
        {board.data.columns.map((column) => (
          <button
            aria-pressed={activeMobileColumn?.id === column.id}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium",
              activeMobileColumn?.id === column.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            )}
            key={column.id}
            onClick={() => setActiveMobileColumnId(column.id)}
            type="button"
          >
            <span>{column.name}</span>
            <span className="rounded bg-background/20 px-1.5 py-0.5 text-xs">
              {(filteredTasksByColumn[column.id] ?? []).length}
            </span>
          </button>
        ))}
      </div>
      <DndContext
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <div className="grid gap-4 lg:hidden">
          {activeMobileColumn ? (
            <BoardColumnView
              column={activeMobileColumn}
              onCreateTask={setCreateColumn}
              onEditColumn={setEditingColumn}
              onOpenTask={setSelectedTaskId}
              tasks={filteredTasksByColumn[activeMobileColumn.id] ?? []}
            />
          ) : null}
        </div>
        <div className="hidden gap-4 lg:flex lg:overflow-x-auto lg:pb-4">
          {board.data.columns.map((column) => (
            <BoardColumnView
              column={column}
              key={column.id}
              onCreateTask={setCreateColumn}
              onEditColumn={setEditingColumn}
              onOpenTask={setSelectedTaskId}
              tasks={filteredTasksByColumn[column.id] ?? []}
            />
          ))}
        </div>
        <DragOverlay>{activeTask ? <TaskCard dragging task={activeTask} /> : null}</DragOverlay>
      </DndContext>
      {editingColumn ? (
        <ColumnSettingsDialog
          column={editingColumn}
          error={updateColumn.error}
          isSaving={updateColumn.isPending}
          onClose={() => setEditingColumn(null)}
          onSubmit={(body) =>
            updateColumn.mutate(
              { columnId: editingColumn.id, body },
              { onSuccess: () => setEditingColumn(null) }
            )
          }
        />
      ) : null}
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
