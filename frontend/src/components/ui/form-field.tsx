"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ id, label, hint, error, required, children, className }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-500">
            *
          </span>
        )}
      </Label>

      {hint && (
        <p id={hintId} className="text-xs text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      )}

      {/* Clone child to inject aria-describedby */}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
            id,
            "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
            "aria-invalid": error ? true : undefined,
          })
        : children}

      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-500 animate-in fade-in-50 duration-200">
          {error}
        </p>
      )}
    </div>
  );
}
