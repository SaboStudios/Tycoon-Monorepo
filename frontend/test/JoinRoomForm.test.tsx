import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import JoinRoomForm from "@/components/settings/JoinRoomForm";

// ─── Mock next/navigation ─────────────────────────────────────────────────────
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

// ─── Mock apiClient ───────────────────────────────────────────────────────────
const postMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: { post: (...args: unknown[]) => postMock(...args) },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function renderForm() {
  return render(<JoinRoomForm />);
}

function getInput() {
  return screen.getByRole("textbox");
}

function getButton() {
  return screen.getByRole("button", { name: /join/i });
}

// ─── UI behaviour ─────────────────────────────────────────────────────────────

describe("JoinRoomForm — UI behaviour (SW-FE-015)", () => {
  beforeEach(() => {
    pushMock.mockClear();
    postMock.mockClear();
    postMock.mockResolvedValue({ id: 1, code: "TYC001" });
  });

  it("renders the input and a disabled Join button initially", () => {
    renderForm();
    expect(getInput()).toBeInTheDocument();
    expect(getButton()).toBeDisabled();
  });

  it("strips non-alphanumeric chars, uppercases, and enforces 6-char max", () => {
    renderForm();
    // Special chars stripped, lowercase uppercased, capped at 6
    fireEvent.change(getInput(), { target: { value: "ab!c@d#efgh" } });
    expect((getInput() as HTMLInputElement).value).toBe("ABCDEF");
  });

  it("enables Join button only when exactly 6 alphanumeric chars entered", () => {
    renderForm();
    fireEvent.change(getInput(), { target: { value: "ABC12" } });
    expect(getButton()).toBeDisabled();
    fireEvent.change(getInput(), { target: { value: "ABC123" } });
    expect(getButton()).not.toBeDisabled();
  });

  it("shows validation error when submitted with short code", () => {
    renderForm();
    fireEvent.change(getInput(), { target: { value: "AB" } });
    const form = getInput().closest("form")!;
    fireEvent.submit(form);
    expect(screen.getByText(/6 characters/i)).toBeInTheDocument();
  });

  it("navigates to game-waiting with the room code on valid submit", async () => {
    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });
    fireEvent.click(getButton());
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/game-waiting?gameCode=TYC001");
    });
  });

  it("clears field error when user starts typing again", () => {
    renderForm();
    const form = getInput().closest("form")!;
    fireEvent.submit(form);
    fireEvent.change(getInput(), { target: { value: "A" } });
    expect(screen.queryByText(/6 characters/i)).toBeNull();
  });

  it("input has aria-required=true", () => {
    renderForm();
    expect(getInput()).toHaveAttribute("aria-required", "true");
  });

  it("input has spellCheck=false", () => {
    renderForm();
    expect(getInput()).toHaveAttribute("spellcheck", "false");
  });
});

// ─── Security: input sanitisation ────────────────────────────────────────────

describe("JoinRoomForm — input sanitisation (SW-FE-015)", () => {
  beforeEach(() => {
    postMock.mockResolvedValue({ id: 1, code: "TYC001" });
  });

  it("strips spaces from pasted input", () => {
    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC 01" } });
    expect((getInput() as HTMLInputElement).value).toBe("TYC01");
  });

  it("strips special characters on change", () => {
    renderForm();
    fireEvent.change(getInput(), { target: { value: "TY<C>1" } });
    expect((getInput() as HTMLInputElement).value).toBe("TYC1");
  });

  it("normalises lowercase to uppercase on change", () => {
    renderForm();
    fireEvent.change(getInput(), { target: { value: "tyc001" } });
    expect((getInput() as HTMLInputElement).value).toBe("TYC001");
  });
});

// ─── Security: client-side rate limiting ─────────────────────────────────────

describe("JoinRoomForm — rate limiting (SW-FE-015)", () => {
  beforeEach(() => {
    pushMock.mockClear();
    postMock.mockClear();
    postMock.mockResolvedValue({ id: 1, code: "TYC001" });
  });

  it("shows rate-limit error when submitted twice within cooldown window", async () => {
    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });

    // First submit — succeeds
    fireEvent.click(getButton());
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));

    // Second submit immediately (within 2s cooldown) — should be rate-limited
    // Re-enable the button by resetting loading state first
    await waitFor(() => expect(getButton()).not.toBeDisabled());
    fireEvent.click(getButton());

    await waitFor(() => {
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/please wait/i);
    });
    // API should not have been called a second time
    expect(postMock).toHaveBeenCalledTimes(1);
  });
});

// ─── MSW fixture parity ───────────────────────────────────────────────────────

import { joinRoomHandlers } from "@/mocks/joinRoomHandlers";
import { setupServer } from "msw/node";

const server = setupServer(...joinRoomHandlers);

describe("joinRoomHandlers — MSW fixture parity (SW-FE-015)", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it("returns a GameResponse-shaped payload for a valid 6-char code", async () => {
    const res = await fetch("http://localhost:3000/api/v1/games/ABC123/join", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(typeof body.id).toBe("number");
    expect(body.code).toBe("ABC123");
    expect(["PUBLIC", "PRIVATE"]).toContain(body.mode);
    expect(["PENDING", "RUNNING", "FINISHED", "CANCELLED"]).toContain(body.status);
    expect(typeof body.number_of_players).toBe("number");
    expect(Array.isArray(body.players)).toBe(true);
    expect(typeof body.settings.starting_cash).toBe("number");
    expect(typeof body.settings.max_players).toBe("number");
    expect(typeof body.settings.allow_spectators).toBe("boolean");
  });

  it("returns 404 for the NOTFND fixture", async () => {
    const res = await fetch("http://localhost:3000/api/v1/games/NOTFND/join", {
      method: "POST",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe("Game not found");
  });

  it("returns 409 for the FULL00 fixture", async () => {
    const res = await fetch("http://localhost:3000/api/v1/games/FULL00/join", {
      method: "POST",
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toBe("Game is full");
  });

  it("NOTFND handler takes precedence over generic handler", async () => {
    // Verifies handler ordering is correct — specific before generic
    const res = await fetch("http://localhost:3000/api/v1/games/NOTFND/join", {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  it("FULL00 handler takes precedence over generic handler", async () => {
    const res = await fetch("http://localhost:3000/api/v1/games/FULL00/join", {
      method: "POST",
    });
    expect(res.status).toBe(409);
  });
});
