import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

describe("JoinRoomForm empty room code submission (#2160)", () => {
  it("shows the empty-code message and never calls onJoin", () => {
    const onJoin = vi.fn();
    render(<JoinRoomForm onJoin={onJoin} />);

    fireEvent.click(screen.getByRole("button", { name: /join room/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a room code to continue.");
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("also rejects a code that is only whitespace, without calling onJoin", () => {
    const onJoin = vi.fn();
    render(<JoinRoomForm onJoin={onJoin} />);

    fireEvent.change(screen.getByLabelText(/room code/i), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /join room/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a room code to continue.");
    expect(onJoin).not.toHaveBeenCalled();
  });
});
