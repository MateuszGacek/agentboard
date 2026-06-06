import type { DashboardMetrics, TaskPriority } from "@agentboard/shared";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Gauge, ListTodo } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../../components/ui/card";
import { InlineAlert } from "../../components/ui/inline-alert";
import { Skeleton } from "../../components/ui/skeleton";
import { ApiClientError } from "../../lib/api-client";
import { getUserFacingApiError } from "../../lib/api-errors";
import { cn } from "../../lib/utils";
import { useDashboard } from "./dashboard-queries";

type DashboardPageProps = {
  workspaceId: string | null;
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
    </Card>
  );
}

function MetricCards({ dashboard }: { dashboard: DashboardMetrics }) {
  const { t } = useTranslation();

  return (
    <section
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      aria-label={t("dashboard.metrics")}
    >
      {dashboard.metricCards.map((card) => {
        const Icon = metricIcons[card.key];

        return (
          <Card
            className="border-border/80 shadow-sm transition hover:-translate-y-0.5 hover:shadow-shell"
            key={card.key}
          >
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
              <li
                className="rounded-md border border-amber-500/25 bg-amber-500/10 p-3"
                key={warning.columnId}
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
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className={cn("rounded-full px-2 py-1 text-xs", priorityTone[item.priority])}>
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
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.columns.title")}</CardTitle>
        <CardDescription>{t("dashboard.columns.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {dashboard.tasksByColumn.length > 0 ? (
          <ul className="space-y-3">
            {dashboard.tasksByColumn.map((column) => (
              <li className="space-y-2" key={column.columnId}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{column.columnName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {column.boardName} / {column.projectName}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium">
                    {t("dashboard.columns.activeCount", { count: column.activeCount })}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${(column.activeCount / max) * 100}%` }}
                  />
                </div>
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
              <li className="flex items-start justify-between gap-3 py-3 first:pt-0" key={task.id}>
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

export function DashboardPage({ workspaceId }: DashboardPageProps) {
  const { t } = useTranslation();
  const dashboard = useDashboard(workspaceId);

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

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium text-accent">{t("dashboard.eyebrow")}</p>
        <div className="max-w-3xl space-y-2">
          <h1 className="text-3xl font-semibold tracking-normal">{t("dashboard.title")}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
      </section>

      {dashboard.data.totalRelevantTasks === 0 ? (
        <EmptyDashboard />
      ) : (
        <>
          <MetricCards dashboard={dashboard.data} />
          <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <WipWarnings dashboard={dashboard.data} />
            <PriorityBreakdown dashboard={dashboard.data} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <ColumnBreakdown dashboard={dashboard.data} />
            <DueSoon dashboard={dashboard.data} />
          </div>
          <RecentActivity dashboard={dashboard.data} />
        </>
      )}
    </div>
  );
}
