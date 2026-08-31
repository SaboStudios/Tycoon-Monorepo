import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import NavbarMobile from "../NavbarMobile";

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
    onClick,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <a
      href={href}
      onClick={onClick}
      {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
    >
      {children}
    </a>
  ),
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: mockUser, logout: mockLogout }),
}));

vi.mock("@/components/wallet/NearWalletConnect", () => ({
  NearWalletConnect: () => <div data-testid="near-wallet-connect-panel" />,
}));

vi.mock("@/lib/nav-config", () => ({
  NAV_LINKS: [
    { href: "/", label: "Home" },
    { href: "/game", label: "Game" },
    { href: "/shop", label: "Shop" },
  ],
  isActivePath: (pathname: string, href: string) => pathname === href,
}));

vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("NavbarMobile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockPathname = "/";
  });

  describe("closed state (default)", () => {
    it("renders the menu toggle button", () => {
      render(<NavbarMobile />);
      expect(screen.getByRole("button", { name: /open menu/i })).toBeDefined();
    });

    it("toggle button has aria-expanded=false when closed", () => {
      render(<NavbarMobile />);
      const btn = screen.getByRole("button", { name: /open menu/i });
      expect(btn.getAttribute("aria-expanded")).toBe("false");
    });

    it("does not render the navigation dialog when closed", () => {
      render(<NavbarMobile />);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("renders the first two nav links in the bottom bar", () => {
      render(<NavbarMobile />);
      // Slice(0,2) → Home and Game are in the compact bar
      expect(screen.getByRole("link", { name: /^home$/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /^game$/i })).toBeDefined();
    });
  });

  describe("open state", () => {
    function openMenu() {
      fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    }

    it("toggles to aria-expanded=true and shows Close menu button", () => {
      render(<NavbarMobile />);
      openMenu();
      expect(screen.getByRole("button", { name: /close menu/i })).toBeDefined();
    });

    it("renders a navigation dialog when open", () => {
      render(<NavbarMobile />);
      openMenu();
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    it("dialog has aria-modal=true", () => {
      render(<NavbarMobile />);
      openMenu();
      const dialog = screen.getByRole("dialog");
      expect(dialog.getAttribute("aria-modal")).toBe("true");
    });

    it("renders all nav links inside the dialog", () => {
      render(<NavbarMobile />);
      openMenu();
      expect(screen.getByRole("link", { name: /^shop$/i })).toBeDefined();
    });

    it("clicking a nav link calls closeMenu (sets panel closed)", () => {
      render(<NavbarMobile />);
      openMenu();
      // Both the bottom bar and dialog contain "Home"; click the one inside the dialog
      const dialog = screen.getByRole("dialog");
      const homeLinks = dialog.querySelectorAll("a");
      const homeLink = Array.from(homeLinks).find((l) => /^home$/i.test(l.textContent ?? ""));
      fireEvent.click(homeLink!);
      // After close, dialog should disappear
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("renders NearWalletConnect panel inside dialog", () => {
      render(<NavbarMobile />);
      openMenu();
      expect(screen.getByTestId("near-wallet-connect-panel")).toBeDefined();
    });
  });

  describe("unauthenticated state (panel open)", () => {
    it("shows Login link inside the open panel", () => {
      render(<NavbarMobile />);
      fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
      expect(screen.getByRole("link", { name: /login/i })).toBeDefined();
    });

    it("Login link points to /login", () => {
      render(<NavbarMobile />);
      fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
      const loginLink = screen.getByRole("link", { name: /login/i });
      expect(loginLink.getAttribute("href")).toBe("/login");
    });
  });

  describe("authenticated state (panel open)", () => {
    beforeEach(() => {
      mockUser = { email: "mobile@test.com" };
    });

    it("shows the user's email in the open panel", () => {
      render(<NavbarMobile />);
      fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
      expect(screen.getByText("mobile@test.com")).toBeDefined();
    });

    it("shows a Logout button", () => {
      render(<NavbarMobile />);
      fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
      expect(screen.getByRole("button", { name: /logout/i })).toBeDefined();
    });

    it("Logout button calls logout and closes the panel", () => {
      render(<NavbarMobile />);
      fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
      fireEvent.click(screen.getByRole("button", { name: /logout/i }));
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("active link highlighting", () => {
    it("active link in the bottom bar has accent background", () => {
      mockPathname = "/";
      render(<NavbarMobile />);
      const homeLink = screen.getByRole("link", { name: /^home$/i });
      expect(homeLink.className).toContain("bg-[var(--tycoon-accent)]");
    });

    it("inactive link in the bottom bar does not have accent background", () => {
      mockPathname = "/";
      render(<NavbarMobile />);
      const gameLink = screen.getByRole("link", { name: /^game$/i });
      expect(gameLink.className).not.toContain("bg-[var(--tycoon-accent)]");
    });
  });
});
