"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { ZodError } from "zod";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { joinRoomSchema, type FieldErrors } from "@/lib/validation";
import {
  JOIN_ROOM_I18N,
  translateJoinRoomMessage,
} from "@/lib/join-room/i18n-keys";
import {
  hasJoinAuthToken,
  mapJoinRoomErrors,
  sanitiseRoomCode,
} from "@/lib/join-room/security";
import { apiClient } from "@/lib/api/client";
import type { GameResponse } from "@/lib/api/types/dto";
import { useJoinRoomTelemetry } from "@/hooks/useJoinRoomTelemetry";
import { useErrorReporting } from "@/hooks/useErrorReporting";

function parseZodErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "_form");
    if (!out[field]) out[field] = issue.message;
  }
  return out;
}

const SUBMIT_COOLDOWN_MS = 2_000;

export interface JoinRoomFormPreviewState {
  code?: string;
  errors?: FieldErrors;
  isLoading?: boolean;
  skipAutoFocus?: boolean;
}

export interface JoinRoomFormProps {
  previewState?: JoinRoomFormPreviewState;
}

export default function JoinRoomForm({
  previewState,
}: JoinRoomFormProps = {}): React.JSX.Element {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [code, setCode] = useState(previewState?.code ?? "");
  const [errors, setErrors] = useState<FieldErrors>(previewState?.errors ?? {});
  const [isLoading, setIsLoading] = useState(previewState?.isLoading ?? false);

  const { trackJoinAttempted, trackJoinSucceeded, trackJoinFailed } = useJoinRoomTelemetry();
  const { reportError } = useErrorReporting();

  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const lastSubmitRef = useRef<number>(0);
  const formViewedRef = useRef(false);

  const errorId = "room-code-error";

  React.useEffect(() => {
    if (previewState?.skipAutoFocus) return;
    inputRef.current?.focus();
  }, [previewState?.skipAutoFocus]);

  // Keyboard shortcuts: Escape clears the input, Ctrl/Cmd+Enter submits the form
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setCode("");
        setErrors({});
        inputRef.current?.blur();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        formRef.current?.requestSubmit();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);


  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(sanitiseRoomCode(e.target.value));
    setErrors(({ roomCode: _dropped, ...rest }) => rest as FieldErrors);
  }, []);

  const handleRetry = useCallback(() => {
    setErrors({});
    lastSubmitRef.current = 0;
    formRef.current?.requestSubmit();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const now = Date.now();
      if (now - lastSubmitRef.current < SUBMIT_COOLDOWN_MS) {
        setErrors({ _form: JOIN_ROOM_I18N.errors.rateLimit });
        return;
      }
      lastSubmitRef.current = now;

      const result = joinRoomSchema.safeParse({ roomCode: code });
      if (!result.success) {
        setErrors(parseZodErrors(result.error));
        trackJoinFailed("validation");
        return;
      }

      if (!hasJoinAuthToken()) {
        setErrors({ _form: JOIN_ROOM_I18N.errors.unauthorized });
        return;
      }

      setIsLoading(true);
      setErrors({});

      // Track the join attempt
      trackJoinAttempted("submit_button");

      try {
        const startTime = performance.now();

        const response = await apiClient.post<GameResponse>(
          `/games/${encodeURIComponent(result.data.roomCode)}/join`,
          {}
        );

        const duration = performance.now() - startTime;

        // Track successful join
        trackJoinSucceeded();

        // Report performance metrics (non-blocking)
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
          (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
            console.debug(`[Join Room] Join completed in ${duration.toFixed(2)}ms`);
          });
        }

        router.push(`/game-waiting?gameCode=${encodeURIComponent(result.data.roomCode)}`);
      } catch (err: unknown) {
        setErrors(mapJoinRoomErrors(err));
      } finally {
        setIsLoading(false);
      }
    },
    [code, router, trackJoinAttempted, trackJoinSucceeded, trackJoinFailed, reportError]
  );

  const isValid = joinRoomSchema.safeParse({ roomCode: code }).success;

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
      {errors._form && (
        <div
          role="alert"
          data-testid="form-error-banner"
          className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2.5 text-sm text-red-300"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1 leading-snug">
            {translateJoinRoomMessage(t, errors._form)}
          </span>
          {isValid && (
            <button
              type="button"
              onClick={handleRetry}
              aria-label={t(JOIN_ROOM_I18N.form.retryAria)}
              className="ml-1 inline-flex items-center gap-1 text-xs text-red-300 underline-offset-2 hover:underline"
            >
              <RefreshCw aria-hidden="true" className="h-3 w-3" />
              {t(JOIN_ROOM_I18N.form.retry)}
            </button>
          )}
        </div>
      )}

      <FormField
        id="room-code"
        label={t(JOIN_ROOM_I18N.form.label)}
        hint={t(JOIN_ROOM_I18N.form.hint)}
        error={
          errors.roomCode
            ? translateJoinRoomMessage(t, errors.roomCode)
            : undefined
        }
        required
      >
        <Input
          ref={inputRef}
          id="room-code"
          type="text"
          value={code}
          onChange={handleChange}
          placeholder={t(JOIN_ROOM_I18N.form.placeholder)}
          maxLength={6}
          autoComplete="off"
          spellCheck={false}
          aria-required="true"
          aria-describedby={errors.roomCode ? errorId : undefined}
          aria-invalid={!!errors.roomCode}
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
        <span className="inline-block min-w-[4.5rem] text-center">
          {isLoading ? t(JOIN_ROOM_I18N.form.submitting) : t(JOIN_ROOM_I18N.form.submit)}
        </span>
      </Button>
    </form>
  );
}
