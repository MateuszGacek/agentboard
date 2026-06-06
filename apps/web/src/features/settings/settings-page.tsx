import { CheckCircle2, CloudOff, MonitorCog } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ThemeSwitch } from "../../components/layout/theme-switch";
import { LanguageSwitch } from "../../components/layout/language-switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../../components/ui/card";
import { useSession } from "../auth/auth-queries";

export function SettingsPage() {
  const { t } = useTranslation();
  const session = useSession();
  const activeWorkspace =
    session.data?.workspaces.find(
      (workspace) => workspace.id === session.data?.activeWorkspaceId
    ) ??
    session.data?.workspaces[0] ??
    null;

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{t("settings.eyebrow")}</p>
        <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {t("settings.subtitle")}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("settings.preferences.title")}</CardTitle>
            <CardDescription>{t("settings.preferences.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <section className="space-y-3 rounded-md border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <MonitorCog className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-sm font-semibold">{t("settings.preferences.theme")}</h2>
              </div>
              <ThemeSwitch />
              <p className="text-xs leading-5 text-muted-foreground">
                {t("settings.preferences.themeHelp")}
              </p>
            </section>
            <section className="space-y-3 rounded-md border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-sm font-semibold">{t("settings.preferences.language")}</h2>
              </div>
              <LanguageSwitch />
              <p className="text-xs leading-5 text-muted-foreground">
                {t("settings.preferences.languageHelp")}
              </p>
            </section>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.workspace.title")}</CardTitle>
            <CardDescription>{t("settings.workspace.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">
                  {t("settings.workspace.name")}
                </dt>
                <dd className="mt-1 font-semibold">
                  {activeWorkspace?.name ?? t("settings.workspace.none")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">
                  {t("settings.workspace.mode")}
                </dt>
                <dd className="mt-1">
                  {activeWorkspace?.isDemo
                    ? t("settings.workspace.demo")
                    : t("settings.workspace.standard")}
                </dd>
              </div>
            </dl>
            {activeWorkspace?.isDemo ? (
              <p className="rounded-md border border-accent/30 bg-accent/10 p-3 text-xs leading-5 text-accent">
                {t("settings.workspace.demoNote")}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.deployment.title")}</CardTitle>
          <CardDescription>{t("settings.deployment.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 rounded-md border border-border bg-background p-4 text-sm sm:flex-row sm:items-start">
            <CloudOff className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium">{t("settings.deployment.status")}</p>
              <p className="leading-6 text-muted-foreground">{t("settings.deployment.note")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
