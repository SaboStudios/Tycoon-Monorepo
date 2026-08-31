"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

interface User {
  id: number;
  email: string;
  username?: string;
  role: string;
  is_admin: boolean;
  address?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const clearStoredSession = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
    setUser(null);
  };

  const clearExpiredSession = () => {
    localStorage.removeItem("accessToken");
    document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
    setUser(null);
  };

  const decodeToken = (token: string): User | null => {
    try {
      const tokenParts = token.split(".");
      if (tokenParts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(atob(tokenParts[1]));

      if (
        typeof payload?.sub !== "number" ||
        typeof payload?.email !== "string" ||
        typeof payload?.role !== "string" ||
        typeof payload?.is_admin !== "boolean"
      ) {
        return null;
      }

      return {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        is_admin: payload.is_admin,
      };
    } catch {
      return null;
    }
  };

  const clearError = () => setError(null);

  const login = (accessToken: string, refreshToken: string) => {
    const decodedUser = decodeToken(accessToken);

    if (!decodedUser) {
      clearStoredSession();
      const msg = "Invalid authentication token";
      setError(msg);
      throw new Error(msg);
    }

    setError(null);
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    setUser(decodedUser);

    // Set cookie for middleware
    document.cookie = `auth-token=${accessToken}; path=/; max-age=3600; SameSite=Lax`;
  };

  const logout = async () => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      try {
        await apiRequest("/auth/logout", {
          method: "POST",
          token,
        });
      } catch (e) {
        console.error("Logout failed", e);
      }
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
    setUser(null);
    router.push("/");
  };

  const refreshSession = async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<{ accessToken: string; refreshToken: string }>(
        "/auth/refresh",
        {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        }
      );
      login(data.accessToken, data.refreshToken);
    } catch (e) {
      console.error("Session refresh failed", e);
      setError(e instanceof Error ? e.message : "Session refresh failed");
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      const decodedUser = decodeToken(token);
      if (decodedUser) {
        setUser(decodedUser);
      } else {
        const hasRefreshToken = Boolean(localStorage.getItem("refreshToken"));
        clearExpiredSession();
        if (hasRefreshToken) {
          refreshSession();
          return;
        }
      }
    }
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, logout, refreshSession, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
