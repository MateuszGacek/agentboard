import type {
  CurrentWorkspace,
  ProjectStatus,
  ProjectTemplateKey,
  ProjectTemplateSummary,
  WorkspaceProject
} from "@kanban/shared";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Archive,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  FolderKanban,
  KanbanSquare,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  X
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
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Skeleton } from "../../components/ui/skeleton";
import { Textarea } from "../../components/ui/textarea";
import { getUserFacingApiError } from "../../lib/api-errors";
import { cn } from "../../lib/utils";
import {
  useCreateProjectMutation,
  useProjects,
  useProjectTemplates,
  useUpdateProjectMutation
} from "./project-queries";

type ProjectsPageProps = {
  workspace: CurrentWorkspace | null;
  mode?: "overview" | "projects";
};

type ProjectFormState = {
  name: string;
  description: string;
  templateKey: ProjectTemplateKey;
};

const emptyForm: ProjectFormState = {
  name: "",
  description: "",
  templateKey: "ai-agency-delivery"
};

function formatTimestamp(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function splitProjects(projects: WorkspaceProject[]) {
  return {
    active: projects.filter((project) => project.status === "active"),
    archived: projects.filter((project) => project.status === "archived")
  };
}

function WorkspaceEmptyState({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation();

  return (
    <Card className="animate-enter border-dashed">
      <CardHeader>
        <CardTitle>{t("projects.empty.title")}</CardTitle>
        <CardDescription>{t("projects.empty.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onCreate} type="button">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("projects.actions.create")}
        </Button>
      </CardContent>
    </Card>
  );
}

function ProjectDialog({
  initialProject,
  isSaving,
  onClose,
  onSubmit,
  templates,
  error
}: {
  initialProject?: WorkspaceProject;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (form: ProjectFormState) => void;
  templates: ProjectTemplateSummary[];
  error: unknown;
}) {
  const { t } = useTranslation();
  const titleId = React.useId();
  const descriptionId = React.useId();
  const [form, setForm] = React.useState<ProjectFormState>(() =>
    initialProject
      ? {
          name: initialProject.name,
          description: initialProject.description ?? "",
          templateKey: "blank"
        }
      : emptyForm
  );
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setLocalError(t("validation.required"));
      return;
    }

    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-sm">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-lg animate-dialog-in overflow-hidden rounded-lg border border-border bg-card shadow-shell"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold" id={titleId}>
              {initialProject ? t("projects.dialog.editTitle") : t("projects.dialog.createTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground" id={descriptionId}>
              {t("projects.dialog.description")}
            </p>
          </div>
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
        <form className="space-y-4 p-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="project-name">{t("projects.fields.name")}</Label>
            <Input
              autoFocus
              id="project-name"
              onChange={(event) => {
                setForm((current) => ({ ...current, name: event.target.value }));
                setLocalError(null);
              }}
              placeholder={t("projects.fields.namePlaceholder")}
              value={form.name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">{t("projects.fields.description")}</Label>
            <Textarea
              id="project-description"
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder={t("projects.fields.descriptionPlaceholder")}
              value={form.description}
            />
          </div>
          {!initialProject ? (
            <div className="space-y-3">
              <div>
                <Label>{t("projects.templates.label")}</Label>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("projects.templates.description")}
                </p>
              </div>
              <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {templates.map((template) => {
                  const selected = form.templateKey === template.key;

                  return (
                    <button
                      aria-pressed={selected}
                      className={cn(
                        "min-h-28 rounded-md border p-3 text-left text-sm transition focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:bg-muted/60"
                      )}
                      key={template.key}
                      onClick={() =>
                        setForm((current) => ({ ...current, templateKey: template.key }))
                      }
                      type="button"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-medium">{template.name}</span>
                        {template.recommended ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                            <Sparkles className="h-3 w-3" aria-hidden="true" />
                            {t("projects.templates.recommended")}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                        {template.description}
                      </span>
                      <span className="mt-2 block text-xs font-medium text-muted-foreground">
                        {t("projects.templates.taskCount", { count: template.taskCount })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {localError ? <InlineAlert>{localError}</InlineAlert> : null}
          {error ? <InlineAlert>{getUserFacingApiError(error, t)}</InlineAlert> : null}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} type="button" variant="outline">
              {t("common.cancel")}
            </Button>
            <Button disabled={isSaving} type="submit">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {initialProject ? t("common.save") : t("projects.actions.create")}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const { t } = useTranslation();

  return (
    <span
      className={cn(
        "inline-flex w-fit rounded-full border px-2 py-1 text-xs font-medium",
        status === "active"
          ? "border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300"
          : "border-border bg-muted text-muted-foreground"
      )}
    >
      {t(`projects.status.${status}`)}
    </span>
  );
}

function ProjectCard({
  project,
  onEdit,
  onStatusChange
}: {
  project: WorkspaceProject;
  onEdit: (project: WorkspaceProject) => void;
  onStatusChange: (project: WorkspaceProject, status: ProjectStatus) => void;
}) {
  const { i18n, t } = useTranslation();
  const primaryBoard = project.primaryBoard;

  return (
    <article className="animate-enter rounded-lg border border-border bg-card p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-shell">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words text-lg font-semibold">{project.name}</h2>
            <StatusBadge status={project.status} />
          </div>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {project.description || t("projects.card.noDescription")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("projects.card.updated", {
              date: formatTimestamp(project.updatedAt, i18n.language)
            })}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button onClick={() => onEdit(project)} size="sm" type="button" variant="outline">
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {t("projects.actions.edit")}
          </Button>
          <Button
            onClick={() =>
              onStatusChange(project, project.status === "archived" ? "active" : "archived")
            }
            size="sm"
            type="button"
            variant="outline"
          >
            {project.status === "archived" ? (
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Archive className="h-4 w-4" aria-hidden="true" />
            )}
            {project.status === "archived"
              ? t("projects.actions.restore")
              : t("projects.actions.archive")}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {t("projects.card.board")}
          </p>
          <p className="mt-1 truncate text-sm font-semibold">
            {primaryBoard?.name ?? t("projects.card.noBoard")}
          </p>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {t("projects.card.tasks")}
          </p>
          <p className="mt-1 text-sm font-semibold">{primaryBoard ? primaryBoard.taskCount : 0}</p>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {t("projects.card.activeTasks")}
          </p>
          <p className="mt-1 text-sm font-semibold">
            {primaryBoard ? primaryBoard.activeTaskCount : 0}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {primaryBoard ? (
          <Link
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 active:scale-[0.99]"
            params={{ boardId: primaryBoard.id }}
            to="/app/boards/$boardId"
          >
            <KanbanSquare className="h-4 w-4" aria-hidden="true" />
            {t("projects.actions.openBoard")}
          </Link>
        ) : null}
        <a
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition hover:bg-muted active:scale-[0.99]"
          href={`/app/dashboard?projectId=${project.id}`}
        >
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          {t("projects.actions.dashboard")}
        </a>
      </div>
    </article>
  );
}

function ProjectList({
  projects,
  onEdit,
  onStatusChange
}: {
  projects: WorkspaceProject[];
  onEdit: (project: WorkspaceProject) => void;
  onStatusChange: (project: WorkspaceProject, status: ProjectStatus) => void;
}) {
  return (
    <div className="grid gap-4">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          onEdit={onEdit}
          onStatusChange={onStatusChange}
          project={project}
        />
      ))}
    </div>
  );
}

function ProjectSkeletons() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-52 w-full" />
      <Skeleton className="h-52 w-full" />
    </div>
  );
}

export function ProjectsPage({ workspace, mode = "projects" }: ProjectsPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const projects = useProjects(workspace?.id ?? null);
  const templates = useProjectTemplates();
  const createProject = useCreateProjectMutation(workspace?.id ?? null);
  const updateProject = useUpdateProjectMutation(workspace?.id ?? null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingProject, setEditingProject] = React.useState<WorkspaceProject | null>(null);

  if (!workspace) {
    return <InlineAlert>{t("projects.errors.noWorkspace")}</InlineAlert>;
  }

  const projectData = projects.data?.projects ?? [];
  const { active, archived } = splitProjects(projectData);
  const firstBoard = active.find((project) => project.primaryBoard)?.primaryBoard ?? null;

  return (
    <div className="space-y-5">
      <header className="animate-enter flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-accent">
            {mode === "overview" ? (
              <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
            ) : (
              <FolderKanban className="h-4 w-4" aria-hidden="true" />
            )}
            {workspace.name}
          </p>
          <h1 className="break-words text-2xl font-semibold">
            {mode === "overview" ? t("workspace.title") : t("projects.title")}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {mode === "overview" ? t("workspace.subtitle") : t("projects.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {firstBoard ? (
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium transition hover:bg-muted active:scale-[0.99]"
              params={{ boardId: firstBoard.id }}
              to="/app/boards/$boardId"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              {t("workspace.actions.continueBoard")}
            </Link>
          ) : null}
          <Button onClick={() => setCreateOpen(true)} type="button">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("projects.actions.create")}
          </Button>
        </div>
      </header>

      {mode === "overview" ? (
        <section className="grid gap-3 md:grid-cols-3">
          <Card className="animate-enter">
            <CardHeader className="p-4">
              <CardDescription>{t("workspace.metrics.activeProjects")}</CardDescription>
              <CardTitle>{active.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="animate-enter">
            <CardHeader className="p-4">
              <CardDescription>{t("workspace.metrics.totalTasks")}</CardDescription>
              <CardTitle>
                {projectData.reduce(
                  (count, project) => count + (project.primaryBoard?.taskCount ?? 0),
                  0
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="animate-enter">
            <CardHeader className="p-4">
              <CardDescription>{t("workspace.metrics.activeTasks")}</CardDescription>
              <CardTitle>
                {projectData.reduce(
                  (count, project) => count + (project.primaryBoard?.activeTaskCount ?? 0),
                  0
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        </section>
      ) : null}

      {projects.isLoading ? <ProjectSkeletons /> : null}
      {projects.error ? (
        <InlineAlert>{getUserFacingApiError(projects.error, t)}</InlineAlert>
      ) : null}

      {!projects.isLoading && projectData.length === 0 ? (
        <WorkspaceEmptyState onCreate={() => setCreateOpen(true)} />
      ) : null}

      {active.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-semibold">{t("projects.sections.active")}</h2>
          </div>
          <ProjectList
            onEdit={setEditingProject}
            onStatusChange={(project, status) =>
              updateProject.mutate({ projectId: project.id, body: { status } })
            }
            projects={active}
          />
        </section>
      ) : null}

      {archived.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-semibold">{t("projects.sections.archived")}</h2>
          </div>
          <ProjectList
            onEdit={setEditingProject}
            onStatusChange={(project, status) =>
              updateProject.mutate({ projectId: project.id, body: { status } })
            }
            projects={archived}
          />
        </section>
      ) : null}

      {updateProject.error ? (
        <InlineAlert>{getUserFacingApiError(updateProject.error, t)}</InlineAlert>
      ) : null}

      {createOpen ? (
        <ProjectDialog
          error={createProject.error}
          isSaving={createProject.isPending}
          onClose={() => setCreateOpen(false)}
          onSubmit={(form) =>
            createProject.mutate(
              {
                name: form.name,
                description: form.description.trim() ? form.description : null,
                templateKey: form.templateKey
              },
              {
                onSuccess: ({ project }) => {
                  setCreateOpen(false);

                  if (project.primaryBoard) {
                    void navigate({
                      to: "/app/boards/$boardId",
                      params: { boardId: project.primaryBoard.id }
                    });
                  }
                }
              }
            )
          }
          templates={templates.data?.templates ?? []}
        />
      ) : null}

      {editingProject ? (
        <ProjectDialog
          error={updateProject.error}
          initialProject={editingProject}
          isSaving={updateProject.isPending}
          onClose={() => setEditingProject(null)}
          onSubmit={(form) =>
            updateProject.mutate(
              {
                projectId: editingProject.id,
                body: {
                  name: form.name,
                  description: form.description.trim() ? form.description : null
                }
              },
              { onSuccess: () => setEditingProject(null) }
            )
          }
          templates={templates.data?.templates ?? []}
        />
      ) : null}
    </div>
  );
}
