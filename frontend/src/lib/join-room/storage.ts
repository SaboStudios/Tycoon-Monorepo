/** Session storage key for the last successfully joined room code. */
export const JOIN_ROOM_STORAGE_KEY = "tycoon.lastJoinCode" as const;

/**
 * Save the room code to sessionStorage for persistence across navigation.
 * Call after successful join to allow users to rejoin if the session drops.
 */
export function saveLastJoinCode(code: string): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.setItem(JOIN_ROOM_STORAGE_KEY, code);
}

/**
 * Retrieve the last joined room code from sessionStorage, if available.
 * Returns null if not set or sessionStorage is unavailable.
 */
export function getLastJoinCode(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return sessionStorage.getItem(JOIN_ROOM_STORAGE_KEY);
}

/**
 * Clear the last joined room code from sessionStorage.
 * Typically called when user explicitly logs out or starts a new game.
 */
export function clearLastJoinCode(): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.removeItem(JOIN_ROOM_STORAGE_KEY);
}
