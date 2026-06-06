import { Link, Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { LanguageSwitch } from "../components/layout/language-switch";
import { ThemeSwitch } from "../components/layout/theme-switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { useSession } from "../features/auth/auth-queries";
import { cn } from "../lib/utils";

const actionLinkClassName =
  "inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors";

export function HomePage() {
  const { t } = useTranslation();
  const session = useSession();

  if (session.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <Skeleton className="h-72 w-full max-w-lg" />
      </main>
    );
  }

  if (session.data) {
    return <Navigate to="/app" replace />;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5">
        <header className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{t("app.name")}</p>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <ThemeSwitch />
          </div>
        </header>
        <section className="flex flex-1 items-center py-10">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle className="text-3xl">{t("pages.home.title")}</CardTitle>
              <CardDescription>{t("pages.home.description")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Link
                className={cn(
                  actionLinkClassName,
                  "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                to="/login"
              >
                {t("pages.home.primaryAction")}
              </Link>
              <Link
                className={cn(
                  actionLinkClassName,
                  "border border-border bg-background hover:bg-muted"
                )}
                to="/register"
              >
                {t("pages.home.secondaryAction")}
              </Link>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
