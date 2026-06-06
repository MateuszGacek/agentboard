import type { SessionResponse } from "@agentboard/shared";
import { Link, Outlet } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  FolderKanban,
  KanbanSquare,
  LayoutDashboard,
  Menu,
  Settings,
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
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const mobileTitleId = React.useId();
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
    </div>
  );
}
