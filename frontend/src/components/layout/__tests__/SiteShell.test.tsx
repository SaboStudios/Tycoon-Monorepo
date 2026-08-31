import React from "react";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { SiteShell } from "../site-shell";
import { ShellErrorBoundary } from "../shell-error-boundary";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />
  ),
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: null, logout: vi.fn() }),
}));

vi.mock("@/components/wallet/NearWalletConnect", () => ({
  NearWalletConnect: () => <div data-testid="near-wallet-connect" />,
}));

vi.mock("@/lib/nav-config", () => ({
  NAV_LINKS: [
    { href: "/", label: "Home" },
    { href: "/game", label: "Game" },
  ],
  isActivePath: (pathname: string, href: string) => pathname === href,
}));

vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

describe("SiteShell", () => {
  describe("layout structure", () => {
    it("renders a skip-to-content link", () => {
      render(<SiteShell><p>content</p></SiteShell>);
      const skipLink = screen.getByRole("link", { name: /skip to content/i });
      expect(skipLink).toBeDefined();
      expect(skipLink.getAttribute("href")).toBe("#main");
    });

    it("skip link uses fixed positioning on focus (no CLS from absolute overflow)", () => {
      render(<SiteShell><p>content</p></SiteShell>);
      const skipLink = screen.getByRole("link", { name: /skip to content/i });
      expect(skipLink.className).toContain("focus:fixed");
      expect(skipLink.className).not.toContain("focus:absolute");
    });

    it("renders the main landmark with correct id", () => {
      render(<SiteShell><p>content</p></SiteShell>);
      const main = screen.getByRole("main");
      expect(main.id).toBe("main");
    });

    it("main element has tabIndex -1 for skip-link focus target", () => {
      render(<SiteShell><p>content</p></SiteShell>);
      const main = screen.getByRole("main");
      expect(main.tabIndex).toBe(-1);
    });

    it("main element has min-h-0 class to prevent flex overflow CLS", () => {
      render(<SiteShell><p>content</p></SiteShell>);
      const main = screen.getByRole("main");
      expect(main.className).toContain("min-h-0");
    });

    it("main element has scroll-mt-16 to align with sticky header height", () => {
      render(<SiteShell><p>content</p></SiteShell>);
      const main = screen.getByRole("main");
      expect(main.className).toContain("scroll-mt-16");
    });

    it("renders children inside main", () => {
      render(<SiteShell><p data-testid="child">hello</p></SiteShell>);
      expect(screen.getByTestId("child")).toBeDefined();
    });

    it("renders outer shell with min-h-dvh flex column", () => {
      const { container } = render(<SiteShell><p>x</p></SiteShell>);
      const shell = container.firstChild as HTMLElement;
      expect(shell.className).toContain("flex");
      expect(shell.className).toContain("min-h-dvh");
      expect(shell.className).toContain("flex-col");
    });
  });

  describe("performance budget", () => {
    it("does not render any images in the shell wrapper itself", () => {
      const { container } = render(<SiteShell><p>x</p></SiteShell>);
      // Images belong to Navbar/Footer children, not directly to the shell div
      const shellDiv = container.firstChild as HTMLElement;
      const directImgs = Array.from(shellDiv.children).filter(
        (c) => c.tagName === "IMG"
      );
      expect(directImgs).toHaveLength(0);
    });

    it("renders a footer landmark", () => {
      render(<SiteShell><p>x</p></SiteShell>);
      expect(screen.getByRole("contentinfo")).toBeDefined();
    });

    it("outer shell has stable background color class to prevent flash-of-white CLS", () => {
      const { container } = render(<SiteShell><p>x</p></SiteShell>);
      const shell = container.firstChild as HTMLElement;
      expect(shell.className).toContain("bg-[var(--tycoon-bg)]");
    });
  });

  describe("accessibility", () => {
    it("main element has outline-none to suppress default focus ring", () => {
      render(<SiteShell><p>x</p></SiteShell>);
      expect(screen.getByRole("main").className).toContain("outline-none");
    });

    it("main element has pb-24 for mobile nav bar clearance", () => {
      render(<SiteShell><p>x</p></SiteShell>);
      expect(screen.getByRole("main").className).toContain("pb-24");
    });

    it("main element has flex-1 to fill available vertical space", () => {
      render(<SiteShell><p>x</p></SiteShell>);
      expect(screen.getByRole("main").className).toContain("flex-1");
    });

    it("skip link has sr-only class so it is hidden until focused", () => {
      render(<SiteShell><p>x</p></SiteShell>);
      const skipLink = screen.getByRole("link", { name: /skip to content/i });
      expect(skipLink.className).toContain("sr-only");
    });

    it("skip link has focus:z-[100] to appear above overlays when focused", () => {
      render(<SiteShell><p>x</p></SiteShell>);
      const skipLink = screen.getByRole("link", { name: /skip to content/i });
      expect(skipLink.className).toContain("focus:z-[100]");
    });
  });

  describe("slot variations", () => {
    it("renders multiple children inside main", () => {
      render(
        <SiteShell>
          <p data-testid="a">A</p>
          <p data-testid="b">B</p>
        </SiteShell>
      );
      expect(screen.getByTestId("a")).toBeDefined();
      expect(screen.getByTestId("b")).toBeDefined();
    });

    it("renders deeply nested children without loss", () => {
      render(
        <SiteShell>
          <div>
            <section>
              <p data-testid="deep">deep</p>
            </section>
          </div>
        </SiteShell>
      );
      expect(screen.getByTestId("deep")).toBeDefined();
    });
  });

  describe("accessibility", () => {
    it("main element has outline-none to suppress default focus ring", () => {
      render(<SiteShell><p>x</p></SiteShell>);
      const main = screen.getByRole("main");
      expect(main.className).toContain("outline-none");
    });

    it("main element has pb-24 for mobile nav clearance", () => {
      render(<SiteShell><p>x</p></SiteShell>);
      const main = screen.getByRole("main");
      expect(main.className).toContain("pb-24");
    });
  });
});

describe("ShellErrorBoundary", () => {
  function Bomb() {
    throw new Error("boom");
  }

  it("renders children when no error", () => {
    render(
      <ShellErrorBoundary>
        <p data-testid="ok">fine</p>
      </ShellErrorBoundary>
    );
    expect(screen.getByTestId("ok")).toBeDefined();
  });

  it("renders default fallback on render error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ShellErrorBoundary>
        <Bomb />
      </ShellErrorBoundary>
    );
    expect(screen.getByTestId("shell-error-fallback")).toBeDefined();
    expect(screen.getByRole("alert")).toBeDefined();
    spy.mockRestore();
  });

  it("renders custom fallback when provided", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ShellErrorBoundary fallback={<p data-testid="custom-fb">oops</p>}>
        <Bomb />
      </ShellErrorBoundary>
    );
    expect(screen.getByTestId("custom-fb")).toBeDefined();
    spy.mockRestore();
  });

  it("renders empty state when children is null", () => {
    render(<ShellErrorBoundary>{null}</ShellErrorBoundary>);
    expect(screen.getByTestId("shell-empty-state")).toBeDefined();
  });

  it("renders empty state when children is undefined", () => {
    render(<ShellErrorBoundary>{undefined}</ShellErrorBoundary>);
    expect(screen.getByTestId("shell-empty-state")).toBeDefined();
  });

  it("SiteShell wraps children in error boundary — shows fallback on crash", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <SiteShell errorFallback={<p data-testid="page-error">page crashed</p>}>
        <Bomb />
      </SiteShell>
    );
    expect(screen.getByTestId("page-error")).toBeDefined();
    spy.mockRestore();
  });
});
