"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
} from "@/lib/theme";
import type { ResolvedTheme, ThemePreference } from "@/lib/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setThemePreference: (preference: ThemePreference) => void;
  clearThemePreference: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(preference: ThemePreference, systemTheme: ResolvedTheme): ResolvedTheme {
  return preference === "system" ? systemTheme : preference;
}

function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;

  root.setAttribute(THEME_ATTRIBUTE, theme);
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const nextSystemTheme = getSystemTheme();
    let storedPreference: ThemePreference = "system";

    try {
      const storedValue = window.localStorage.getItem(THEME_STORAGE_KEY);

      if (storedValue === "light" || storedValue === "dark") {
        storedPreference = storedValue;
      }
    } catch (error) {
      storedPreference = "system";
    }

    setSystemTheme(nextSystemTheme);
    setPreference(storedPreference);
    applyTheme(resolveTheme(storedPreference, nextSystemTheme));

    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      const nextTheme = event.matches ? "dark" : "light";

      setSystemTheme(nextTheme);
      setPreference((currentPreference) => {
        if (currentPreference === "system") {
          applyTheme(nextTheme);
        }

        return currentPreference;
      });
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const resolvedTheme = resolveTheme(preference, systemTheme);

  useEffect(() => {
    applyTheme(resolvedTheme);

    try {
      if (preference === "system") {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        window.localStorage.setItem(THEME_STORAGE_KEY, preference);
      }
    } catch (error) {
      // Ignore storage write failures and keep the in-memory preference.
    }
  }, [preference, resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedTheme,
      setThemePreference: setPreference,
      clearThemePreference: () => setPreference("system"),
    }),
    [preference, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
