import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import PlayWithAISettingsPage from "./page";

vi.mock("@/clients/PlayWithAISettingsClient", () => ({
  default: () => (
    <div data-testid="play-ai-client">
      <button type="button">Initialize Session</button>
    </div>
  ),
}));

describe("PlayWithAISettingsPage - Accessibility and Focus Order", () => {
  test("renders main landmark with aria-label", () => {
    const { container } = render(<PlayWithAISettingsPage />);
    expect(
      container.querySelector('main[aria-label="Play with AI"]'),
    ).toBeInTheDocument();
  });

  test("includes a visually hidden h1 heading", () => {
    render(<PlayWithAISettingsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Play with AI" }),
    ).toBeInTheDocument();
  });

  test("provides a live status region for dynamic announcements", () => {
    const { container } = render(<PlayWithAISettingsPage />);
    const status = container.querySelector("#play-ai-status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
  });

  test("skip link targets the content section", () => {
    render(<PlayWithAISettingsPage />);
    const skipLink = screen.getByRole("link", { name: "Skip to play with AI" });
    expect(skipLink).toHaveAttribute("href", "#play-ai-content");
  });

  test("skip link has visible focus styles", () => {
    render(<PlayWithAISettingsPage />);
    const skipLink = screen.getByRole("link", { name: "Skip to play with AI" });
    expect(skipLink.className).toContain("focus:not-sr-only");
    expect(skipLink.className).toContain("focus:ring-2");
  });

  test("content section carries the id used by the skip link", () => {
    const { container } = render(<PlayWithAISettingsPage />);
    const section = container.querySelector(
      'section[aria-label="Play with AI settings"]',
    );
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute("id", "play-ai-content");
  });

  test("skip link appears before the action button in DOM order", () => {
    render(<PlayWithAISettingsPage />);
    const skipLink = screen.getByRole("link", { name: "Skip to play with AI" });
    const actionBtn = screen.getByRole("button", { name: "Initialize Session" });
    const focusables = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    expect(focusables.indexOf(skipLink)).toBeLessThan(
      focusables.indexOf(actionBtn),
    );
  });

  test("content section applies focus-visible styles to descendants", () => {
    const { container } = render(<PlayWithAISettingsPage />);
    const section = container.querySelector("#play-ai-content");
    expect(section?.className).toContain("focus-visible");
  });

  test("PlayWithAISettingsClient is rendered inside the content section", () => {
    const { container } = render(<PlayWithAISettingsPage />);
    const section = container.querySelector("#play-ai-content");
    expect(section?.querySelector('[data-testid="play-ai-client"]')).toBeInTheDocument();
  });
});
