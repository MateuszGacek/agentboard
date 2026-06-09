import type { ThemeMode } from "@kanban/shared";
import { Moon, Monitor, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../app/theme";
import { Button } from "../ui/button";

const themeModes: Array<{ mode: ThemeMode; Icon: typeof Sun }> = [
  { mode: "light", Icon: Sun },
  { mode: "dark", Icon: Moon },
  { mode: "system", Icon: Monitor }
];

export function ThemeSwitch() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1">
      <span className="sr-only">{t("theme.label")}</span>
      {themeModes.map(({ mode, Icon }) => (
        <Button
          aria-label={t(`theme.${mode}`)}
          className="h-7 w-7 transition-transform active:scale-95"
          key={mode}
          onClick={() => setTheme(mode)}
          size="icon"
          type="button"
          variant={theme === mode ? "secondary" : "ghost"}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </Button>
      ))}
    </div>
  );
}
