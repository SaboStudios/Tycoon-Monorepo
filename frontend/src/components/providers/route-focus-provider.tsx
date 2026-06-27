"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type RouteFocusProviderProps = {
  children: ReactNode;
};

export function RouteFocusProvider({ children }: RouteFocusProviderProps) {
  const pathname = usePathname();
  const lastPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastPathnameRef.current === pathname) {
      lastPathnameRef.current = pathname;
      return;
    }

    lastPathnameRef.current = pathname;

    const routeFocusElement = document.getElementById("route-focus-anchor");
    if (!routeFocusElement) {
      return;
    }

    routeFocusElement.focus();
  }, [pathname]);

  return (
    <div
      id="route-focus-anchor"
      role="region"
      aria-label="Page content"
      tabIndex={-1}
      className="outline-none"
      data-testid="route-focus-anchor"
    >
      {children}
    </div>
  );
}
