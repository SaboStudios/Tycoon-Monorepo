import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  hasJoinAuthToken,
  mapJoinRoomErrors,
  sanitiseDisplayName,
  sanitiseInviteToken,
  sanitiseRoomCode,
  sanitizeJoinRoomErrorMessage,
} from "@/lib/join-room/security";
import { JOIN_ROOM_I18N } from "@/lib/join-room/i18n-keys";
import { TycoonApiError } from "@/lib/api/errors";
import {
  displayNameSchema,
  inviteTokenSchema,
  joinRoomSchema,
} from "@/lib/validation";

describe("sanitiseRoomCode", () => {
  it("strips non-alphanumeric characters and uppercases", () => {
    expect(sanitiseRoomCode("ab!c@12")).toBe("ABC12");
  });

  it("caps input at 6 characters", () => {
    expect(sanitiseRoomCode("ABCDEFGH")).toBe("ABCDEF");
  });
});

describe("sanitiseInviteToken", () => {
  it("strips invalid characters and caps length", () => {
    expect(sanitiseInviteToken("abc!@#123-xyz")).toBe("abc123-xyz");
  });

  it("rejects invalid tokens via schema after sanitisation", () => {
    const result = inviteTokenSchema.safeParse(sanitiseInviteToken("short"));
    expect(result.success).toBe(false);
  });

  it("accepts a valid invite token", () => {
    const token = sanitiseInviteToken("invite-abc12345");
    expect(inviteTokenSchema.safeParse(token).success).toBe(true);
  });
});

describe("sanitiseDisplayName", () => {
  it("strips script-like characters", () => {
    expect(sanitiseDisplayName("Alice<script>")).toBe("Alicescript");
  });

  it("rejects empty display names via schema", () => {
    expect(displayNameSchema.safeParse(sanitiseDisplayName("   ")).success).toBe(false);
  });

  it("accepts a valid display name", () => {
    expect(displayNameSchema.safeParse(sanitiseDisplayName("Player One")).success).toBe(true);
  });
});

describe("joinRoomSchema", () => {
  it("rejects codes with invalid characters after normalisation", () => {
    expect(joinRoomSchema.safeParse({ roomCode: "TY-C01" }).success).toBe(false);
  });

  it("uses i18n keys for validation messages", () => {
    const result = joinRoomSchema.safeParse({ roomCode: "AB" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(JOIN_ROOM_I18N.validation.codeLength);
    }
  });
});

describe("sanitizeJoinRoomErrorMessage", () => {
  it("redacts JWT tokens from error messages", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const result = sanitizeJoinRoomErrorMessage(`Auth failed: ${jwt}`);
    expect(result).not.toContain("eyJhbGci");
    expect(result).toContain("[redacted]");
  });

  it("redacts session id patterns", () => {
    const result = sanitizeJoinRoomErrorMessage("session_id=abc123secret");
    expect(result).toContain("[redacted]");
    expect(result).not.toContain("abc123secret");
  });
});

describe("hasJoinAuthToken", () => {
  afterEach(() => {
    localStorage.removeItem("access_token");
  });

  it("returns false when no token is stored", () => {
    expect(hasJoinAuthToken()).toBe(false);
  });

  it("returns true when a non-empty token is stored", () => {
    localStorage.setItem("access_token", "test-token");
    expect(hasJoinAuthToken()).toBe(true);
  });
});

describe("mapJoinRoomErrors", () => {
  it("maps TycoonApiError status codes to i18n keys", () => {
    const err = new TycoonApiError({
      code: "NOT_FOUND",
      statusCode: 404,
      message: "Game with ID 42 not found",
    });
    expect(mapJoinRoomErrors(err)).toEqual({
      _form: JOIN_ROOM_I18N.errors.notFound,
    });
  });

  it("blocks unauthorized join attempts with an i18n key", () => {
    expect(mapJoinRoomErrors({ statusCode: 401 })).toEqual({
      _form: JOIN_ROOM_I18N.errors.unauthorized,
    });
  });

  it("returns an i18n key for expired invites", () => {
    expect(mapJoinRoomErrors({ statusCode: 410 })).toEqual({
      _form: JOIN_ROOM_I18N.errors.inviteExpired,
    });
    expect(
      mapJoinRoomErrors({ message: "Invite token expired for game 99" })
    ).toEqual({
      _form: JOIN_ROOM_I18N.errors.inviteExpired,
    });
  });

  it("handles stale room-full and already-joined states with i18n keys", () => {
    expect(mapJoinRoomErrors({ statusCode: 409 })).toEqual({
      _form: JOIN_ROOM_I18N.errors.roomFull,
    });
    expect(mapJoinRoomErrors({ message: "User already joined this game" })).toEqual({
      _form: JOIN_ROOM_I18N.errors.alreadyJoined,
    });
  });
});
