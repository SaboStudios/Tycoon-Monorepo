/**
 * JoinRoomForm — unit tests.
 *
 * Covers #2149 (the controlled value is the normalized room code) and
 * #2148 (typing clears a format error but not a session/rate-limit/access
 * error), plus the existing join-flow behavior these fixes must not break.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JoinRoomForm, validateCode } from "../components/join/JoinRoomForm";

function pendingJoin() {
  return vi.fn().mockReturnValue(new Promise(() => {}));
}

describe("validateCode", () => {
  it("rejects an empty code", () => {
    expect(validateCode("")).toEqual({
      code: "empty",
      message: "Enter a room code to continue.",
    });
  });

  it("rejects a code shorter than 4 characters", () => {
    expect(validateCode("ABC")).toEqual({
      code: "invalid_code",
      message: "Room codes are 4–12 letters or numbers.",
    });
  });

  it("accepts a valid 4-character code", () => {
    expect(validateCode("ABCD")).toBeNull();
  });
});

describe("JoinRoomForm input normalization (#2149)", () => {
  it("shows the normalized uppercase value as the user types", () => {
    render(<JoinRoomForm onJoin={pendingJoin()} />);
    const input = screen.getByLabelText("Room code") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "ab" } });

    expect(input.value).toBe("AB");
  });

  it("drops a leading/trailing space from the field as the user types", () => {
    render(<JoinRoomForm onJoin={pendingJoin()} />);
    const input = screen.getByLabelText("Room code") as HTMLInputElement;

    fireEvent.change(input, { target: { value: " ab12 " } });

    expect(input.value).toBe("AB12");
  });

  it("submits exactly the string the field shows", async () => {
    const onJoin = vi.fn().mockResolvedValue({ roomId: "room-1" });
    render(<JoinRoomForm onJoin={onJoin} />);
    const input = screen.getByLabelText("Room code") as HTMLInputElement;
    const form = input.closest("form") as HTMLFormElement;

    fireEvent.change(input, { target: { value: " ab12 " } });
    expect(input.value).toBe("AB12");

    fireEvent.submit(form);

    expect(onJoin).toHaveBeenCalledWith("AB12", expect.anything());
  });
});

describe("JoinRoomForm error clearing (#2148)", () => {
  it("clears an invalid_code error as soon as the user types", async () => {
    render(<JoinRoomForm onJoin={pendingJoin()} />);
    const input = screen.getByLabelText("Room code") as HTMLInputElement;
    const form = input.closest("form") as HTMLFormElement;

    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.submit(form);

    expect(
      await screen.findByText("Room codes are 4–12 letters or numbers."),
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "abc" } });

    expect(
      screen.queryByText("Room codes are 4–12 letters or numbers."),
    ).not.toBeInTheDocument();
  });

  it("clears an empty error as soon as the user types", async () => {
    render(<JoinRoomForm onJoin={pendingJoin()} />);
    const input = screen.getByLabelText("Room code") as HTMLInputElement;
    const form = input.closest("form") as HTMLFormElement;

    fireEvent.submit(form);
    expect(await screen.findByText("Enter a room code to continue.")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "a" } });

    expect(screen.queryByText("Enter a room code to continue.")).not.toBeInTheDocument();
  });

  it("keeps an auth_expired error visible while the user types, and the value still updates", async () => {
    const onJoin = vi.fn().mockRejectedValue({
      code: "auth_expired",
      message: "Your session expired. Reconnect your wallet to continue.",
    });
    render(<JoinRoomForm onJoin={onJoin} />);
    const input = screen.getByLabelText("Room code") as HTMLInputElement;
    const form = input.closest("form") as HTMLFormElement;

    fireEvent.change(input, { target: { value: "ABCD" } });
    fireEvent.submit(form);

    expect(
      await screen.findByText("Your session expired. Reconnect your wallet to continue."),
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "ABCDE" } });

    expect(
      screen.getByText("Your session expired. Reconnect your wallet to continue."),
    ).toBeInTheDocument();
    expect(input.value).toBe("ABCDE");
  });

  it("keeps a rate_limited error visible while the user types", async () => {
    const onJoin = vi.fn().mockRejectedValue({
      code: "rate_limited",
      message: "Too many attempts. Wait a moment and try again.",
    });
    render(<JoinRoomForm onJoin={onJoin} />);
    const input = screen.getByLabelText("Room code") as HTMLInputElement;
    const form = input.closest("form") as HTMLFormElement;

    fireEvent.change(input, { target: { value: "ABCD" } });
    fireEvent.submit(form);

    expect(
      await screen.findByText("Too many attempts. Wait a moment and try again."),
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "ABCDEF" } });

    expect(
      screen.getByText("Too many attempts. Wait a moment and try again."),
    ).toBeInTheDocument();
  });
});
