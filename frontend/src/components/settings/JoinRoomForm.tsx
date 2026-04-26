"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ZodError } from "zod";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { joinRoomSchema } from "@/lib/validation/schemas";
import { mapServerErrors, type FieldErrors } from "@/lib/validation/serverErrorMap";

/** Converts a Zod error into a flat field-keyed error map. */
function parseZodErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "_form");
    if (!out[field]) out[field] = issue.message;
  }
  return out;
}

export default function JoinRoomForm(): React.JSX.Element {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  // Move focus to the input on mount so keyboard users land directly in the form
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.toUpperCase().slice(0, 6));
    // Only clear field-level errors on change; _form errors persist until retry
    setErrors(({ roomCode: _dropped, ...rest }) => rest as FieldErrors);
  }, []);

  /** Re-run the submit flow without clearing the code — used by the retry button. */
  const handleRetry = useCallback(() => {
    setErrors({});
    // Trigger submit programmatically via the form ref
    formRef.current?.requestSubmit();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const result = joinRoomSchema.safeParse({ roomCode: code.trim() });
      if (!result.success) {
        setErrors(parseZodErrors(result.error));
        return;
      }

      setIsLoading(true);
      try {
        // Replace with real API call when available
        await new Promise<void>((resolve) => setTimeout(resolve, 800));
        router.push(`/game-waiting?gameCode=${encodeURIComponent(result.data.roomCode)}`);
      } catch (err: unknown) {
        setErrors(mapServerErrors(err instanceof Error ? { message: err.message } : err));
      } finally {
        setIsLoading(false);
      }
    },
    [code, router]
  );

  const isValid = joinRoomSchema.safeParse({ roomCode: code.trim() }).success;

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Form-level error banner — shown for server/network errors that are not
          tied to a specific field (e.g. room not found, room full, 5xx). */}
      {errors._form && (
        <div
          role="alert"
          data-testid="form-error-banner"
          className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2.5 text-sm text-red-300"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1 leading-snug">{errors._form}</span>
          {isValid && (
            <button
              type="button"
              onClick={handleRetry}
              aria-label="Retry joining the room"
              className="ml-1 inline-flex items-center gap-1 text-xs text-red-300 underline-offset-2 hover:underline"
            >
              <RefreshCw aria-hidden="true" className="h-3 w-3" />
              Retry
            </button>
          )}
        </div>
      )}

      <FormField
        id="room-code"
        label="Room Code"
        hint="6-character alphanumeric code (e.g. TYCOON)"
        error={errors.roomCode}
        required
      >
        <Input
          ref={inputRef}
          type="text"
          value={code}
          onChange={handleChange}
          placeholder="e.g. TYCOON"
          maxLength={6}
          autoComplete="off"
          aria-required="true"
          className="bg-[var(--tycoon-bg)] border-[var(--tycoon-border)] text-[var(--tycoon-text)] placeholder:text-[var(--tycoon-text)]/40 focus-visible:ring-[var(--tycoon-accent)] font-orbitron tracking-widest uppercase"
        />
      </FormField>

      <Button
        type="submit"
        disabled={!isValid || isLoading}
        aria-busy={isLoading}
        aria-disabled={!isValid || isLoading}
        className="w-full bg-[var(--tycoon-accent)] text-[var(--tycoon-bg)] font-orbitron font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--tycoon-accent)] focus-visible:ring-offset-2"
      >
        {/* min-w reserves the wider "Joining…" width so the button never
            resizes when the label swaps — eliminates a micro CLS contribution. */}
        <span className="inline-block min-w-[4.5rem] text-center">
          {isLoading ? "Joining\u2026" : "Join"}
        </span>
      </Button>
    </form>
  );
}
