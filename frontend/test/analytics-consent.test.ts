import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_STORAGE_KEY,
  __resetConsentForTests,
  clearConsent,
  hasAnalyticsConsent,
  readConsent,
  setConsent,
  subscribeToConsent,
} from "@/lib/analytics/consent";

type LegacyWindow = Window & { __tycoonConsent?: boolean };

describe("analytics consent store (#1761)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetConsentForTests();
    delete (window as LegacyWindow).__tycoonConsent;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is deny-by-default: no stored decision means unknown and no consent", () => {
    expect(readConsent()).toBe("unknown");
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("persists grant/deny under the key the legacy join page reads", () => {
    setConsent("granted");
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe("granted");
    expect(CONSENT_STORAGE_KEY).toBe("tycoon.telemetry.consent");
    expect(hasAnalyticsConsent()).toBe(true);

    setConsent("denied");
    expect(readConsent()).toBe("denied");
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("mirrors the decision to the legacy window.__tycoonConsent flag", () => {
    setConsent("granted");
    expect((window as LegacyWindow).__tycoonConsent).toBe(true);
    clearConsent();
    expect((window as LegacyWindow).__tycoonConsent).toBe(false);
  });

  it("treats tampered storage values as unknown (fail closed)", () => {
    for (const tampered of ["GRANTED", "yes", "true", "granted ", "{}"]) {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, tampered);
      expect(readConsent()).toBe("unknown");
    }
  });

  it("ignores invalid decisions passed at runtime", () => {
    setConsent("maybe" as never);
    expect(readConsent()).toBe("unknown");
  });

  it("notifies subscribers once per actual change (double clicks are idempotent)", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToConsent(listener);

    setConsent("granted");
    setConsent("granted");
    expect(listener).toHaveBeenCalledTimes(1);

    clearConsent();
    clearConsent();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setConsent("denied");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("syncs withdrawals made in another tab via the storage event", () => {
    setConsent("granted");
    const listener = vi.fn();
    subscribeToConsent(listener);

    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: CONSENT_STORAGE_KEY }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(readConsent()).toBe("unknown");
    expect((window as LegacyWindow).__tycoonConsent).toBe(false);
  });

  it("ignores storage events for unrelated keys", () => {
    const listener = vi.fn();
    subscribeToConsent(listener);
    window.dispatchEvent(new StorageEvent("storage", { key: "something-else" }));
    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps the decision in memory when storage rejects writes", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    setConsent("granted");
    expect(readConsent()).toBe("granted");
  });

  it("returns unknown when storage cannot be read at all", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(readConsent()).toBe("unknown");
  });
});
