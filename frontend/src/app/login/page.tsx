"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Login failed";
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const updateOfflineState = () => setIsOffline(!navigator.onLine);
    updateOfflineState();

    window.addEventListener("online", updateOfflineState);
    window.addEventListener("offline", updateOfflineState);

    return () => {
      window.removeEventListener("online", updateOfflineState);
      window.removeEventListener("offline", updateOfflineState);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isOffline) {
      setError("You appear to be offline. Please reconnect and try again.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      // For now, mock a login or call the real backend if it's running
      // const data = await apiRequest("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      // login(data.accessToken, data.refreshToken);

      // MOCK for demonstration if backend is not reachable
      const mockToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(
        JSON.stringify({ sub: 1, email, role: "USER", is_admin: false })
      )}.signature`;
      login(mockToken, "mock-refresh-token");
      router.push("/");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#010F10]">
      <main
        role="main"
        aria-labelledby="login-heading"
        className="w-full max-w-md rounded-2xl border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] p-8"
      >
        <h1
          id="login-heading"
          className="mb-6 font-orbitron text-2xl font-bold text-[var(--tycoon-text)] uppercase tracking-wider"
        >
          Login to Tycoon
        </h1>

        <div aria-live="polite" aria-atomic="true" className="min-h-[1.25rem]">
          {error && (
            <p id="login-error" role="alert" className="mb-4 text-xs text-red-500">
              {error}
            </p>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          aria-describedby={error ? "login-error" : undefined}
          aria-busy={isSubmitting}
        >
          <div>
            <label htmlFor="login-email" className="block text-xs font-medium text-[var(--tycoon-text)]/70 mb-1">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--tycoon-border)] bg-[#011a1b] p-3 text-sm text-[var(--tycoon-text)] outline-none focus-visible:ring-2 focus-visible:ring-tycoon-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#010F10] focus:border-[var(--tycoon-accent)]"
              placeholder="admin@tycoon.com"
              autoComplete="email"
              autoFocus
              required
              aria-describedby={error ? "login-error" : undefined}
              aria-invalid={!!error}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-medium text-[var(--tycoon-text)]/70 mb-1">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--tycoon-border)] bg-[#011a1b] p-3 text-sm text-[var(--tycoon-text)] outline-none focus-visible:ring-2 focus-visible:ring-tycoon-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#010F10] focus:border-[var(--tycoon-accent)]"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              aria-describedby={error ? "login-error" : undefined}
              aria-invalid={!!error}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isOffline}
            className="w-full rounded-lg bg-[var(--tycoon-accent)] py-3 text-sm font-bold text-[#011F21] transition-opacity disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-90"
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "Signing In…" : "Sign In"}
          </button>
        </form>
      </main>
    </div>
  );
}
