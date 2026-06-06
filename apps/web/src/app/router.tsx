import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { AuthPage } from "../features/auth/auth-page";
import { useSession } from "../features/auth/auth-queries";
import { ProtectedRoute } from "../features/auth/protected-route";
import { BoardPage } from "../features/boards/board-page";
import { DashboardPage } from "../features/dashboard/dashboard-page";
import { PlaceholderPage } from "../features/placeholders/placeholder-page";
import { HomePage } from "../routes/home-page";

function RootRouteComponent() {
  return <Outlet />;
}

function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="max-w-md rounded-lg border border-border bg-card p-6 shadow-shell">
        <h1 className="text-xl font-semibold">{t("pages.notFound.title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("pages.notFound.description")}
        </p>
      </div>
    </main>
  );
}

const rootRoute = createRootRoute({
  component: RootRouteComponent,
  notFoundComponent: NotFoundPage
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: () => <AuthPage mode="login" />
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: () => <AuthPage mode="register" />
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  component: ProtectedRoute
});

const appIndexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: () => (
    <PlaceholderPage titleKey="pages.app.title" descriptionKey="pages.app.description" />
  )
});

const workspacesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "workspaces",
  component: () => (
    <PlaceholderPage
      titleKey="pages.workspaces.title"
      descriptionKey="pages.workspaces.description"
    />
  )
});

const projectsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "projects",
  component: () => (
    <PlaceholderPage titleKey="pages.projects.title" descriptionKey="pages.projects.description" />
  )
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "settings",
  component: () => (
    <PlaceholderPage titleKey="pages.settings.title" descriptionKey="pages.settings.description" />
  )
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "dashboard",
  component: DashboardRouteComponent
});

const boardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "boards/$boardId",
  component: BoardRouteComponent
});

function DashboardRouteComponent() {
  const session = useSession();
  const activeWorkspaceId =
    session.data?.activeWorkspaceId ?? session.data?.workspaces[0]?.id ?? null;

  return <DashboardPage workspaceId={activeWorkspaceId} />;
}

function BoardRouteComponent() {
  const { boardId } = boardRoute.useParams();
  return <BoardPage boardId={boardId} />;
}

const routeTree = rootRoute.addChildren([
  homeRoute,
  loginRoute,
  registerRoute,
  appRoute.addChildren([
    appIndexRoute,
    dashboardRoute,
    workspacesRoute,
    projectsRoute,
    settingsRoute,
    boardRoute
  ])
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
