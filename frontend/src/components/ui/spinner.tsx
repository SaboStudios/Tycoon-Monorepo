"use client";

import React from "react";
import { cn } from "@/lib/utils";

/** Tycoon-branded loading spinner. Uses #00F0FF accent. */
export function Spinner({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-6 w-6 border-2",
    md: "h-12 w-12 border-[3px]",
    lg: "h-24 w-24 border-4",
  };

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "animate-spin rounded-full border-[#00F0FF]/30 border-t-[#00F0FF]",
        sizeClasses[size],
        className
      )}
    />
  );
}
