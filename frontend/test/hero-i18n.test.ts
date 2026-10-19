import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HERO_I18N_KEY_LIST } from "@/lib/hero/i18n-keys";

const localesDir = join(dirname(fileURLToPath(import.meta.url)), "../public/locales");

function loadLocale(lng: string): Record<string, unknown> {
  const raw = readFileSync(join(localesDir, lng, "common.json"), "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

function resolveKey(obj: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

describe("hero i18n keys (#832)", () => {
  const locales = ["en", "es"] as const;

  it.each(locales)("all hero keys exist in %s/common.json", (lng) => {
    const locale = loadLocale(lng);
    for (const key of HERO_I18N_KEY_LIST) {
      const value = resolveKey(locale, key);
      expect(value, `missing ${key} in ${lng}`).toBeDefined();
      expect(typeof value).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  });

  it("lists every key under hero in the English locale", () => {
    const en = loadLocale("en");
    const hero = (en as Record<string, unknown>).hero as Record<string, unknown>;
    expect(hero).toBeDefined();
    expect(HERO_I18N_KEY_LIST.length).toBeGreaterThanOrEqual(20);
  });
});
