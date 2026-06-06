import type { Locale } from "@agentboard/shared";

export const supportedLocales: Locale[] = ["en", "pl", "cs"];
export const languageStorageKey = "agentboard.language";

export function normalizeLocale(value: string | null | undefined): Locale | null {
  const prefix = value?.toLowerCase().split("-")[0];

  if (prefix === "pl" || prefix === "cs" || prefix === "en") {
    return prefix;
  }

  return null;
}

export function detectInitialLanguage(): Locale {
  const stored = normalizeLocale(window.localStorage.getItem(languageStorageKey));

  if (stored) {
    return stored;
  }

  for (const browserLanguage of window.navigator.languages) {
    const normalized = normalizeLocale(browserLanguage);
    if (normalized) {
      return normalized;
    }
  }

  return normalizeLocale(window.navigator.language) ?? "en";
}
