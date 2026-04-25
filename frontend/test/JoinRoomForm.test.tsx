import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import JoinRoomForm from "../../src/components/settings/JoinRoomForm";

// ─── Mock next/navigation ─────────────────────────────────────────────────────
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

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

describe("JoinRoomForm — UI behaviour (SW-4)", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("renders the input and a disabled Join button initially", () => {
    renderForm();
    expect(getInput()).toBeInTheDocument();
    expect(getButton()).toBeDisabled();
  });

  it("uppercases input and enforces 6-char max", () => {
    renderForm();
    fireEvent.change(getInput(), { target: { value: "abcdefgh" } });
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
    // Force submit via form (button is disabled, so submit the form directly)
    const form = getInput().closest("form")!;
    fireEvent.submit(form);
    expect(screen.getByText(/6 characters/i)).toBeInTheDocument();
  });

  it("navigates to game-waiting with the room code on valid submit", () => {
    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });
    fireEvent.click(getButton());
    expect(pushMock).toHaveBeenCalledWith(
      "/game-waiting?gameCode=TYC001"
    );
  });

  it("clears error when user starts typing again", () => {
    renderForm();
    const form = getInput().closest("form")!;
    fireEvent.submit(form);
    fireEvent.change(getInput(), { target: { value: "A" } });
    expect(screen.queryByText(/6 characters/i)).toBeNull();
  });
});

// ─── MSW fixture parity ───────────────────────────────────────────────────────
// These tests verify that the MSW handler shapes match the GameResponse DTO
// defined in frontend/src/lib/api/types/dto.ts (SW-4 parity requirement).

import { joinRoomHandlers } from "../../src/mocks/joinRoomHandlers";
import { setupServer } from "msw/node";

const server = setupServer(...joinRoomHandlers);

describe("joinRoomHandlers — MSW fixture parity (SW-4)", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it("returns a GameResponse-shaped payload for a valid 6-char code", async () => {
    const res = await fetch("http://localhost:3000/api/v1/games/ABC123/join", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    // Required GameResponse fields
    expect(typeof body.id).toBe("number");
    expect(body.code).toBe("ABC123");
    expect(["PUBLIC", "PRIVATE"]).toContain(body.mode);
    expect(["PENDING", "RUNNING", "FINISHED", "CANCELLED"]).toContain(body.status);
    expect(typeof body.number_of_players).toBe("number");
    expect(Array.isArray(body.players)).toBe(true);

    // Required GameSettingsResponse fields
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
});
