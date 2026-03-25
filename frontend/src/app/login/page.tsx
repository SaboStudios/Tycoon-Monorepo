"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      // For now, mock a login or call the real backend if it's running
      // const data = await apiRequest("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      // login(data.accessToken, data.refreshToken);
      
      // MOCK for demonstration if backend is not reachable
      const mockToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ sub: 1, email, role: "USER", is_admin: false }))}.signature`;
      login(mockToken, "mock-refresh-token");
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#010F10]">
      <div className="w-full max-w-md rounded-2xl border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] p-8">
        <h1 className="mb-6 font-orbitron text-2xl font-bold text-[var(--tycoon-text)] uppercase tracking-wider">
          Login to Tycoon
        </h1>
        {error && <p className="mb-4 text-xs text-red-500">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--tycoon-text)]/70 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--tycoon-border)] bg-[#011a1b] p-3 text-sm text-[var(--tycoon-text)] outline-none focus:border-[var(--tycoon-accent)]"
              placeholder="admin@tycoon.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--tycoon-text)]/70 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--tycoon-border)] bg-[#011a1b] p-3 text-sm text-[var(--tycoon-text)] outline-none focus:border-[var(--tycoon-accent)]"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--tycoon-accent)] py-3 text-sm font-bold text-[#011F21] hover:opacity-90 transition-opacity"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
