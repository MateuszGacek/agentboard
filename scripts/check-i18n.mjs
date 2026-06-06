import fs from "node:fs";
import path from "node:path";

const localeDir = path.resolve("apps/web/src/i18n/locales");
const locales = ["en", "pl", "cs"];

function readLocale(locale) {
  const filePath = path.join(localeDir, locale, "common.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function flattenKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;

    if (child && typeof child === "object" && !Array.isArray(child)) {
      return flattenKeys(child, nextPrefix);
    }

    return [nextPrefix];
  });
}

const localeKeys = Object.fromEntries(
  locales.map((locale) => [locale, new Set(flattenKeys(readLocale(locale)))])
);
const allKeys = [...new Set(Object.values(localeKeys).flatMap((keys) => [...keys]))].sort();
let hasError = false;

for (const locale of locales) {
  const missing = allKeys.filter((key) => !localeKeys[locale].has(key));

  if (missing.length > 0) {
    hasError = true;
    console.error(`${locale} is missing ${missing.length} translation keys:`);
    for (const key of missing) {
      console.error(`  - ${key}`);
    }
  }
}

if (hasError) {
  process.exit(1);
}

console.info(`i18n key parity PASS: ${locales.join(", ")} share ${allKeys.length} keys.`);
