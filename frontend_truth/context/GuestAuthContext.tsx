"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";

export type GuestUser = {
  id: number;
  username: string;
  address: string;
  is_guest: boolean;
};

type GuestAuthContextValue = {
  guestUser: GuestUser | null;
  isLoading: boolean;
  registerGuest: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginGuest: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logoutGuest: () => void;
  refetchGuest: () => Promise<void>;
};

const GuestAuthContext = createContext<GuestAuthContextValue | null>(null);

const TOKEN_KEY = "token";

export function GuestAuthProvider({ children }: { children: React.ReactNode }) {
  const [guestUser, setGuestUser] = useState<GuestUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetchGuest = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) {
      setGuestUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await apiClient.get<ApiResponse & { data?: { id: number; username: string; address: string; is_guest?: boolean } }>("auth/me");
      if (res?.data?.data) {
        setGuestUser({
          id: res.data.data.id,
          username: res.data.data.username,
          address: res.data.data.address,
          is_guest: res.data.data.is_guest ?? true,
        });
      } else {
        setGuestUser(null);
      }
    } catch {
      setGuestUser(null);
      if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchGuest();
  }, [refetchGuest]);

  const registerGuest = useCallback(async (username: string, password: string) => {
    try {
      const res = await apiClient.post<ApiResponse & { data?: { token: string; user: GuestUser } }>("auth/guest-register", { username: username.trim(), password });
      const data = res?.data as any;
      if (data?.data?.token && data?.data?.user) {
        if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, data.data.token);
        setGuestUser(data.data.user);
        return { success: true };
      }
      return { success: false, message: (data?.message as string) || "Registration failed" };
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.message ?? "Registration failed";
      return { success: false, message };
    }
  }, []);

  const loginGuest = useCallback(async (username: string, password: string) => {
    try {
      const res = await apiClient.post<ApiResponse & { data?: { token: string; user: GuestUser } }>("auth/guest-login", { username: username.trim(), password });
      const data = res?.data as any;
      if (data?.data?.token && data?.data?.user) {
        if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, data.data.token);
        setGuestUser(data.data.user);
        return { success: true };
      }
      return { success: false, message: (data?.message as string) || "Login failed" };
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.message ?? "Login failed";
      return { success: false, message };
    }
  }, []);

  const logoutGuest = useCallback(() => {
    if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
    setGuestUser(null);
  }, []);

  const value: GuestAuthContextValue = {
    guestUser,
    isLoading,
    registerGuest,
    loginGuest,
    logoutGuest,
    refetchGuest,
  };

  return <GuestAuthContext.Provider value={value}>{children}</GuestAuthContext.Provider>;
}

export function useGuestAuth() {
  const ctx = useContext(GuestAuthContext);
  if (!ctx) throw new Error("useGuestAuth must be used within GuestAuthProvider");
  return ctx;
}

export function useGuestAuthOptional() {
  return useContext(GuestAuthContext);
}
