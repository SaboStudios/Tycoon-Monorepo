/**
 * Analytics consent store (#1761).
 *
 * Deny-by-default: telemetry is only emitted when the stored decision is
 * exactly "granted". Missing, unreadable, or tampered values resolve to
 * "unknown", which the analytics client treats the same as "denied".
 *
 * The decision persists in localStorage under `tycoon.telemetry.consent`
 * (the key the legacy join page already reads) and is mirrored to
 * `window.__tycoonConsent` for the legacy landing Hero sink. When storage is
 * unavailable (private mode, quota, blocked cookies) the decision is kept in
 * memory for the session so the banner does not reappear on every render.
 */

export const CONSENT_STORAGE_KEY = "tycoon.telemetry.consent";

export type ConsentDecision = "granted" | "denied";
export type ConsentState = ConsentDecision | "unknown";

type ConsentWindow = Window & { __tycoonConsent?: boolean };

type Listener = () => void;

const listeners = new Set<Listener>();
let memoryDecision: ConsentDecision | null = null;
/** Set when a write was rejected; reads then trust the in-memory decision. */
let storageWriteFailed = false;

function getWindow(): ConsentWindow | null {
  return typeof window === "undefined" ? null : (window as ConsentWindow);
}

function isDecision(value: unknown): value is ConsentDecision {
  return value === "granted" || value === "denied";
}

/**
 * `undefined` means storage is unavailable (fall back to memory); `null`
 * means storage is readable but holds no valid decision.
 */
function readStoredDecision(win: ConsentWindow): ConsentDecision | null | undefined {
  try {
    const storage = win.localStorage;
    if (!storage) {
      return undefined;
    }
    const value = storage.getItem(CONSENT_STORAGE_KEY);
    return isDecision(value) ? value : null;
  } catch {
    return undefined;
  }
}

function mirrorLegacyFlag(win: ConsentWindow, state: ConsentState): void {
  win.__tycoonConsent = state === "granted";
}

/** Current consent state. Always "unknown" during SSR. */
export function readConsent(): ConsentState {
  const win = getWindow();
  if (!win) {
    return "unknown";
  }
  const stored = readStoredDecision(win);
  if (stored === undefined || storageWriteFailed) {
    return memoryDecision ?? "unknown";
  }
  return stored ?? "unknown";
}

export function hasAnalyticsConsent(): boolean {
  return readConsent() === "granted";
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

/**
 * Record the user's decision. Idempotent: repeated calls with the same value
 * (e.g. a double click on the CTA) do not re-notify subscribers.
 */
export function setConsent(decision: ConsentDecision): void {
  if (!isDecision(decision)) {
    return;
  }
  const win = getWindow();
  if (!win) {
    return;
  }

  const previous = readConsent();
  memoryDecision = decision;
  try {
    win.localStorage.setItem(CONSENT_STORAGE_KEY, decision);
    storageWriteFailed = false;
  } catch {
    // Storage blocked — the in-memory decision still applies for this session.
    storageWriteFailed = true;
  }
  mirrorLegacyFlag(win, decision);

  if (previous !== decision) {
    notify();
  }
}

/** Withdraw any decision so the banner asks again. Telemetry stops at once. */
export function clearConsent(): void {
  const win = getWindow();
  if (!win) {
    return;
  }
  const previous = readConsent();
  memoryDecision = null;
  try {
    win.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // Ignore — memory state already cleared.
  }
  mirrorLegacyFlag(win, "unknown");

  if (previous !== "unknown") {
    notify();
  }
}

/**
 * Subscribe to consent changes, including changes made in other tabs via the
 * `storage` event. Returns an unsubscribe function (useSyncExternalStore shape).
 */
export function subscribeToConsent(listener: Listener): () => void {
  listeners.add(listener);

  const win = getWindow();
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CONSENT_STORAGE_KEY) {
      if (win) {
        mirrorLegacyFlag(win, readConsent());
      }
      listener();
    }
  };
  win?.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    win?.removeEventListener("storage", onStorage);
  };
}

/** Test-only: reset module state between cases. */
export function __resetConsentForTests(): void {
  memoryDecision = null;
  storageWriteFailed = false;
  listeners.clear();
}
