import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import PrivacyPolicyPage from "./page";

describe("PrivacyPolicyPage - Accessibility and Focus Order", () => {
  test("main landmark is labelled by the page heading", () => {
    const { container } = render(<PrivacyPolicyPage />);
    expect(
      container.querySelector('main[aria-labelledby="privacy-policy-title"]'),
    ).toBeInTheDocument();
  });

  test("h1 carries the id referenced by aria-labelledby", () => {
    render(<PrivacyPolicyPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toHaveAttribute("id", "privacy-policy-title");
  });

  test("provides a live status region for dynamic announcements", () => {
    const { container } = render(<PrivacyPolicyPage />);
    const status = container.querySelector("#privacy-policy-status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
  });

  test("skip link targets the content region", () => {
    render(<PrivacyPolicyPage />);
    const skipLink = screen.getByRole("link", { name: "Skip to privacy policy" });
    expect(skipLink).toHaveAttribute("href", "#privacy-policy-content");
  });

  test("skip link has visible focus styles", () => {
    render(<PrivacyPolicyPage />);
    const skipLink = screen.getByRole("link", { name: "Skip to privacy policy" });
    expect(skipLink.className).toContain("focus:not-sr-only");
    expect(skipLink.className).toContain("focus:ring-2");
  });

  test("content region carries the id used by the skip link", () => {
    const { container } = render(<PrivacyPolicyPage />);
    expect(container.querySelector("#privacy-policy-content")).toBeInTheDocument();
  });

  test("skip link appears before the back button in DOM order", () => {
    render(<PrivacyPolicyPage />);
    const skipLink = screen.getByRole("link", { name: "Skip to privacy policy" });
    const backLink = screen.getByRole("link", { name: /back to settings/i });
    const focusables = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    expect(focusables.indexOf(skipLink)).toBeLessThan(focusables.indexOf(backLink));
  });

  test("ArrowLeft icon is hidden from assistive technology", () => {
    const { container } = render(<PrivacyPolicyPage />);
    const icon = container.querySelector('svg[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
  });

  test("section headings use h2 elements", () => {
    const { container } = render(<PrivacyPolicyPage />);
    const h2s = container.querySelectorAll("h2");
    expect(h2s.length).toBeGreaterThan(0);
  });
});
