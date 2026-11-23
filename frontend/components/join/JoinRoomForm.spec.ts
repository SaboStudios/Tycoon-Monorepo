import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JoinRoomForm, validateCode } from "./JoinRoomForm";

describe("validateCode room code length (#2125)", () => {
  it("rejects a three-character code", () => {
    expect(validateCode("ABC")).toEqual({
      code: "invalid_code",
      message: "Room codes are 4–12 letters or numbers.",
    });
  });

  it("accepts a four-character code", () => {
    expect(validateCode("ABCD")).toBeNull();
  });

  it("normalizes lowercase input to uppercase before validating", () => {
    expect(validateCode("abcd")).toBeNull();
  });
});

describe("JoinRoomForm input normalization (#2149)", () => {
  function pendingJoin() {
    return vi.fn().mockReturnValue(new Promise(() => {}));
  }

  it("shows the normalized (uppercase, trimmed) value as the user types", () => {
    render(<JoinRoomForm onJoin={pendingJoin()} />);
    const input = screen.getByLabelText("Room code") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "ab" } });
    expect(input.value).toBe("AB");
  });

  it("removes a surrounding space from the field as the user types", () => {
    render(<JoinRoomForm onJoin={pendingJoin()} />);
    const input = screen.getByLabelText("Room code") as HTMLInputElement;

    fireEvent.change(input, { target: { value: " ab12 " } });
    expect(input.value).toBe("AB12");
  });
});

describe("JoinRoomForm error clearing (#2148)", () => {
  function pendingJoin() {
    return vi.fn().mockReturnValue(new Promise(() => {}));
  }

  function rejectingJoin(error: unknown) {
    return vi.fn().mockRejectedValue(error);
  }

  it("clears an invalid_code error as soon as the user types", async () => {
    render(<JoinRoomForm onJoin={pendingJoin()} />);
    const input = screen.getByLabelText("Room code") as HTMLInputElement;
    const form = input.closest("form") as HTMLFormElement;

    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.submit(form);

    expect(await screen.findByText("Room codes are 4–12 letters or numbers.")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "abc" } });
    expect(screen.queryByText("Room codes are 4–12 letters or numbers.")).not.toBeInTheDocument();
  });

  it("keeps an auth_expired error visible while the user types", async () => {
    const onJoin = rejectingJoin({
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
    // The input itself keeps updating even while the error stays.
    expect(input.value).toBe("ABCDE");
  });
});
