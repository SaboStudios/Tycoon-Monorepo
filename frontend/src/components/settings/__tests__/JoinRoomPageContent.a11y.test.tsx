/**
 * #835 Join room flow — accessibility and focus order
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import JoinRoomPageContent from "../JoinRoomPageContent";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock("@/hooks/useJoinRoomTelemetry", () => ({
  useJoinRoomTelemetry: () => ({
    trackFormViewed: vi.fn(),
    trackJoinAttempted: vi.fn(),
    trackJoinSucceeded: vi.fn(),
    trackJoinFailed: vi.fn(),
  }),
}));

vi.mock("@/hooks/useErrorReporting", () => ({
  useErrorReporting: () => ({ reportError: vi.fn(), clearErrors: vi.fn(), lastError: null, errorHistory: [] }),
}));

vi.mock("@/lib/join-room/security", () => ({
  hasJoinAuthToken: () => true,
  mapJoinRoomErrors: () => ({ _form: "error" }),
  sanitiseRoomCode: (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: { post: vi.fn() },
}));

describe("JoinRoomPageContent accessibility (#835)", () => {
  it("renders a <main> landmark", () => {
    render(<JoinRoomPageContent />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("has a single h1 inside the page", () => {
    render(<JoinRoomPageContent />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
  });

  it("auto-focuses the room code input on mount", () => {
    render(<JoinRoomPageContent />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveFocus();
  });

  it("tab order: input comes before submit button in DOM", () => {
    render(<JoinRoomPageContent />);
    const input = screen.getByRole("textbox");
    const submitBtn = screen.getByRole("button", { name: /join/i });

    // Verify DOM order: input should appear before button
    const position = input.compareDocumentPosition(submitBtn);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("input has aria-required", () => {
    render(<JoinRoomPageContent />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-required", "true");
  });
});
