declare global {
  var __TYCOON_SESSION__: {
    accessToken?: string;
    refreshToken?: string;
  } | undefined;
}

export interface SessionTokens {
  accessToken?: string;
  refreshToken?: string;
}

export function readSessionTokens(): SessionTokens {
  if (typeof globalThis === "undefined") {
    return {};
  }

  const session = globalThis.__TYCOON_SESSION__ ?? {};
  const legacyAccessToken =
    typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null;
  const legacyRefreshToken =
    typeof window !== "undefined" ? window.localStorage.getItem("refreshToken") : null;

  return {
    accessToken: session.accessToken ?? legacyAccessToken ?? "",
    refreshToken: session.refreshToken ?? legacyRefreshToken ?? "",
  };
}

export function writeSessionTokens(tokens: SessionTokens): void {
  if (typeof globalThis === "undefined") return;

  globalThis.__TYCOON_SESSION__ = {
    ...(globalThis.__TYCOON_SESSION__ ?? {}),
    accessToken: tokens.accessToken || globalThis.__TYCOON_SESSION__?.accessToken,
    refreshToken: tokens.refreshToken || globalThis.__TYCOON_SESSION__?.refreshToken,
  };

  if (typeof window !== "undefined") {
    if (tokens.accessToken) {
      window.localStorage.setItem("accessToken", tokens.accessToken);
    }
    if (tokens.refreshToken) {
      window.localStorage.setItem("refreshToken", tokens.refreshToken);
    }
  }
}

export function clearSessionTokens(): void {
  if (typeof globalThis === "undefined") return;
  globalThis.__TYCOON_SESSION__ = {};
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("accessToken");
    window.localStorage.removeItem("refreshToken");
  }
}
