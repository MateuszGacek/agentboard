import type { SessionResponse } from "@kanban/shared";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  Command,
  FolderKanban,
  KanbanSquare,
  LayoutDashboard,
  type LucideIcon,
  Menu,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  X
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button";
import { LanguageSwitch } from "./language-switch";
import { ThemeSwitch } from "./theme-switch";
import { UserSession } from "./user-session";

type AppShellProps = {
  session: SessionResponse;
};

const navItems = [
  { to: "/app", labelKey: "nav.app", Icon: KanbanSquare },
  { to: "/app/dashboard", labelKey: "nav.dashboard", Icon: LayoutDashboard },
  { to: "/app/workspaces", labelKey: "nav.workspaces", Icon: BriefcaseBusiness },
  { to: "/app/projects", labelKey: "nav.projects", Icon: FolderKanban },
  { to: "/app/settings", labelKey: "nav.settings", Icon: Settings }
] as const;

const boardCommandEvents = {
  createTask: "kanban:board-create-task",
  focusSearch: "kanban:board-focus-search",
  clearFilters: "kanban:board-clear-filters"
} as const;

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();

  return (
    <nav className="space-y-1" aria-label={t("shell.mobileMenu")}>
      {navItems.map(({ to, labelKey, Icon }) => (
        <Link
          activeProps={{
            className: "bg-secondary text-foreground shadow-sm"
          }}
          className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          key={to}
          onClick={onNavigate}
          to={to}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {t(labelKey)}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ session }: AppShellProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const mobileTitleId = React.useId();
  const commandTitleId = React.useId();
  const activeWorkspace =
    session.workspaces.find((workspace) => workspace.id === session.activeWorkspaceId) ??
    session.workspaces[0] ??
    null;

  React.useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }

      if (event.key === "Escape") {
        setCommandOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const currentPath = typeof window === "undefined" ? "" : window.location.pathname;
  const isBoardRoute = /^\/app\/boards\/[^/]+$/.test(currentPath);
  const runCommand = (command: () => void) => {
    command();
    setCommandOpen(false);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card px-4 py-5 lg:block">
        <div className="mb-7 space-y-4">
          <div>
            <p className="text-base font-semibold">{t("app.name")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("app.tagline")}</p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {t("shell.workspaceLabel")}
            </p>
            <p className="mt-1 truncate text-sm font-semibold">
              {activeWorkspace?.name ?? t("shell.workspaceFallback")}
            </p>
            {activeWorkspace?.isDemo ? (
              <span className="mt-2 inline-flex rounded-full bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
                {t("shell.demoWorkspace")}
              </span>
            ) : null}
          </div>
        </div>
        <SidebarNav />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label={t("nav.closeMenu")}
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
          <div
            aria-labelledby={mobileTitleId}
            aria-modal="true"
            className="relative flex h-full w-[min(21rem,calc(100vw-2rem))] flex-col border-r border-border bg-card p-4 shadow-shell"
            role="dialog"
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold" id={mobileTitleId}>
                  {t("shell.mobileMenu")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {activeWorkspace?.name ?? t("shell.workspaceFallback")}
                </p>
              </div>
              <Button
                aria-label={t("nav.closeMenu")}
                onClick={() => setMobileOpen(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
            <div className="mt-auto space-y-3 pt-6">
              <LanguageSwitch />
              <ThemeSwitch />
              <UserSession session={session} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-2 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              aria-label={t("nav.openMenu")}
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{t("shell.topbarTitle")}</p>
              <p className="truncate text-xs text-muted-foreground">
                {activeWorkspace?.name ?? t("shell.workspaceFallback")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              aria-label={t("command.open")}
              onClick={() => setCommandOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Command className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t("command.label")}</span>
            </Button>
            <div className="hidden md:block">
              <LanguageSwitch />
            </div>
            <div className="hidden md:block">
              <ThemeSwitch />
            </div>
            <UserSession session={session} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
          <Outlet />
        </main>
      </div>
      {commandOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/35 p-3 pt-20 backdrop-blur-sm">
          <section
            aria-labelledby={commandTitleId}
            aria-modal="true"
            className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-card shadow-shell"
            role="dialog"
          >
            <header className="flex items-center justify-between gap-3 border-b border-border p-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold" id={commandTitleId}>
                  {t("command.title")}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">{t("command.shortcut")}</p>
              </div>
              <Button
                aria-label={t("common.close")}
                onClick={() => setCommandOpen(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </header>
            <div className="grid gap-1 p-2">
              <CommandButton
                Icon={LayoutDashboard}
                label={t("command.dashboard")}
                onClick={() => runCommand(() => void navigate({ to: "/app/dashboard" }))}
              />
              <CommandButton
                Icon={FolderKanban}
                label={t("command.projects")}
                onClick={() => runCommand(() => void navigate({ to: "/app/projects" }))}
              />
              <CommandButton
                Icon={BriefcaseBusiness}
                label={t("command.workspaces")}
                onClick={() => runCommand(() => void navigate({ to: "/app/workspaces" }))}
              />
              <CommandButton
                Icon={Settings}
                label={t("command.settings")}
                onClick={() => runCommand(() => void navigate({ to: "/app/settings" }))}
              />
              <div className="my-1 border-t border-border" />
              <CommandButton
                Icon={KanbanSquare}
                disabled={!isBoardRoute}
                label={t("command.currentBoard")}
                onClick={() => runCommand(() => undefined)}
              />
              <CommandButton
                Icon={Plus}
                disabled={!isBoardRoute}
                label={t("command.createTask")}
                onClick={() =>
                  runCommand(() => window.dispatchEvent(new Event(boardCommandEvents.createTask)))
                }
              />
              <CommandButton
                Icon={Search}
                disabled={!isBoardRoute}
                label={t("command.focusSearch")}
                onClick={() =>
                  runCommand(() => window.dispatchEvent(new Event(boardCommandEvents.focusSearch)))
                }
              />
              <CommandButton
                Icon={SlidersHorizontal}
                disabled={!isBoardRoute}
                label={t("command.clearFilters")}
                onClick={() =>
                  runCommand(() => window.dispatchEvent(new Event(boardCommandEvents.clearFilters)))
                }
              />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function CommandButton({
  Icon,
  label,
  onClick,
  disabled
}: {
  Icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{label}</span>
    </button>
  );
}
