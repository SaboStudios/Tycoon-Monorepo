"use client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface RequestOptions extends RequestInit {
  token?: string;
}

/**
 * Error thrown for non-2xx API responses. Carries the HTTP status so callers
 * can distinguish specific states (e.g. 409 Conflict on shop purchases).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Stable, collision-resistant Idempotency-Key generator for shop purchases.
 * Uses crypto.randomUUID when available and falls back to a random hex string.
 */
export function generateIdempotencyKey(): string {
  if (
    typeof globalThis !== "undefined" &&
    typeof globalThis.crypto?.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (
    typeof globalThis !== "undefined" &&
    typeof globalThis.crypto?.getRandomValues === "function"
  ) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Deterministic fingerprint of a purchase payload. Used to decide whether a
 * cached Idempotency-Key still matches the current intent (SKU + quantity).
 */
export function purchasePayloadFingerprint(payload: {
  sku: string;
  quantity: number;
}): string {
  return `${payload.sku}:${payload.quantity}`;
}

/**
 * Per-payload Idempotency-Key cache. The same key is reused across network
 * retries/reconnects for an identical payload, and regenerated when the
 * payload (SKU or quantity) changes so a new intent gets a new key.
 */
const purchaseKeyCache = new Map<string, string>();

export function getIdempotencyKeyForPurchase(payload: {
  sku: string;
  quantity: number;
}): string {
  const fingerprint = purchasePayloadFingerprint(payload);
  const existing = purchaseKeyCache.get(fingerprint);
  if (existing) {
    return existing;
  }

  const key = generateIdempotencyKey();
  purchaseKeyCache.set(fingerprint, key);
  return key;
}

/**
 * Clears the cached Idempotency-Key for a payload once the purchase has
 * definitively succeeded, so a subsequent purchase is treated as a new intent.
 */
export function clearIdempotencyKeyForPurchase(payload: {
  sku: string;
  quantity: number;
}): void {
  purchaseKeyCache.delete(purchasePayloadFingerprint(payload));
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { token, ...init } = options;
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.message || "Something went wrong",
      response.status,
      errorData.code
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
