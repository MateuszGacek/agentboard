import { Link, Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { LanguageSwitch } from "../components/layout/language-switch";
import { ThemeSwitch } from "../components/layout/theme-switch";
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
        <header className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">{t("app.name")}</p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <LanguageSwitch />
            <ThemeSwitch />
          </div>
        </header>
        <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1fr_0.8fr]">
          <div className="max-w-2xl space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-accent">{t("pages.home.kicker")}</p>
              <h1 className="text-4xl font-semibold tracking-normal sm:text-5xl">
                {t("pages.home.title")}
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                {t("pages.home.description")}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
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
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 shadow-shell">
            <div className="space-y-3">
              {["proofBoard", "proofDashboard", "proofAi"].map((key) => (
                <div className="rounded-md border border-border bg-background p-3" key={key}>
                  <p className="text-sm font-medium">{t(`pages.home.${key}.title`)}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {t(`pages.home.${key}.description`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
