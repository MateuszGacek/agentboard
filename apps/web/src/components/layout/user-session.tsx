import type { SessionResponse } from "@kanban/shared";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useLogoutMutation } from "../../features/auth/auth-queries";
import { Button } from "../ui/button";

type UserSessionProps = {
  session: SessionResponse;
};

export function UserSession({ session }: UserSessionProps) {
  const { t } = useTranslation();
  const logout = useLogoutMutation();
  const initials = session.user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden min-w-0 text-right sm:block">
        <p className="truncate text-sm font-medium">{session.user.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {session.user.isDemo ? t("shell.demoUser") : session.user.email}
        </p>
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold">
        {initials}
      </div>
      <Button
        aria-label={t("auth.logout")}
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
        size="icon"
        type="button"
        variant="ghost"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
