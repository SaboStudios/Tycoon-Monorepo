import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * ShopApiClient — backend BFF -> shop-api authoritative write store (ADR-001).
 *
 * Responsibilities:
 *  - HTTP transport with per-request timeouts.
 *  - Limited retries on safe (idempotent) reads only.
 *  - Circuit breaking so a down shop-api fails fast (fail closed on writes).
 *  - Propagates Idempotency-Key and X-Request-Id end-to-end.
 *  - Maps shop-api errors (incl. 409 replay) into typed results.
 */

export interface ShopApiPurchaseRequest {
  /** Backend user id (string) — translated to shop-api identity per ADR-003. */
  userId: string;
  /** shop-api cross-reference id for the backend user, when known. */
  shopUserId?: string;
  sku: string;
  quantity: number;
  /** Amount in minor units (integer). Never trust client price as final. */
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  requestId: string;
}

export interface ShopApiPurchaseResult {
  ok: boolean;
  status: number;
  /** True when shop-api replayed an existing purchase for the Idempotency-Key (409). */
  replayed: boolean;
  purchaseId?: string;
  shopUserId?: string;
  error?: string;
}

export class ShopApiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShopApiUnavailableError';
  }
}

interface CircuitState {
  failures: number;
  openedAt: number | null;
}

@Injectable()
export class ShopApiClient {
  private readonly logger = new Logger(ShopApiClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxReadRetries: number;
  private readonly circuitThreshold: number;
  private readonly circuitCooldownMs: number;
  private readonly circuit: CircuitState = { failures: 0, openedAt: null };

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (this.config.get<string>('SHOP_API_URL') ?? '').replace(/\/$/, '');
    this.apiKey = this.config.get<string>('SHOP_API_KEY') ?? '';
    this.timeoutMs = Number(this.config.get<string>('SHOP_API_TIMEOUT_MS') ?? 3000);
    this.maxReadRetries = Number(this.config.get<string>('SHOP_API_READ_RETRIES') ?? 2);
    this.circuitThreshold = Number(this.config.get<string>('SHOP_API_CIRCUIT_THRESHOLD') ?? 5);
    this.circuitCooldownMs = Number(this.config.get<string>('SHOP_API_CIRCUIT_COOLDOWN_MS') ?? 15000);
  }

  /** Circuit is open => shop-api considered down; writes must fail closed. */
  isCircuitOpen(): boolean {
    if (this.circuit.openedAt === null) return false;
    if (Date.now() - this.circuit.openedAt >= this.circuitCooldownMs) {
      // Half-open: allow a probe through.
      this.circuit.openedAt = null;
      this.circuit.failures = 0;
      return false;
    }
    return true;
  }

  private recordSuccess(): void {
    this.circuit.failures = 0;
    this.circuit.openedAt = null;
  }

  private recordFailure(): void {
    this.circuit.failures += 1;
    if (this.circuit.failures >= this.circuitThreshold) {
      this.circuit.openedAt = Date.now();
      this.logger.warn(`shop-api circuit opened after ${this.circuit.failures} failures`);
    }
  }

  private async fetchWithTimeout(
    path: string,
    init: RequestInit,
    requestId: string,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'x-request-id': requestId,
          ...(init.headers ?? {}),
        },
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Proxy a purchase write to shop-api. Never retried (writes are not safe to
   * blind-retry); idempotency is enforced by the propagated Idempotency-Key.
   * Fails closed: throws ShopApiUnavailableError when shop-api is down.
   */
  async createPurchase(req: ShopApiPurchaseRequest): Promise<ShopApiPurchaseResult> {
    if (this.isCircuitOpen()) {
      throw new ShopApiUnavailableError('shop-api circuit open; refusing write');
    }
    try {
      const res = await this.fetchWithTimeout(
        '/purchases',
        {
          method: 'POST',
          headers: { 'idempotency-key': req.idempotencyKey },
          body: JSON.stringify({
            userId: req.shopUserId ?? req.userId,
            backendUserId: req.userId,
            sku: req.sku,
            quantity: req.quantity,
            amountMinor: req.amountMinor,
            currency: req.currency,
          }),
        },
        req.requestId,
      );

      if (res.status === 409) {
        // Idempotent replay: shop-api already recorded this purchase.
        const body = await this.safeJson(res);
        this.recordSuccess();
        return {
          ok: true,
          status: 409,
          replayed: true,
          purchaseId: body?.purchaseId,
          shopUserId: body?.userId,
        };
      }

      if (!res.ok) {
        const body = await this.safeJson(res);
        this.recordFailure();
        return {
          ok: false,
          status: res.status,
          replayed: false,
          error: body?.message ?? `shop-api error ${res.status}`,
        };
      }

      const body = await this.safeJson(res);
      this.recordSuccess();
      return {
        ok: true,
        status: res.status,
        replayed: false,
        purchaseId: body?.purchaseId,
        shopUserId: body?.userId,
      };
    } catch (err) {
      this.recordFailure();
      const message = err instanceof Error ? err.message : 'unknown shop-api failure';
      this.logger.error(`shop-api purchase write failed requestId=${req.requestId}: ${message}`);
      throw new ShopApiUnavailableError(message);
    }
  }

  /**
   * Safe read with limited retries. Used for identity translation / lookups.
   */
  async getPurchase(purchaseId: string, requestId: string): Promise<ShopApiPurchaseResult> {
    if (this.isCircuitOpen()) {
      throw new ShopApiUnavailableError('shop-api circuit open; refusing read');
    }
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxReadRetries; attempt += 1) {
      try {
        const res = await this.fetchWithTimeout(
          `/purchases/${encodeURIComponent(purchaseId)}`,
          { method: 'GET' },
          requestId,
        );
        if (res.status === 404) {
          this.recordSuccess();
          return { ok: false, status: 404, replayed: false, error: 'not found' };
        }
        if (!res.ok) {
          lastErr = new Error(`shop-api error ${res.status}`);
          continue;
        }
        const body = await this.safeJson(res);
        this.recordSuccess();
        return {
          ok: true,
          status: res.status,
          replayed: false,
          purchaseId: body?.purchaseId,
          shopUserId: body?.userId,
        };
      } catch (err) {
        lastErr = err;
      }
    }
    this.recordFailure();
    const message = lastErr instanceof Error ? lastErr.message : 'unknown shop-api failure';
    this.logger.error(`shop-api read failed requestId=${requestId}: ${message}`);
    throw new ShopApiUnavailableError(message);
  }

  private async safeJson(res: Response): Promise<any | undefined> {
    try {
      return await res.json();
    } catch {
      return undefined;
    }
  }
}
