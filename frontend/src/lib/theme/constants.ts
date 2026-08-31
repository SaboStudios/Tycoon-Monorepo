export const THEME_STORAGE_KEY = "tycoon-theme";
export const THEME_ATTRIBUTE = "data-theme";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_BOOTSTRAP_SCRIPT = `(() => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const fallbackTheme = "light";

  try {
    const storedPreference = typeof localStorage !== "undefined"
      ? localStorage.getItem("${THEME_STORAGE_KEY}")
      : null;
    const hasSystemDarkMode =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedTheme =
      storedPreference === "light" || storedPreference === "dark"
        ? storedPreference
        : hasSystemDarkMode
          ? "dark"
          : "light";

    root.setAttribute("${THEME_ATTRIBUTE}", resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  } catch (error) {
    root.setAttribute("${THEME_ATTRIBUTE}", fallbackTheme);
    root.style.colorScheme = fallbackTheme;
  }
})();`;
