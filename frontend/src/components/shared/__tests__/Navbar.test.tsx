import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import Navbar from "../Navbar";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockLogout = vi.fn();
let mockUser: { email: string } | null = null;
let mockPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />
  ),
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: mockUser, logout: mockLogout }),
}));

vi.mock("@/components/wallet/NearWalletConnect", () => ({
  NearWalletConnect: () => <div data-testid="near-wallet-connect" />,
}));

vi.mock("@/lib/nav-config", () => ({
  NAV_LINKS: [
    { href: "/", label: "Home" },
    { href: "/game", label: "Game" },
    { href: "/shop", label: "Shop" },
  ],
  isActivePath: (pathname: string, href: string) => pathname === href,
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Navbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockPathname = "/";
  });

  describe("structure", () => {
    it("renders a header landmark", () => {
      render(<Navbar />);
      expect(screen.getByRole("banner")).toBeDefined();
    });

    it("renders primary navigation", () => {
      render(<Navbar />);
      expect(screen.getByRole("navigation", { name: /primary/i })).toBeDefined();
    });

    it("renders the brand logo link pointing to /", () => {
      render(<Navbar />);
      const logoLink = screen.getAllByRole("link").find(
        (l) => l.getAttribute("href") === "/"
      );
      expect(logoLink).toBeDefined();
    });

    it("renders all nav links", () => {
      render(<Navbar />);
      expect(screen.getByRole("link", { name: /home/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /game/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /shop/i })).toBeDefined();
    });

    it("renders the settings icon link pointing to /settings", () => {
      render(<Navbar />);
      const settingsLink = screen.getByRole("link", { name: "" });
      // Settings link href should point to /settings
      const allLinks = screen.getAllByRole("link");
      const settingsHref = allLinks.find(
        (l) => l.getAttribute("href") === "/settings"
      );
      expect(settingsHref).toBeDefined();
    });

    it("renders NearWalletConnect", () => {
      render(<Navbar />);
      expect(screen.getByTestId("near-wallet-connect")).toBeDefined();
    });
  });

  describe("unauthenticated state", () => {
    it("shows Login link when no user", () => {
      mockUser = null;
      render(<Navbar />);
      expect(screen.getByRole("link", { name: /login/i })).toBeDefined();
    });

    it("Login link points to /login", () => {
      render(<Navbar />);
      const loginLink = screen.getByRole("link", { name: /login/i });
      expect(loginLink.getAttribute("href")).toBe("/login");
    });

    it("does not show Logout button when no user", () => {
      render(<Navbar />);
      expect(screen.queryByRole("button", { name: /logout/i })).toBeNull();
    });
  });

  describe("authenticated state", () => {
    beforeEach(() => {
      mockUser = { email: "player@test.com" };
    });

    it("shows the user's email", () => {
      render(<Navbar />);
      expect(screen.getByText("player@test.com")).toBeDefined();
    });

    it("shows a Logout button", () => {
      render(<Navbar />);
      expect(screen.getByRole("button", { name: /logout/i })).toBeDefined();
    });

    it("calls logout when Logout button is clicked", () => {
      render(<Navbar />);
      fireEvent.click(screen.getByRole("button", { name: /logout/i }));
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    it("does not show Login link when user is logged in", () => {
      render(<Navbar />);
      expect(screen.queryByRole("link", { name: /login/i })).toBeNull();
    });
  });

  describe("active link highlighting", () => {
    it("active nav link has the accent background class", () => {
      mockPathname = "/game";
      render(<Navbar />);
      const gameLink = screen.getByRole("link", { name: /^game$/i });
      expect(gameLink.className).toContain("bg-[var(--tycoon-accent)]");
    });

    it("inactive nav links do not have the accent background class", () => {
      mockPathname = "/";
      render(<Navbar />);
      const gameLink = screen.getByRole("link", { name: /^game$/i });
      expect(gameLink.className).not.toContain("bg-[var(--tycoon-accent)]");
    });
  });
});
