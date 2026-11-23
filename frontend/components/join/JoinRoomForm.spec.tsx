import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JoinRoomForm, validateCode, type JoinRoomResult } from "./JoinRoomForm";

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

describe("JoinRoomForm in-flight submit guard (#2166)", () => {
  it("does not call onJoin a second time while the first request is in flight", async () => {
    let resolveJoin: (value: JoinRoomResult) => void = () => {};
    const deferred = new Promise<JoinRoomResult>((resolve) => {
      resolveJoin = resolve;
    });
    const onJoin = vi.fn().mockReturnValue(deferred);

    render(<JoinRoomForm onJoin={onJoin} initialCode="ABCD12" />);

    const form = screen.getByRole("textbox").closest("form")!;

    // First submit kicks off the (still-pending) request.
    fireEvent.submit(form);
    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /joining/i })).toBeDisabled();

    // A second submit while the first request is still in flight must be
    // ignored by inFlightRef — this guards the write even if something
    // other than the (already-disabled) submit button dispatches it.
    fireEvent.submit(form);
    expect(onJoin).toHaveBeenCalledTimes(1);

    // Resolving the first call finishes the flow and allows a later join.
    resolveJoin({ roomId: "room-1" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /join room/i })).not.toBeDisabled(),
    );

    fireEvent.submit(form);
    expect(onJoin).toHaveBeenCalledTimes(2);
  });
});
