"use client";

/**
 * Landing hero — CLS / LCP performance budget
 *
 * Thresholds follow the Web Vitals "Good" band:
 *   LCP  ≤ 2 500 ms  (Google "Good" threshold)
 *   CLS  ≤ 0.1       (Google "Good" threshold)
 *
 * The hook observes both metrics via PerformanceObserver and logs a warning
 * when a budget is exceeded.  It is a no-op in SSR and in environments that
 * don't support the relevant observer entry types.
 */

export const HERO_LCP_BUDGET_MS = 2500;
export const HERO_CLS_BUDGET = 0.1;

export interface HeroPerfViolation {
  metric: "LCP" | "CLS";
  value: number;
  budget: number;
}

export type HeroPerfViolationHandler = (v: HeroPerfViolation) => void;

/**
 * Observe LCP and CLS for the landing hero.
 *
 * Returns a cleanup function that disconnects the observers.
 * Safe to call in SSR — returns a no-op cleanup immediately.
 */
export function observeHeroPerfBudget(
  onViolation: HeroPerfViolationHandler = defaultViolationHandler,
): () => void {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    return () => {};
  }

  const observers: PerformanceObserver[] = [];

  // ── LCP ──────────────────────────────────────────────────────────────────
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
      if (last && last.startTime > HERO_LCP_BUDGET_MS) {
        onViolation({ metric: "LCP", value: last.startTime, budget: HERO_LCP_BUDGET_MS });
      }
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    observers.push(lcpObserver);
  } catch {
    // Entry type not supported in this environment — silently skip.
  }

  // ── CLS ──────────────────────────────────────────────────────────────────
  let clsValue = 0;
  try {
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!shift.hadRecentInput) {
          clsValue += shift.value;
          if (clsValue > HERO_CLS_BUDGET) {
            onViolation({ metric: "CLS", value: clsValue, budget: HERO_CLS_BUDGET });
          }
        }
      }
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
    observers.push(clsObserver);
  } catch {
    // Entry type not supported in this environment — silently skip.
  }

  return () => observers.forEach((o) => o.disconnect());
}

function defaultViolationHandler(v: HeroPerfViolation): void {
  console.warn(
    `[hero-perf-budget] ${v.metric} budget exceeded: ${v.value.toFixed(v.metric === "CLS" ? 3 : 0)} > ${v.budget}`,
  );
}

// ── React hook ───────────────────────────────────────────────────────────────

import { useEffect } from "react";

/**
 * Drop-in hook for HeroSection.
 * Starts observing on mount, disconnects on unmount.
 */
export function useHeroPerformanceBudget(
  onViolation?: HeroPerfViolationHandler,
): void {
  useEffect(() => {
    const cleanup = observeHeroPerfBudget(onViolation);
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
