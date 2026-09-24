export const THEME_STORAGE_KEY = "tycoon-theme";
export const THEME_ATTRIBUTE = "data-theme";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_BOOTSTRAP_SCRIPT = `(() => {
  const root = document.documentElement;
  const fallbackTheme = "light";

  try {
    const storedPreference = localStorage.getItem("${THEME_STORAGE_KEY}");
    const hasSystemDarkMode =
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
