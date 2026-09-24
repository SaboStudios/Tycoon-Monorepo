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
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const decodeToken = (token: string): User | null => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        is_admin: payload.is_admin,
      };
    } catch (e) {
      return null;
    }
  };

  const login = (accessToken: string, refreshToken: string) => {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    const decodedUser = decodeToken(accessToken);
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
        refreshSession();
      }
    }
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, refreshSession }}
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
