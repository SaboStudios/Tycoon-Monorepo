import { useEffect, useState } from "react";

const canUseDOM = typeof window !== "undefined" && "matchMedia" in window;

export function useMediaQuery(query: string, defaultValue: boolean = false): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (!canUseDOM) return defaultValue;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (!canUseDOM) return;

    const mediaQueryList = window.matchMedia(query);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQueryList.addEventListener("change", handleChange);

    return () => {
      mediaQueryList.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}

