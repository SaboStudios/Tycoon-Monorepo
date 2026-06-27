import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OfflinePage from "./page";

vi.mock("@/components/offline/OfflineStatus", () => ({
  default: () => (
    <div data-testid="offline-status">
      <button type="button">Retry connection</button>
    </div>
  ),
}));

describe("Offline page", () => {
  it("renders an accessible landmark and keeps focusable action order", () => {
    const { container } = render(<OfflinePage />);

    expect(
      container.querySelector('main[aria-labelledby="offline-page-title"]'),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /offline shell/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to home/i })).toBeInTheDocument();

    const focusables = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );

    expect(focusables[0]).toBe(screen.getByRole("button", { name: /retry connection/i }));
    expect(focusables[1]).toBe(screen.getByRole("link", { name: /back to home/i }));
  });
});
