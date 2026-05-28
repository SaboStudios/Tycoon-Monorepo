import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JoinRoomForm from "./JoinRoomForm";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("JoinRoomForm", () => {
  beforeEach(() => {
    pushMock.mockReset();
    sessionStorage.clear();
  });

  it("loads a saved room code from sessionStorage", () => {
    sessionStorage.setItem("tycoon.lastJoinCode", "ABC123");
    render(<JoinRoomForm />);

    expect(screen.getByDisplayValue("ABC123")).toBeInTheDocument();
  });

  it("disables the join button for invalid room codes", async () => {
    render(<JoinRoomForm />);

    const input = screen.getByPlaceholderText(/e\.g\. TYCOON/i);
    const button = screen.getByRole("button", { name: /join/i });

    await userEvent.type(input, "A1");

    expect(button).toBeDisabled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("navigates to the waiting room and persists a valid code", async () => {
    render(<JoinRoomForm />);

    const input = screen.getByPlaceholderText(/e\.g\. TYCOON/i);
    const button = screen.getByRole("button", { name: /join/i });

    await userEvent.type(input, "abc123");
    await userEvent.click(button);

    expect(pushMock).toHaveBeenCalledWith("/game-waiting?gameCode=ABC123");
    expect(sessionStorage.getItem("tycoon.lastJoinCode")).toBe("ABC123");
  });
});
