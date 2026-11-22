import { describe, expect, it } from "vitest";
import { validateCode } from "./JoinRoomForm";

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
