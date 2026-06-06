import { Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { AppShell } from "../../components/layout/app-shell";
import { InlineAlert } from "../../components/ui/inline-alert";
import { Skeleton } from "../../components/ui/skeleton";
import { getUserFacingApiError } from "../../lib/api-errors";
import { useSession } from "./auth-queries";

export function ProtectedRoute() {
  const { t } = useTranslation();
  const session = useSession();

  if (session.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4">
          <p className="text-sm text-muted-foreground">{t("auth.protected")}</p>
          <Skeleton className="h-24 w-full" />
        </div>
      </main>
    );
  }

  if (session.error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-xl">
          <InlineAlert>{getUserFacingApiError(session.error, t)}</InlineAlert>
        </div>
      </main>
    );
  }

  if (!session.data) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell session={session.data} />;
}
