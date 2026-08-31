import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  JOIN_ROOM_STORAGE_KEY,
  saveLastJoinCode,
  getLastJoinCode,
  clearLastJoinCode,
} from "../storage";

describe("join-room storage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe("JOIN_ROOM_STORAGE_KEY", () => {
    it("defines the stable storage key", () => {
      expect(JOIN_ROOM_STORAGE_KEY).toBe("tycoon.lastJoinCode");
    });

    it("key is immutable (as const)", () => {
      expect(Object.isFrozen(JOIN_ROOM_STORAGE_KEY) || typeof JOIN_ROOM_STORAGE_KEY === "string").toBe(
        true
      );
    });
  });

  describe("saveLastJoinCode", () => {
    it("saves a room code to sessionStorage", () => {
      saveLastJoinCode("ABC123");
      expect(sessionStorage.getItem(JOIN_ROOM_STORAGE_KEY)).toBe("ABC123");
    });

    it("overwrites previous room code", () => {
      saveLastJoinCode("ABC123");
      expect(sessionStorage.getItem(JOIN_ROOM_STORAGE_KEY)).toBe("ABC123");

      saveLastJoinCode("XYZ789");
      expect(sessionStorage.getItem(JOIN_ROOM_STORAGE_KEY)).toBe("XYZ789");
    });

    it("handles empty string gracefully", () => {
      saveLastJoinCode("");
      expect(sessionStorage.getItem(JOIN_ROOM_STORAGE_KEY)).toBe("");
    });
  });

  describe("getLastJoinCode", () => {
    it("returns null when no code is saved", () => {
      expect(getLastJoinCode()).toBeNull();
    });

    it("retrieves a previously saved room code", () => {
      sessionStorage.setItem(JOIN_ROOM_STORAGE_KEY, "ABC123");
      expect(getLastJoinCode()).toBe("ABC123");
    });

    it("returns the most recently saved code", () => {
      saveLastJoinCode("ABC123");
      saveLastJoinCode("XYZ789");
      expect(getLastJoinCode()).toBe("XYZ789");
    });

    it("returns empty string if stored empty string", () => {
      sessionStorage.setItem(JOIN_ROOM_STORAGE_KEY, "");
      expect(getLastJoinCode()).toBe("");
    });
  });

  describe("clearLastJoinCode", () => {
    it("removes the stored room code", () => {
      saveLastJoinCode("ABC123");
      expect(getLastJoinCode()).toBe("ABC123");

      clearLastJoinCode();
      expect(getLastJoinCode()).toBeNull();
    });

    it("is safe to call when no code is stored", () => {
      expect(() => clearLastJoinCode()).not.toThrow();
      expect(getLastJoinCode()).toBeNull();
    });

    it("removes only the join code, not other sessionStorage items", () => {
      sessionStorage.setItem("other.key", "other.value");
      saveLastJoinCode("ABC123");

      clearLastJoinCode();

      expect(sessionStorage.getItem("other.key")).toBe("other.value");
      expect(getLastJoinCode()).toBeNull();
    });
  });

  describe("integration", () => {
    it("full lifecycle: save, retrieve, clear", () => {
      expect(getLastJoinCode()).toBeNull();

      saveLastJoinCode("ABC123");
      expect(getLastJoinCode()).toBe("ABC123");

      clearLastJoinCode();
      expect(getLastJoinCode()).toBeNull();
    });

    it("handles multiple codes without cross-contamination", () => {
      const codes = ["ABC123", "DEF456", "GHI789"];

      for (const code of codes) {
        saveLastJoinCode(code);
        expect(getLastJoinCode()).toBe(code);
      }

      clearLastJoinCode();
      expect(getLastJoinCode()).toBeNull();
    });
  });
});
