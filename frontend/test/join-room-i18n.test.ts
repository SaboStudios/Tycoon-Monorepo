import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JOIN_ROOM_I18N_KEY_LIST } from "@/lib/join-room/i18n-keys";

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

describe("join room i18n keys (#844)", () => {
  const locales = ["en", "es"] as const;

  it.each(locales)("all join_room keys exist in %s/common.json", (lng) => {
    const locale = loadLocale(lng);
    for (const key of JOIN_ROOM_I18N_KEY_LIST) {
      const value = resolveKey(locale, key);
      expect(value, `missing ${key} in ${lng}`).toBeDefined();
      expect(typeof value).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  });

  it("lists every key under join_room in the English locale", () => {
    const en = loadLocale("en");
    const joinRoom = en.join_room as Record<string, unknown>;
    expect(joinRoom).toBeDefined();
    expect(JOIN_ROOM_I18N_KEY_LIST.length).toBeGreaterThanOrEqual(15);
  });
});
