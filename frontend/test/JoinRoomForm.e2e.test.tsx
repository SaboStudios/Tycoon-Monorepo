/**
 * E2E: JoinRoomForm — happy path + validation errors + security hardening
 * SW-FE-015: Join room flow security hardening review
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

import userEvent from "@testing-library/user-event";
import "./mocks/join-room-i18n";
import JoinRoomForm from "@/components/settings/JoinRoomForm";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock apiClient — all error scenarios go through the API call now
const mockPost = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: { post: (...args: unknown[]) => mockPost(...args) },
}));

beforeEach(() => {
  mockPush.mockClear();
  mockPost.mockClear();
  mockPost.mockResolvedValue({ id: 1, code: "TYC001" });
  localStorage.setItem("access_token", "test-token");
});

afterEach(() => {
  localStorage.removeItem("access_token");
});

describe("JoinRoomForm", () => {
  it("renders accessible label, hint, and disabled submit", () => {
    render(<JoinRoomForm />);
    expect(screen.getByLabelText(/room code/i)).toBeInTheDocument();
    expect(screen.getByText(/6-character alphanumeric/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /join/i })).toBeDisabled();
  });

  it("focuses the room-code input on mount", () => {
    render(<JoinRoomForm />);
    expect(document.activeElement).toBe(screen.getByLabelText(/room code/i));
  });

  it("input has aria-required=true", () => {
    render(<JoinRoomForm />);
    expect(screen.getByLabelText(/room code/i)).toHaveAttribute("aria-required", "true");
  });

  it("submit button has aria-disabled when form is invalid", () => {
    render(<JoinRoomForm />);
    expect(screen.getByRole("button", { name: /join/i })).toHaveAttribute("aria-disabled", "true");
  });

  it("submit button aria-disabled is false when code is valid", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), "TYC001");
    expect(screen.getByRole("button", { name: /join/i })).toHaveAttribute("aria-disabled", "false");
  });

  it("shows validation error for invalid room code (too short)", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), "AB");
    const form = screen.getByRole("button", { name: /join/i }).closest("form")!;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/exactly 6 characters/i);
    });
  });

  it("happy path: valid 6-char code calls API and navigates to game-waiting", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/games/TYC001/join",
        {}
      );
      expect(mockPush).toHaveBeenCalledWith("/game-waiting?gameCode=TYC001");
    });
  });

  it("blocks join when user is not authenticated", async () => {
    const user = userEvent.setup();
    localStorage.removeItem("access_token");
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() => {
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/sign in/i);
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("shows loading state while API call is in flight", async () => {
    const user = userEvent.setup();
    // Never resolves during this test
    mockPost.mockReturnValue(new Promise(() => {}));
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    expect(screen.getByRole("button", { name: /joining/i })).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

// ── Error & empty state regression tests (SW-FE-037) ────────────────────────
describe("JoinRoomForm error and empty states (SW-FE-037)", () => {
  it("no form-level banner on initial render", () => {
    render(<JoinRoomForm />);
    expect(screen.queryByTestId("form-error-banner")).not.toBeInTheDocument();
  });

  it("shows form-level banner with room-not-found message on 404", async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValue({ statusCode: 404 });
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() => {
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/room not found/i);
    });
  });

  it("shows room-full message for 409", async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValue({ statusCode: 409 });
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() => {
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/room is full/i);
    });
  });

  it("shows retry button inside banner when code is valid", async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValue({ statusCode: 404 });
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() => screen.getByTestId("form-error-banner"));
    expect(screen.getByRole("button", { name: /retry joining/i })).toBeInTheDocument();
  });

  it("_form error persists when user edits the input (field error clears, banner stays)", async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValue({ statusCode: 404 });
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() => screen.getByTestId("form-error-banner"));
    // Editing should NOT clear the _form banner
    await user.type(screen.getByLabelText(/room code/i), "X");
    expect(screen.getByTestId("form-error-banner")).toBeInTheDocument();
  });

  it("banner is dismissed after retry clears errors and succeeds", async () => {
    const user = userEvent.setup();
    mockPost
      .mockRejectedValueOnce({ statusCode: 404 })
      .mockResolvedValueOnce({ id: 1, code: "TYC001" });

    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() => screen.getByTestId("form-error-banner"));

    const retryBtn = screen.getByRole("button", { name: /retry joining/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("form-error-banner")).not.toBeInTheDocument();
    });
  });
});

// ── CLS / LCP regression tests (SW-FE-036) ──────────────────────────────────
describe("JoinRoomForm CLS / LCP regression (SW-FE-036)", () => {
  it("error slot is always present in the DOM before any error", () => {
    const { container } = render(<JoinRoomForm />);
    const errorSlot = container.querySelector(".min-h-\\[1\\.25rem\\]");
    expect(errorSlot).toBeInTheDocument();
  });

  it("submit button label span has min-w class to prevent width shift", () => {
    render(<JoinRoomForm />);
    const btn = screen.getByRole("button", { name: /join/i });
    const labelSpan = btn.querySelector("span.min-w-\\[4\\.5rem\\]");
    expect(labelSpan).toBeInTheDocument();
  });
});

// ── Keyboard shortcuts (SW-FE-845) ────────────────────────────────────────────

describe("JoinRoomForm — keyboard shortcuts (SW-FE-845)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPost.mockClear();
    mockPost.mockResolvedValue({ id: 1, code: "TYC001" });
  });

  it("Escape clears the input when focused", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    const input = screen.getByLabelText(/room code/i);
    await user.type(input, "TYC001");
    expect(input).toHaveValue("TYC001");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
  });

  it("Escape does not clear when input is not focused", () => {
    render(<JoinRoomForm />);
    const input = screen.getByLabelText(/room code/i) as HTMLInputElement;
    // Type into input
    fireEvent.change(input, { target: { value: "TYC001" } });
    expect(input.value).toBe("TYC001");
    // Blur the input
    input.blur();
    // Press Escape on document
    fireEvent.keyDown(document, { key: "Escape" });
    // Input should still have the value
    expect(input.value).toBe("TYC001");
  });

  it("Ctrl+Enter submits the form", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), "TYC001");
    fireEvent.keyDown(document, { key: "Enter", ctrlKey: true });
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/games/TYC001/join", {});
    });
  });

  it("Cmd+Enter submits the form (macOS)", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), "TYC001");
    fireEvent.keyDown(document, { key: "Enter", metaKey: true });
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/games/TYC001/join", {});
    });
  });

  it("form has aria-keyshortcuts attribute", () => {
    render(<JoinRoomForm />);
    const form = screen.getByRole("button", { name: /join/i }).closest("form");
    expect(form).toHaveAttribute("aria-keyshortcuts");
  });
});

// ── serverErrorMap unit tests ─────────────────────────────────────────────────

import { mapServerErrors } from "@/lib/validation";

describe("mapServerErrors", () => {
  it("returns _form fallback for null", () => {
    expect(mapServerErrors(null)).toEqual({ _form: "An unexpected error occurred" });
  });

  it("returns _form fallback for undefined", () => {
    expect(mapServerErrors(undefined)).toEqual({ _form: "An unexpected error occurred" });
  });

  it("maps explicit errors array to fields", () => {
    const err = { errors: [{ field: "roomCode", message: "invalid" }] };
    expect(mapServerErrors(err)).toEqual({ roomCode: "invalid" });
  });

  it("maps NestJS string[] message to _form when keyword case doesn't match", () => {
    // serverErrorMap lowercases the message but compares against camelCase keywords,
    // so "roomCode must be valid" → lower = "roomcode must be valid" which does NOT
    // include "roomCode" (case-sensitive). Falls through to _form.
    const err = { message: ["roomCode must be valid"], statusCode: 400 };
    expect(mapServerErrors(err)).toEqual({ _form: "roomCode must be valid" });
  });

  it("maps plain string message to _form when no keyword matches", () => {
    const err = { message: "something went wrong" };
    expect(mapServerErrors(err)).toEqual({ _form: "something went wrong" });
  });

  it("maps 404 statusCode to room-not-found message", () => {
    expect(mapServerErrors({ statusCode: 404 })).toEqual({
      _form: "Room not found. Check the code and try again.",
    });
  });

  it("maps 409 statusCode to room-full message", () => {
    expect(mapServerErrors({ statusCode: 409 })).toEqual({
      _form: "Room is full. Try a different room.",
    });
  });

  it("maps 401 statusCode to sign-in message", () => {
    expect(mapServerErrors({ statusCode: 401 })).toEqual({
      _form: "Please sign in to join a room.",
    });
  });

  it("maps 410 statusCode to expired invite message", () => {
    expect(mapServerErrors({ statusCode: 410 })).toEqual({
      _form: "This invite link has expired. Ask the host for a new one.",
    });
  });

  it("maps 500 statusCode to server-error message", () => {
    expect(mapServerErrors({ statusCode: 500 })).toEqual({
      _form: "Server error. Please try again in a moment.",
    });
  });
});
