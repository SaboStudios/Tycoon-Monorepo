import React from "react";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import Footer from "../Footer";

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

describe("Footer", () => {
  describe("landmark & structure", () => {
    it("renders a footer landmark", () => {
      render(<Footer />);
      expect(screen.getByRole("contentinfo")).toBeDefined();
    });

    it("renders the Tycoon logo link pointing to home", () => {
      render(<Footer />);
      const logoLink = screen.getByRole("link", { name: /tycoon/i });
      expect(logoLink.getAttribute("href")).toBe("/");
    });

    it("renders the copyright notice with the current year", () => {
      render(<Footer />);
      const year = String(new Date().getFullYear());
      expect(screen.getByText(new RegExp(year))).toBeDefined();
    });

    it("renders 'All rights reserved' text", () => {
      render(<Footer />);
      expect(screen.getByText(/all rights reserved/i)).toBeDefined();
    });
  });

  describe("social links", () => {
    it("renders a Facebook link", () => {
      render(<Footer />);
      expect(screen.getByRole("link", { name: /facebook/i })).toBeDefined();
    });

    it("Facebook link opens in a new tab with noopener", () => {
      render(<Footer />);
      const link = screen.getByRole("link", { name: /facebook/i });
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    });

    it("renders an X (Twitter) link", () => {
      render(<Footer />);
      expect(screen.getByRole("link", { name: /x \(twitter\)/i })).toBeDefined();
    });

    it("renders a GitHub link", () => {
      render(<Footer />);
      expect(screen.getByRole("link", { name: /github/i })).toBeDefined();
    });

    it("renders a Telegram/Discord link", () => {
      render(<Footer />);
      const telegramLink = screen.getByRole("link", { name: /telegram/i });
      expect(telegramLink).toBeDefined();
    });

    it("all social links open in new tab", () => {
      render(<Footer />);
      const socialNames = ["facebook", "x \\(twitter\\)", "github", "telegram"];
      for (const name of socialNames) {
        const link = screen.getByRole("link", { name: new RegExp(name, "i") });
        expect(link.getAttribute("target")).toBe("_blank");
      }
    });
  });

  describe("logo image", () => {
    it("renders the footer logo image", () => {
      render(<Footer />);
      const img = screen.getByRole("img", { name: /tycoon/i });
      expect(img).toBeDefined();
    });

    it("logo image has explicit width and height attributes (CLS prevention)", () => {
      render(<Footer />);
      const img = screen.getByRole("img", { name: /tycoon/i });
      expect(Number(img.getAttribute("width"))).toBeGreaterThan(0);
      expect(Number(img.getAttribute("height"))).toBeGreaterThan(0);
    });
  });
});
