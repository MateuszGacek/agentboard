import type { Locale } from "@kanban/shared";
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { supportedLocales } from "../../i18n/config";
import { Button } from "../ui/button";

const localeLabels: Record<Locale, string> = {
  en: "EN",
  pl: "PL",
  cs: "CS"
};

export function LanguageSwitch() {
  const { i18n, t } = useTranslation();

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1">
      <Languages className="ml-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{t("language.label")}</span>
      {supportedLocales.map((locale) => (
        <Button
          aria-label={t(`language.${locale}`)}
          className="h-7 px-2"
          key={locale}
          onClick={() => void i18n.changeLanguage(locale)}
          size="sm"
          type="button"
          variant={i18n.language === locale ? "secondary" : "ghost"}
        >
          {localeLabels[locale]}
        </Button>
      ))}
    </div>
  );
}
