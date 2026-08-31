import { describe, expect, it } from "vitest";
import {
  THEME_ATTRIBUTE,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
} from "./constants";
import type { ResolvedTheme, ThemePreference } from "./constants";

describe("theme constants", () => {
  it("THEME_STORAGE_KEY is a non-empty string", () => {
    expect(typeof THEME_STORAGE_KEY).toBe("string");
    expect(THEME_STORAGE_KEY.length).toBeGreaterThan(0);
  });

  it("THEME_ATTRIBUTE is a non-empty string", () => {
    expect(typeof THEME_ATTRIBUTE).toBe("string");
    expect(THEME_ATTRIBUTE.length).toBeGreaterThan(0);
  });

  it("THEME_BOOTSTRAP_SCRIPT is a non-empty string", () => {
    expect(typeof THEME_BOOTSTRAP_SCRIPT).toBe("string");
    expect(THEME_BOOTSTRAP_SCRIPT.length).toBeGreaterThan(0);
  });

  it("THEME_BOOTSTRAP_SCRIPT references THEME_STORAGE_KEY", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_STORAGE_KEY);
  });

  it("THEME_BOOTSTRAP_SCRIPT references THEME_ATTRIBUTE", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_ATTRIBUTE);
  });

  it("THEME_BOOTSTRAP_SCRIPT falls back to light theme on error", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("light");
  });

  it("THEME_BOOTSTRAP_SCRIPT is SSR-safe (checks for document)", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('typeof document === "undefined"');
  });

  it("THEME_BOOTSTRAP_SCRIPT is SSR-safe (checks for localStorage)", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('typeof localStorage !== "undefined"');
  });

  it("THEME_BOOTSTRAP_SCRIPT is SSR-safe (checks for window)", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('typeof window !== "undefined"');
  });
});

describe("ThemePreference type", () => {
  it("accepts valid preference values", () => {
    const values: ThemePreference[] = ["system", "light", "dark"];
    expect(values).toHaveLength(3);
  });
});

describe("ResolvedTheme type", () => {
  it("accepts valid resolved theme values", () => {
    const values: ResolvedTheme[] = ["light", "dark"];
    expect(values).toHaveLength(2);
  });
});
