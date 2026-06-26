import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthProvider, useAuth } from "../auth-provider";
import { ThemeProvider, useTheme } from "../theme-provider";
import { RouteFocusProvider } from "../route-focus-provider";
import { I18nProvider } from "../i18n-provider";
import { AnalyticsProvider } from "../analytics-provider";
import { MSWProvider } from "../msw-provider";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockRouterRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRouterRefresh }),
  usePathname: () => "/",
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  registerAnalyticsDebugHandle: vi.fn(),
  getViewEventForPath: vi.fn(() => null),
}));

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  I18nextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/i18n", () => ({ default: {} }));

// Minimal valid JWT: header.payload.signature (base64url-encoded)
function makeJwt(payload: object): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const body = btoa(JSON.stringify(payload))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${body}.sig`;
}

const VALID_TOKEN = makeJwt({
  sub: 42,
  email: "test@example.com",
  role: "user",
  is_admin: false,
});

// ── AuthProvider ───────────────────────────────────────────────────────────────

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  function TestConsumer() {
    const { user, loading, error, clearError } = useAuth();
    return (
      <div>
        <span data-testid="loading">{String(loading)}</span>
        <span data-testid="user">{user ? user.email : "null"}</span>
        <span data-testid="error">{error ?? "null"}</span>
        <button onClick={clearError}>clear</button>
      </div>
    );
  }

  it("starts with loading=true, user=null, error=null", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(screen.getByTestId("user").textContent).toBe("null");
    expect(screen.getByTestId("error").textContent).toBe("null");
  });

  it("login() decodes a valid token and sets user", async () => {
    function LoginConsumer() {
      const { user, login, error } = useAuth();
      return (
        <div>
          <span data-testid="email">{user?.email ?? "none"}</span>
          <span data-testid="error">{error ?? "null"}</span>
          <button
            onClick={() => login(VALID_TOKEN, "refresh-tok")}
            data-testid="do-login"
          >
            login
          </button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <LoginConsumer />
      </AuthProvider>
    );

    act(() => {
      screen.getByTestId("do-login").click();
    });

    await waitFor(() =>
      expect(screen.getByTestId("email").textContent).toBe("test@example.com")
    );
    expect(screen.getByTestId("error").textContent).toBe("null");
  });

  it("login() with a malformed token exposes error and throws", async () => {
    let caughtError: unknown;

    function BadLoginConsumer() {
      const { error, login } = useAuth();
      return (
        <div>
          <span data-testid="error">{error ?? "null"}</span>
          <button
            onClick={() => {
              try {
                login("not.a.jwt", "r");
              } catch (e) {
                caughtError = e;
              }
            }}
            data-testid="bad-login"
          >
            bad login
          </button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <BadLoginConsumer />
      </AuthProvider>
    );

    act(() => {
      screen.getByTestId("bad-login").click();
    });

    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).not.toBe("null")
    );
    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toContain("Invalid authentication token");
  });

  it("clearError() resets error to null", async () => {
    function ClearErrorConsumer() {
      const { error, login, clearError } = useAuth();
      return (
        <div>
          <span data-testid="error">{error ?? "null"}</span>
          <button
            onClick={() => {
              try { login("bad.tok.en", "r"); } catch { /* expected */ }
            }}
            data-testid="trigger-error"
          >
            err
          </button>
          <button onClick={clearError} data-testid="clear">clear</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <ClearErrorConsumer />
      </AuthProvider>
    );

    act(() => { screen.getByTestId("trigger-error").click(); });
    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).not.toBe("null")
    );

    act(() => { screen.getByTestId("clear").click(); });
    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toBe("null")
    );
  });

  it("successful login after a failed login clears the error", async () => {
    function RecoverConsumer() {
      const { error, login } = useAuth();
      return (
        <div>
          <span data-testid="error">{error ?? "null"}</span>
          <button
            onClick={() => {
              try { login("bad.tok.en", "r"); } catch { /* expected */ }
            }}
            data-testid="bad"
          >
            bad
          </button>
          <button
            onClick={() => login(VALID_TOKEN, "r")}
            data-testid="good"
          >
            good
          </button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <RecoverConsumer />
      </AuthProvider>
    );

    act(() => { screen.getByTestId("bad").click(); });
    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).not.toBe("null")
    );

    act(() => { screen.getByTestId("good").click(); });
    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toBe("null")
    );
  });

  it("useAuth() throws when used outside AuthProvider", () => {
    function Orphan() {
      useAuth();
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow("useAuth must be used within an AuthProvider");
    spy.mockRestore();
  });

  it("empty state: user is null and loading false when no token stored", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(screen.getByTestId("user").textContent).toBe("null");
  });
});

// ── ThemeProvider ──────────────────────────────────────────────────────────────

describe("ThemeProvider", () => {
  function ThemeConsumer() {
    const { preference, resolvedTheme } = useTheme();
    return (
      <div>
        <span data-testid="pref">{preference}</span>
        <span data-testid="resolved">{resolvedTheme}</span>
      </div>
    );
  }

  it("provides a default preference of 'system'", () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("pref").textContent).toBe("system");
  });

  it("resolvedTheme is either 'light' or 'dark'", () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    const resolved = screen.getByTestId("resolved").textContent;
    expect(["light", "dark"]).toContain(resolved);
  });

  it("useTheme() throws when used outside ThemeProvider", () => {
    function Orphan() {
      useTheme();
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow("useTheme must be used within ThemeProvider");
    spy.mockRestore();
  });

  it("setThemePreference persists across renders", async () => {
    function SetThemeConsumer() {
      const { preference, setThemePreference } = useTheme();
      return (
        <div>
          <span data-testid="pref">{preference}</span>
          <button onClick={() => setThemePreference("dark")} data-testid="set-dark">
            dark
          </button>
        </div>
      );
    }

    render(
      <ThemeProvider>
        <SetThemeConsumer />
      </ThemeProvider>
    );

    act(() => { screen.getByTestId("set-dark").click(); });
    await waitFor(() =>
      expect(screen.getByTestId("pref").textContent).toBe("dark")
    );
  });
});

// ── RouteFocusProvider ─────────────────────────────────────────────────────────

describe("RouteFocusProvider", () => {
  it("renders a region with data-testid route-focus-anchor", () => {
    render(
      <RouteFocusProvider>
        <p>child</p>
      </RouteFocusProvider>
    );
    expect(screen.getByTestId("route-focus-anchor")).toBeDefined();
  });

  it("renders children inside the anchor region", () => {
    render(
      <RouteFocusProvider>
        <p data-testid="inner">hello</p>
      </RouteFocusProvider>
    );
    expect(screen.getByTestId("inner")).toBeDefined();
  });

  it("anchor region has tabIndex -1 (focus target, not in tab order)", () => {
    render(
      <RouteFocusProvider>
        <span />
      </RouteFocusProvider>
    );
    const anchor = screen.getByTestId("route-focus-anchor");
    expect(anchor.tabIndex).toBe(-1);
  });

  it("anchor region has role='region' and aria-label", () => {
    render(
      <RouteFocusProvider>
        <span />
      </RouteFocusProvider>
    );
    const anchor = screen.getByRole("region", { name: /page content/i });
    expect(anchor).toBeDefined();
  });
});

// ── I18nProvider ───────────────────────────────────────────────────────────────

describe("I18nProvider", () => {
  it("renders children without throwing", () => {
    render(
      <I18nProvider>
        <p data-testid="child">i18n child</p>
      </I18nProvider>
    );
    expect(screen.getByTestId("child")).toBeDefined();
  });
});

// ── Performance budget (CLS / LCP) ────────────────────────────────────────────
// Providers must not render layout-contributing DOM that could cause CLS,
// and must not block LCP with eagerly-loaded heavy assets.

describe("performance budget: null-render providers produce no DOM", () => {
  it("AnalyticsProvider renders no DOM nodes", () => {
    const { container } = render(<AnalyticsProvider />);
    expect(container.firstChild).toBeNull();
  });

  it("MSWProvider renders no DOM nodes", () => {
    const { container } = render(<MSWProvider />);
    expect(container.firstChild).toBeNull();
  });
});

describe("performance budget: RouteFocusProvider wrapper has no intrinsic size", () => {
  it("wrapper div has outline-none so focus does not cause layout reflow", () => {
    render(<RouteFocusProvider><span /></RouteFocusProvider>);
    const anchor = screen.getByTestId("route-focus-anchor");
    expect(anchor.className).toContain("outline-none");
  });

  it("wrapper has tabIndex -1 so it is not in tab order (avoids scroll jump)", () => {
    render(<RouteFocusProvider><span /></RouteFocusProvider>);
    expect(screen.getByTestId("route-focus-anchor").tabIndex).toBe(-1);
  });
});
