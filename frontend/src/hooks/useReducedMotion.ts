import { useEffect, useState } from "react";

const canUseDOM = typeof window !== "undefined" && "matchMedia" in window;

/**
 * Hook to detect if the user prefers reduced motion.
 * Returns true if the user has set prefers-reduced-motion: reduce in their OS settings.
 * Falls back to the provided defaultValue when matchMedia API is unavailable (e.g., during SSR or in older browsers).
 *
 * @param defaultValue - The value to return when matchMedia is not available (defaults to false)
 * @returns boolean indicating whether prefers-reduced-motion is active
 */
export function useReducedMotion(defaultValue: boolean = false): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (!canUseDOM) return defaultValue;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (!canUseDOM) return;

    const mediaQueryList = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQueryList.addEventListener("change", handleChange);

    return () => {
      mediaQueryList.removeEventListener("change", handleChange);
    };
  }, []);

  return prefersReducedMotion;
}
