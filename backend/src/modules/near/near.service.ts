import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Circuit breaker states */
enum CircuitState {
  CLOSED = 'CLOSED',   // Normal operation
  OPEN = 'OPEN',       // Fail-fast: all requests rejected immediately
  HALF_OPEN = 'HALF_OPEN', // One probe request allowed through
}

/** How many consecutive failures open the circuit */
const FAILURE_THRESHOLD = 3;
/** How long (ms) the circuit stays OPEN before moving to HALF_OPEN */
const RECOVERY_TIMEOUT_MS = 30_000;
/** Clear error code returned to callers when circuit is open */
const CIRCUIT_OPEN_ERROR_CODE = 'NEAR_SERVICE_UNAVAILABLE';

@Injectable()
export class NearService {
  private readonly logger = new Logger(NearService.name);
  private rpcEndpoints: string[];
  private timeoutMs: number;
  private currentRpcIndex = 0;

  // Circuit breaker state
  private circuitState: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(private configService: ConfigService) {
    this.rpcEndpoints = this.configService.get<string[]>(
      'near.rpcEndpoints',
    ) || ['https://rpc.testnet.near.org'];
    this.timeoutMs = this.configService.get<number>('near.timeoutMs') || 10000;
  }

  /**
   * Gets the currently active RPC endpoint.
   */
  get currentRpc(): string {
    return this.rpcEndpoints[this.currentRpcIndex % this.rpcEndpoints.length];
  }

  /**
   * Exposes the current circuit state (for health checks / tests).
   */
  get circuit(): CircuitState {
    return this.circuitState;
  }

  /**
   * Rotates to the next RPC endpoint in the list.
   */
  private rotateRpc(reason: string) {
    const oldRpc = this.currentRpc;
    this.currentRpcIndex++;
    const newRpc = this.currentRpc;
    this.logger.warn(
      `Rotating RPC endpoint from ${oldRpc} to ${newRpc} due to: ${reason}`,
    );
  }

  /** Called on a successful RPC call — resets the circuit. */
  private onSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitState = CircuitState.CLOSED;
    this.openedAt = null;
  }

  /** Called on a transient RPC failure — may open the circuit. */
  private onFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= FAILURE_THRESHOLD) {
      this.circuitState = CircuitState.OPEN;
      this.openedAt = Date.now();
      this.logger.error(
        `[${CIRCUIT_OPEN_ERROR_CODE}] Circuit opened after ${this.consecutiveFailures} consecutive failures.`,
      );
    }
  }

  /**
   * Returns true if the circuit allows a call through.
   * Transitions OPEN → HALF_OPEN after RECOVERY_TIMEOUT_MS.
   */
  private allowCall(): boolean {
    if (this.circuitState === CircuitState.CLOSED) return true;

    if (this.circuitState === CircuitState.OPEN) {
      const elapsed = Date.now() - (this.openedAt ?? 0);
      if (elapsed >= RECOVERY_TIMEOUT_MS) {
        this.circuitState = CircuitState.HALF_OPEN;
        this.logger.log('Circuit moved to HALF_OPEN — probing NEAR RPC.');
        return true; // Allow the probe
      }
      return false; // Still open, fail-fast
    }

    // HALF_OPEN: allow exactly one call through
    return true;
  }

  /**
   * Core RPC call method handling timeout, rotation, and circuit breaker.
   *
   * @throws {ServiceUnavailableException} with code NEAR_SERVICE_UNAVAILABLE
   *   when the circuit is open (fail-closed behaviour).
   */
  async rpcCall(method: string, params: any): Promise<any> {
    if (!this.allowCall()) {
      throw new ServiceUnavailableException({
        message: 'NEAR RPC service is temporarily unavailable. Please retry later.',
        code: CIRCUIT_OPEN_ERROR_CODE,
      });
    }

    const maxRetries = this.rpcEndpoints.length;
    let attempts = 0;
    let lastError: any;

    while (attempts < maxRetries) {
      const endpoint = this.currentRpc;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'tycoon',
            method,
            params,
          }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
          // JSON-RPC error: node is healthy, request/contract failed — don't penalise circuit.
          throw new Error(data.error.message || JSON.stringify(data.error));
        }

        this.onSuccess();
        return data.result;
      } catch (err: any) {
        lastError = err;

        if (
          err.message &&
          (err.message.includes('FunctionCallError') ||
            err.message.includes('does not exist'))
        ) {
          // Contract-level error — not a connectivity issue; don't trip circuit.
          throw err;
        }

        this.onFailure();
        this.rotateRpc(err.message);
        attempts++;
      }
    }

    this.logger.error(`All ${maxRetries} NEAR RPC endpoints failed.`);
    throw new Error(
      `All NEAR RPC endpoints failed. Last error: ${lastError?.message}`,
    );
  }

  /**
   * Calls a view method on a NEAR smart contract.
   */
  async view(
    contractId: string,
    methodName: string,
    args: Record<string, any> = {},
  ): Promise<any> {
    const argsBase64 = Buffer.from(JSON.stringify(args)).toString('base64');

    const result = await this.rpcCall('query', {
      request_type: 'call_function',
      finality: 'final',
      account_id: contractId,
      method_name: methodName,
      args_base64: argsBase64,
    });

    if (result && result.result) {
      const resString = Buffer.from(result.result).toString('utf8');
      try {
        return JSON.parse(resString);
      } catch {
        return resString;
      }
    }

    return result;
  }

  /**
   * Broadcasts a signed transaction to the NEAR network.
   */
  async broadcastTx(signedTransactionBase64: string): Promise<any> {
    return this.rpcCall('broadcast_tx_commit', [signedTransactionBase64]);
  }
}
