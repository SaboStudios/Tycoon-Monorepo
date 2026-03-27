"use client";

import React, { Suspense, ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import { SkeletonCard, SkeletonList, SkeletonDetail } from "@/components/ui/skeleton-card";
import { cn } from "@/lib/utils";

interface SuspenseBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  fallbackType?: "spinner" | "card" | "list" | "detail";
  minDisplayTime?: number;
  className?: string;
}

/**
 * Wrapper around React Suspense with built-in fallback UI
 * Supports minimum display time to avoid flash of loading state
 */
export function SuspenseBoundary({
  children,
  fallback,
  fallbackType = "spinner",
  minDisplayTime = 0,
  className,
}: SuspenseBoundaryProps) {
  const [showFallback, setShowFallback] = React.useState(minDisplayTime > 0);

  React.useEffect(() => {
    if (minDisplayTime > 0) {
      const timer = setTimeout(() => setShowFallback(false), minDisplayTime);
      return () => clearTimeout(timer);
    }
  }, [minDisplayTime]);

  const defaultFallback = React.useMemo(() => {
    if (fallback) return fallback;

    switch (fallbackType) {
      case "card":
        return <SkeletonCard />;
      case "list":
        return <SkeletonList />;
      case "detail":
        return <SkeletonDetail />;
      case "spinner":
      default:
        return (
          <div className="flex items-center justify-center p-8">
            <Spinner size="md" />
          </div>
        );
    }
  }, [fallback, fallbackType]);

  return (
    <Suspense fallback={<div className={className}>{defaultFallback}</div>}>
      {children}
    </Suspense>
  );
}

/**
 * Wrapper for multiple suspense boundaries with consistent styling
 */
export function SuspenseBoundaryGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {children}
    </div>
  );
}
