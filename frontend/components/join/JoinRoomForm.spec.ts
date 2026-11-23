import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("validateCode room code upper bound (#2161)", () => {
  it("rejects a thirteen-character code", () => {
    expect(validateCode("A".repeat(13))).toEqual({
      code: "invalid_code",
      message: "Room codes are 4–12 letters or numbers.",
    });
  });

  it("accepts a twelve-character code", () => {
    expect(validateCode("A".repeat(12))).toBeNull();
  });
});

describe("JoinRoomForm submit gating on room code length (#2161)", () => {
  it("does not call onJoin for a thirteen-character code", async () => {
    const onJoin = vi.fn().mockResolvedValue({ roomId: "room-1" });
    render(<JoinRoomForm onJoin={onJoin} />);

    const input = screen.getByLabelText("Room code");
    // Set the value directly: maxLength on the input only constrains real
    // keystrokes, not a programmatic value, so this still exercises the
    // validation guard in the submit handler for an over-length code.
    fireEvent.change(input, { target: { value: "A".repeat(13) } });
    fireEvent.click(screen.getByRole("button", { name: "Join room" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Room codes are 4–12 letters or numbers.",
    );
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("calls onJoin for a twelve-character code", async () => {
    const onJoin = vi.fn().mockResolvedValue({ roomId: "room-1" });
    render(<JoinRoomForm onJoin={onJoin} />);

    const input = screen.getByLabelText("Room code");
    fireEvent.change(input, { target: { value: "A".repeat(12) } });
    fireEvent.click(screen.getByRole("button", { name: "Join room" }));

    await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1));
    expect(onJoin).toHaveBeenCalledWith("A".repeat(12), expect.anything());
  });
});
  });
});
