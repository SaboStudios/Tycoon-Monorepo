import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next font utilities before importing the layout
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

// Mock local font exports
vi.mock("@/lib/fonts", () => ({
  kronaOne: { variable: "--krona-one" },
  orbitron: { variable: "--orbitron" },
  dmSans: { variable: "--dm-sans" },
}));

// Mock css import
vi.mock("../globals.css", () => ({}), { virtual: true });

// Mock providers and components used by layout
const MockProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <div data-testid="mock-provider">{children}</div>
);

vi.mock("@/components/providers/analytics-provider", () => ({
  AnalyticsProvider: MockProvider,
}));
vi.mock("@/components/providers/toast-provider", () => ({
  ToastProvider: MockProvider,
}));
vi.mock("@/components/providers/theme-provider", () => ({
  ThemeProvider: MockProvider,
}));
vi.mock("@/components/providers/auth-provider", () => ({
  AuthProvider: MockProvider,
}));
vi.mock("@/components/providers/near-wallet-provider", () => ({
  NearWalletProvider: MockProvider,
}));
vi.mock("@/components/providers/pwa-provider", () => ({
  PWAProvider: MockProvider,
}));
vi.mock("@/components/providers/msw-provider", () => ({
  MSWProvider: () => <div data-testid="msw" />,
}));

vi.mock("@/components/ui/scroll-to-top-btn", () => ({
  ScrollToTopBtn: () => <div data-testid="scroll-top" />,
}));
vi.mock("@/components/ui/error-boundary", () => ({
  ErrorBoundary: ({ children }: any) => <div data-testid="error-boundary">{children}</div>,
}));
vi.mock("@/lib/metadata", () => ({
  generateBaseMetadata: () => ({}),
}));
vi.mock("@/lib/theme", () => ({ THEME_BOOTSTRAP_SCRIPT: "" }));

vi.mock("@/components/shared/Navbar", () => ({ default: () => <div data-testid="navbar">nav</div> }));
vi.mock("@/components/shared/NavbarMobile", () => ({ default: () => <div data-testid="navbar-mobile">mobile</div> }));

// Now import the layout module under test
import RootLayout, { isDev } from "../layout";

describe("RootLayout", () => {
  it("exports isDev as a boolean", () => {
    expect(typeof isDev).toBe("boolean");
  });

  it("renders children when provided", () => {
    render(
      // @ts-expect-error - testing server component style
      <RootLayout>
        <div>hello world</div>
      </RootLayout>
    );

    expect(screen.getByText("hello world")).toBeDefined();
    expect(screen.getByTestId("navbar")).toBeDefined();
    expect(screen.getByTestId("navbar-mobile")).toBeDefined();
  });

  it("handles null children without throwing", () => {
    render(
      // @ts-expect-error - testing server component style
      <RootLayout>{null}</RootLayout>
    );

    expect(screen.queryByText("hello world")).toBeNull();
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("handles undefined children without throwing", () => {
    render(
      // @ts-expect-error - testing server component style
      <RootLayout />
    );

    expect(screen.getByTestId("navbar")).toBeDefined();
  });
});
