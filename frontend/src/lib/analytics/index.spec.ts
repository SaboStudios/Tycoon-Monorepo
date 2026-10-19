import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ANALYTICS_PROVIDER_IDS,
  CONSENT_STORAGE_KEY,
  canTrack,
  clearConsent,
  hasAnalyticsConsent,
  parseAnalyticsProviders,
  readConsent,
  setConsent,
  subscribeToConsent,
} from './index';

function createStorageStub(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe('analytics consent + allowlist', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageStub());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('round-trips consent through setConsent, readConsent, hasAnalyticsConsent and clearConsent', () => {
    expect(hasAnalyticsConsent()).toBe(false);
    expect(canTrack()).toBe(false);

    setConsent({ analytics: true });

    expect(readConsent()).toEqual({ analytics: true });
    expect(hasAnalyticsConsent()).toBe(true);
    expect(canTrack()).toBe(true);

    clearConsent();

    expect(readConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
    expect(canTrack()).toBe(false);
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
  });

  it('notifies subscribed listeners when consent changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToConsent(listener);

    setConsent({ analytics: true });
    expect(listener).toHaveBeenCalledTimes(1);

    clearConsent();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setConsent({ analytics: true });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('parses allowlisted providers and rejects unknown provider ids', () => {
    const allowlisted = ANALYTICS_PROVIDER_IDS[0];

    expect(parseAnalyticsProviders([allowlisted])).toEqual([allowlisted]);
    expect(parseAnalyticsProviders([allowlisted, 'not-a-real-provider'])).toEqual([allowlisted]);
    expect(parseAnalyticsProviders(['not-a-real-provider'])).toEqual([]);
  });
});
