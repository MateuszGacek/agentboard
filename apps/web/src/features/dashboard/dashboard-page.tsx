import type { DashboardMetrics, TaskPriority } from "@kanban/shared";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Copy,
  FileText,
  FolderKanban,
  Gauge,
  KanbanSquare,
  ListTodo
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../../components/ui/card";
import { InlineAlert } from "../../components/ui/inline-alert";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { ApiClientError } from "../../lib/api-client";
import { getUserFacingApiError } from "../../lib/api-errors";
import { cn } from "../../lib/utils";
import { useProjects } from "../projects/project-queries";
import { useDashboard, useWeeklyReport } from "./dashboard-queries";

type DashboardPageProps = {
  workspaceId: string | null;
  projectId?: string | null;
};

const metricIcons = {
  totalActiveTasks: ListTodo,
  completedTasks: CheckCircle2,
  overdueTasks: Clock3,
  blockedTasks: AlertTriangle,
  completionRate: Gauge
} as const;

const priorityTone: Record<TaskPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-secondary text-secondary-foreground",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  urgent: "bg-destructive/15 text-destructive"
};

function boardHref(boardId: string, filters: Record<string, string | null | undefined> = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return `/app/boards/${boardId}${query ? `?${query}` : ""}`;
}

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    month: "short",
    day: "numeric"
  }).format(new Date(`${value}T00:00:00Z`));
}

function LoadingDashboard() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton className="h-32 w-full" key={index} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}

function EmptyDashboard() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.empty.title")}</CardTitle>
        <CardDescription>{t("dashboard.empty.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          to="/app/projects"
        >
          <FolderKanban className="h-4 w-4" aria-hidden="true" />
          {t("dashboard.empty.action")}
        </Link>
      </CardContent>
    </Card>
  );
}

function metricFilterForCard(key: DashboardMetrics["metricCards"][number]["key"]) {
  if (key === "overdueTasks") return { due: "overdue" };
  if (key === "blockedTasks") return { blocked: "blocked" };
  return {};
}

function MetricCards({
  dashboard,
  boardId
}: {
  dashboard: DashboardMetrics;
  boardId: string | null;
}) {
  const { t } = useTranslation();

  return (
    <section
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      aria-label={t("dashboard.metrics")}
    >
      {dashboard.metricCards.map((card) => {
        const Icon = metricIcons[card.key];

        return (
          <a
            className={cn(
              "block rounded-lg focus-visible:ring-2 focus-visible:ring-ring",
              !boardId ? "pointer-events-none" : null
            )}
            href={boardId ? boardHref(boardId, metricFilterForCard(card.key)) : undefined}
            key={card.key}
          >
            <Card className="h-full border-border/80 shadow-sm transition hover:-translate-y-0.5 hover:shadow-shell">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4 pb-2">
                <CardDescription className="font-medium">
                  {t(`dashboard.cards.${card.key}`)}
                </CardDescription>
                <span className="rounded-md bg-muted p-2">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </span>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-3xl font-semibold tracking-normal">{card.displayValue}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {card.helper ?? t(`dashboard.cards.${card.key}Helper`)}
                </p>
              </CardContent>
            </Card>
          </a>
        );
      })}
    </section>
  );
}

function WipWarnings({ dashboard }: { dashboard: DashboardMetrics }) {
  const { t } = useTranslation();

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.wip.title")}</CardTitle>
        <CardDescription>{t("dashboard.wip.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {dashboard.wipLimitWarnings.length > 0 ? (
          <ul className="space-y-3">
            {dashboard.wipLimitWarnings.map((warning) => (
              <li key={warning.columnId}>
                <a
                  className="block rounded-md border border-amber-500/25 bg-amber-500/10 p-3 transition hover:bg-amber-500/15 focus-visible:ring-2 focus-visible:ring-ring"
                  href={boardHref(warning.boardId, { column: warning.systemKey })}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{warning.columnName}</p>
                    <span className="rounded-full bg-background px-2 py-1 text-xs text-muted-foreground">
                      {t("dashboard.wip.count", {
                        count: warning.count,
                        limit: warning.limit
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("dashboard.wip.context", {
                      board: warning.boardName,
                      project: warning.projectName,
                      overBy: warning.overBy
                    })}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-sm leading-6 text-muted-foreground">
            {t("dashboard.wip.empty")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PriorityBreakdown({ dashboard }: { dashboard: DashboardMetrics }) {
  const { t } = useTranslation();
  const max = Math.max(...dashboard.tasksByPriority.map((item) => item.count), 1);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.priority.title")}</CardTitle>
        <CardDescription>{t("dashboard.priority.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {dashboard.tasksByPriority.map((item) => (
            <li className="space-y-2" key={item.priority}>
              <a
                className="block rounded-md p-1 transition hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                href={
                  dashboard.tasksByColumn[0]?.boardId
                    ? boardHref(dashboard.tasksByColumn[0].boardId, { priority: item.priority })
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span
                    className={cn("rounded-full px-2 py-1 text-xs", priorityTone[item.priority])}
                  >
                    {t(`board.priority.${item.priority}`)}
                  </span>
                  <span className="font-medium">{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: `${(item.count / max) * 100}%` }}
                  />
                </div>
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ColumnBreakdown({ dashboard }: { dashboard: DashboardMetrics }) {
  const { t } = useTranslation();
  const max = Math.max(...dashboard.tasksByColumn.map((column) => column.activeCount), 1);

  return (
    <Card className="min-w-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.columns.title")}</CardTitle>
        <CardDescription>{t("dashboard.columns.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {dashboard.tasksByColumn.length > 0 ? (
          <ul className="space-y-3">
            {dashboard.tasksByColumn.map((column) => (
              <li className="space-y-2" key={column.columnId}>
                <a
                  className="block rounded-md p-1 transition hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                  href={boardHref(column.boardId, { column: column.systemKey })}
                >
                  <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-medium">{column.columnName}</p>
                      <p className="break-words text-xs text-muted-foreground">
                        {column.boardName} / {column.projectName}
                      </p>
                    </div>
                    <span className="w-fit shrink-0 text-sm font-medium">
                      {t("dashboard.columns.activeCount", { count: column.activeCount })}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(column.activeCount / max) * 100}%` }}
                    />
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-sm leading-6 text-muted-foreground">
            {t("dashboard.columns.empty")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DueSoon({ dashboard }: { dashboard: DashboardMetrics }) {
  const { i18n, t } = useTranslation();

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.dueSoon.title")}</CardTitle>
        <CardDescription>{t("dashboard.dueSoon.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {dashboard.dueSoonTasks.length > 0 ? (
          <ul className="divide-y divide-border">
            {dashboard.dueSoonTasks.map((task) => (
              <li key={task.id}>
                <a
                  className="flex items-start justify-between gap-3 rounded-md py-3 transition hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                  href={boardHref(task.boardId, { due: "week" })}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {task.columnName} / {task.projectName}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-xs font-medium">
                      {formatDate(task.dueDate, i18n.language)}
                    </span>
                    {task.isBlocked ? (
                      <span className="rounded-full bg-destructive/15 px-2 py-1 text-xs text-destructive">
                        {t("dashboard.dueSoon.blocked")}
                      </span>
                    ) : null}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-sm leading-6 text-muted-foreground">
            {t("dashboard.dueSoon.empty")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivity({ dashboard }: { dashboard: DashboardMetrics }) {
  const { i18n, t } = useTranslation();

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <CardTitle className="text-base">{t("dashboard.activity.title")}</CardTitle>
        </div>
        <CardDescription>{t("dashboard.activity.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {dashboard.recentActivity.length > 0 ? (
          <ul className="space-y-3">
            {dashboard.recentActivity.map((event) => (
              <li className="rounded-md border border-border bg-background p-3" key={event.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{event.taskTitle}</p>
                  <span className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(i18n.language, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    }).format(new Date(event.createdAt))}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`board.activity.${event.type}`)}{" "}
                  {event.actor?.name ?? t("board.detail.system")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-sm leading-6 text-muted-foreground">
            {t("dashboard.activity.empty")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WeeklyReport({
  projectId,
  workspaceId
}: {
  workspaceId: string;
  projectId?: string | null;
}) {
  const { t } = useTranslation();
  const report = useWeeklyReport(workspaceId, projectId);
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!report.data) {
      return;
    }

    await navigator.clipboard.writeText(report.data.summaryMarkdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-base">{t("dashboard.weekly.title")}</CardTitle>
            </div>
            <CardDescription>{t("dashboard.weekly.description")}</CardDescription>
          </div>
          <Button
            disabled={!report.data}
            onClick={() => void handleCopy()}
            size="sm"
            type="button"
            variant="outline"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            {copied ? t("dashboard.weekly.copied") : t("dashboard.weekly.copy")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {report.isLoading ? <Skeleton className="h-28 w-full" /> : null}
        {report.error ? <InlineAlert>{getUserFacingApiError(report.error, t)}</InlineAlert> : null}
        {report.data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["newTasksCount", report.data.newTasksCount],
                ["completedTasksCount", report.data.completedTasksCount],
                ["blockedTasksCount", report.data.blockedTasksCount],
                ["overdueTasksCount", report.data.overdueTasksCount],
                ["aiSuggestionsCount", report.data.aiSuggestionsCount]
              ].map(([key, value]) => (
                <div className="rounded-md border border-border bg-background p-3" key={key}>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    {t(`dashboard.weekly.metrics.${key}`)}
                  </p>
                  <p className="mt-1 text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <pre className="max-h-56 max-w-full whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
              {report.data.summaryMarkdown}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DashboardPage({ projectId, workspaceId }: DashboardPageProps) {
  const { t } = useTranslation();
  const dashboard = useDashboard(workspaceId, projectId);
  const projects = useProjects(workspaceId);
  const activeProject = projects.data?.projects.find((project) => project.id === projectId) ?? null;

  if (!workspaceId) {
    return <InlineAlert>{t("dashboard.errors.noWorkspace")}</InlineAlert>;
  }

  if (dashboard.isLoading) {
    return <LoadingDashboard />;
  }

  if (dashboard.error) {
    if (
      dashboard.error instanceof ApiClientError &&
      dashboard.error.code === "SERVICE_UNAVAILABLE"
    ) {
      return (
        <InlineAlert>
          {t("dashboard.errors.dbUnavailable", { requestId: dashboard.error.requestId })}
        </InlineAlert>
      );
    }

    return <InlineAlert>{getUserFacingApiError(dashboard.error, t)}</InlineAlert>;
  }

  if (!dashboard.data) {
    return <InlineAlert>{t("dashboard.errors.emptyResponse")}</InlineAlert>;
  }

  const metricTargetBoard =
    activeProject?.primaryBoard ??
    (projects.data?.projects ?? []).find((project) => project.primaryBoard)?.primaryBoard ??
    null;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium text-accent">{t("dashboard.eyebrow")}</p>
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <h1 className="text-3xl font-semibold tracking-normal">{t("dashboard.title")}</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {projectId && activeProject
                ? t("dashboard.projectSubtitle", { project: activeProject.name })
                : t("dashboard.subtitle")}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="dashboard-project">{t("dashboard.projectFilter.label")}</Label>
              <Select
                id="dashboard-project"
                onChange={(event) => {
                  const nextProjectId = event.target.value;
                  window.location.href = nextProjectId
                    ? `/app/dashboard?projectId=${nextProjectId}`
                    : "/app/dashboard";
                }}
                value={projectId ?? ""}
              >
                <option value="">{t("dashboard.projectFilter.all")}</option>
                {(projects.data?.projects ?? [])
                  .filter((project) => project.status === "active")
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
              </Select>
            </div>
            {activeProject?.primaryBoard ? (
              <Link
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium transition hover:bg-muted active:scale-[0.99]"
                params={{ boardId: activeProject.primaryBoard.id }}
                to="/app/boards/$boardId"
              >
                <KanbanSquare className="h-4 w-4" aria-hidden="true" />
                {t("dashboard.projectFilter.openBoard")}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {dashboard.data.totalRelevantTasks === 0 ? (
        <EmptyDashboard />
      ) : (
        <>
          <MetricCards boardId={metricTargetBoard?.id ?? null} dashboard={dashboard.data} />
          <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <WipWarnings dashboard={dashboard.data} />
            <PriorityBreakdown dashboard={dashboard.data} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <ColumnBreakdown dashboard={dashboard.data} />
            <DueSoon dashboard={dashboard.data} />
          </div>
          <WeeklyReport projectId={projectId ?? null} workspaceId={workspaceId} />
          <RecentActivity dashboard={dashboard.data} />
        </>
      )}
    </div>
  );
}
