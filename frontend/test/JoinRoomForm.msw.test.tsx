/**
 * Join room flow — MSW integration tests (#842).
 * Uses real apiClient + MSW handlers (no apiClient mock).
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "./mocks/join-room-i18n";
import JoinRoomForm from "@/components/settings/JoinRoomForm";
import { joinRoomHandlers } from "@/mocks/joinRoomHandlers";
import { JOIN_ROOM_FIXTURE_CODES } from "@/mocks/fixtures/joinRoom";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const server = setupServer(...joinRoomHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  localStorage.setItem("access_token", "test-token");
});
afterEach(() => {
  server.resetHandlers();
  pushMock.mockClear();
  localStorage.setItem("access_token", "test-token");
});
afterAll(() => server.close());

describe("JoinRoomForm — MSW fixture UI states (#842)", () => {
  it("renders successful join and navigates to game-waiting", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), JOIN_ROOM_FIXTURE_CODES.success);
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        `/game-waiting?gameCode=${JOIN_ROOM_FIXTURE_CODES.success}`
      );
    });
    expect(screen.queryByTestId("form-error-banner")).not.toBeInTheDocument();
  });

  it("shows room not found banner for NOTFND fixture", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), JOIN_ROOM_FIXTURE_CODES.notFound);
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() => {
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/room not found/i);
    });
  });

  it("shows room full banner for FULL00 fixture", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), JOIN_ROOM_FIXTURE_CODES.full);
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() => {
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/room is full/i);
    });
  });

  it("shows expired invite banner for EXPIRD fixture", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), JOIN_ROOM_FIXTURE_CODES.expiredInvite);
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() => {
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/invite link has expired/i);
    });
  });

  it("shows unauthorized banner when join request is rejected", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), JOIN_ROOM_FIXTURE_CODES.unauthorized);
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() => {
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/sign in/i);
    });
  });

  it("blocks join without auth token before MSW is reached", async () => {
    const user = userEvent.setup();
    localStorage.removeItem("access_token");
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText(/room code/i), JOIN_ROOM_FIXTURE_CODES.success);
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() => {
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/sign in/i);
    });
    expect(pushMock).not.toHaveBeenCalled();
  });
});
