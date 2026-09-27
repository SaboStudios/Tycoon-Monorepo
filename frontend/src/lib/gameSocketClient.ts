/**
 * Game socket client for Tycoon realtime games.
 *
 * Responsibilities (issue #1802):
 * - Maintain a single WS connection per tab with JWT handshake parity with REST.
 * - Detect drops and expose connection state (connecting/reconnecting/failed).
 * - Support "resume turn" via snapshot/replay with idempotency keys so retries
 *   never duplicate actions.
 * - Surface stable server error codes for illegal actions (seat vs spectator).
 * - Never leak hidden cards: only server-authoritative snapshots are applied.
 *
 * Server remains the source of truth for money, dice, inventory, and admin
 * mutations. This client only submits intents.
 */

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'failed';

export type GameSocketErrorCode =
  | 'AUTH_EXPIRED'
  | 'FORBIDDEN_ROLE'
  | 'SPECTATOR_CANNOT_ROLL'
  | 'NOT_YOUR_TURN'
  | 'DUPLICATE_ACTION'
  | 'RATE_LIMITED'
  | 'INVALID_PAYLOAD'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR';

export interface GameSocketError {
  code: GameSocketErrorCode;
  message: string;
  /** Optional server-provided correlation id for support/telemetry. */
  requestId?: string;
}

export interface GameSnapshot {
  gameId: string;
  /** Monotonic server sequence; used to detect reordering after reconnect. */
  seq: number;
  /** Opaque server-authoritative state. Hidden cards are never included. */
  state: unknown;
  /** Seat assigned to this client, or null for spectators. */
  seat: number | null;
}

export interface GameEvent {
  gameId: string;
  seq: number;
  type: string;
  payload: unknown;
}

export interface ResumeResult {
  snapshot: GameSnapshot;
  /** Events replayed after the snapshot, in ascending seq order. */
  replayed: GameEvent[];
}

export interface GameSocketClientOptions {
  /** Absolute or relative WS URL, e.g. wss://api.example.com/games. */
  url: string;
  /** Returns the current JWT (cookie/header parity with REST). */
  getToken: () => string | null | Promise<string | null>;
  /** Called when the token is rejected mid-session; should refresh or redirect. */
  onAuthExpired?: () => void | Promise<void>;
  /** Max reconnect attempts before transitioning to 'failed'. */
  maxReconnectAttempts?: number;
  /** Base backoff in ms; grows exponentially with jitter. */
  reconnectBaseDelayMs?: number;
  /** Optional WebSocket factory for tests/SSR. */
  createSocket?: (url: string, protocols?: string | string[]) => WebSocket;
}

type Listener<T> = (value: T) => void;

interface PendingIntent {
  idempotencyKey: string;
  resolve: (value: unknown) => void;
  reject: (err: GameSocketError) => void;
}

const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_BASE_DELAY_MS = 500;

/**
 * Generates a stable idempotency key for an intent. Uses crypto.randomUUID when
 * available so retries after reconnect reuse the same key. Falls back to a
 * time+random composite for older runtimes.
 */
export function createIdempotencyKey(): string {
  const cryptoObj =
    typeof globalThis !== 'undefined'
      ? (globalThis.crypto as Crypto | undefined)
      : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Client for a single game room. One instance per tab; duplicate tab joins are
 * rejected by the server (stable DUPLICATE_ACTION / FORBIDDEN_ROLE codes) and
 * surfaced here without mutating local state.
 */
export class GameSocketClient {
  private readonly options: Required<
    Pick<GameSocketClientOptions, 'maxReconnectAttempts' | 'reconnectBaseDelayMs'>
  > &
    GameSocketClientOptions;

  private socket: WebSocket | null = null;
  private state: ConnectionState = 'idle';
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSeq = 0;
  private gameId: string | null = null;
  private seat: number | null = null;
  private closedByUser = false;

  private readonly pending = new Map<string, PendingIntent>();
  private readonly stateListeners = new Set<Listener<ConnectionState>>();
  private readonly errorListeners = new Set<Listener<GameSocketError>>();
  private readonly eventListeners = new Set<Listener<GameEvent>>();
  private readonly snapshotListeners = new Set<Listener<GameSnapshot>>();

  constructor(options: GameSocketClientOptions) {
    this.options = {
      maxReconnectAttempts: DEFAULT_MAX_ATTEMPTS,
      reconnectBaseDelayMs: DEFAULT_BASE_DELAY_MS,
      ...options,
    };
  }

  get connectionState(): ConnectionState {
    return this.state;
  }

  get currentSeat(): number | null {
    return this.seat;
  }

  onStateChange(listener: Listener<ConnectionState>): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  onError(listener: Listener<GameSocketError>): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  onEvent(listener: Listener<GameEvent>): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onSnapshot(listener: Listener<GameSnapshot>): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  /**
   * Opens the connection and joins the given game. Safe to call again after a
   * drop; it will reuse the same client and resume from lastSeq.
   */
  async connect(gameId: string): Promise<void> {
    this.gameId = gameId;
    this.closedByUser = false;
    await this.openSocket();
  }

  /**
   * "Resume turn" CTA entrypoint. Reconnects if needed and requests a snapshot
   * plus replay of events after lastSeq. Idempotent: repeated calls while a
   * resume is in flight are coalesced by the server via the resume key.
   */
  async resumeTurn(): Promise<ResumeResult> {
    if (!this.gameId) {
      throw this.toError('SERVER_ERROR', 'No game joined');
    }
    if (this.state !== 'open') {
      await this.openSocket();
    }
    const result = await this.request<ResumeResult>('resume', {
      gameId: this.gameId,
      sinceSeq: this.lastSeq,
      idempotencyKey: createIdempotencyKey(),
    });
    this.applyResume(result);
    return result;
  }

  /**
   * Submits a roll intent. Server-authoritative: the client never computes the
   * result. Spectators are rejected client-side with a stable code and the
   * server enforces the same rule.
   */
  async roll(): Promise<unknown> {
    if (this.seat === null) {
      throw this.toError('SPECTATOR_CANNOT_ROLL', 'Spectators cannot roll');
    }
    return this.submitIntent('roll', {});
  }

  /**
   * Submits an arbitrary intent with a fresh idempotency key. Retries after a
   * reconnect reuse the same key so the server can dedupe.
   */
  async submitIntent(type: string, payload: unknown): Promise<unknown> {
    if (!this.gameId) {
      throw this.toError('SERVER_ERROR', 'No game joined');
    }
    if (this.state !== 'open') {
      await this.openSocket();
    }
    return this.request('intent', {
      gameId: this.gameId,
      type,
      payload,
      idempotencyKey: createIdempotencyKey(),
    });
  }

  /** Closes the connection and stops reconnection attempts. */
  disconnect(): void {
    this.closedByUser = true;
    this.clearReconnectTimer();
    this.rejectAllPending('NETWORK_ERROR', 'Connection closed');
    if (this.socket) {
      try {
        this.socket.close(1000, 'client disconnect');
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
    this.setState('idle');
  }

  private async openSocket(): Promise<void> {
    if (this.socket && this.state === 'open') return;
    this.clearReconnectTimer();
    this.setState(this.attempts > 0 ? 'reconnecting' : 'connecting');

    const token = await this.options.getToken();
    if (!token) {
      this.setState('failed');
      throw this.toError('AUTH_EXPIRED', 'Missing auth token');
    }

    const createSocket =
      this.options.createSocket ??
      ((url: string, protocols?: string | string[]) =>
        new WebSocket(url, protocols));

    // JWT handshake parity with REST: pass token via subprotocol so it is not
    // logged in URLs. Server validates the same JWT used for REST calls.
    const socket = createSocket(this.options.url, [
      'tycoon.v1',
      `auth.${token}`,
    ]);
    this.socket = socket;

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        cleanup();
        this.attempts = 0;
        this.setState('open');
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(this.toError('NETWORK_ERROR', 'Socket error during handshake'));
      };
      const onClose = (ev: CloseEvent) => {
        cleanup();
        reject(this.mapCloseToError(ev));
      };
      const cleanup = () => {
        socket.removeEventListener('open', onOpen);
        socket.removeEventListener('error', onError);
        socket.removeEventListener('close', onClose);
      };
      socket.addEventListener('open', onOpen);
      socket.addEventListener('error', onError);
      socket.addEventListener('close', onClose);
    }).catch((err: GameSocketError) => {
      this.handleDrop(err);
      throw err;
    });

    socket.addEventListener('message', (ev) => this.handleMessage(ev));
    socket.addEventListener('close', (ev) => this.handleDrop(this.mapCloseToError(ev)));
    socket.addEventListener('error', () =>
      this.emitError(this.toError('NETWORK_ERROR', 'Socket error')),
    );
  }

  private handleDrop(err: GameSocketError): void {
    this.socket = null;
    if (this.closedByUser) return;

    if (err.code === 'AUTH_EXPIRED') {
      this.setState('failed');
      this.emitError(err);
      void this.options.onAuthExpired?.();
      return;
    }

    if (this.attempts >= this.options.maxReconnectAttempts) {
      this.setState('failed');
      this.emitError(err);
      this.rejectAllPending(err.code, err.message);
      return;
    }

    this.attempts += 1;
    this.setState('reconnecting');
    this.emitError(err);

    const delay = this.backoffDelay(this.attempts);
    this.reconnectTimer = setTimeout(() => {
      this.openSocket().catch(() => {
        /* handleDrop already scheduled the next attempt */
      });
    }, delay);
  }

  private backoffDelay(attempt: number): number {
    const base = this.options.reconnectBaseDelayMs;
    const exp = base * Math.pow(2, attempt - 1);
    const jitter = Math.random() * base;
    return Math.min(exp + jitter, 30_000);
  }

  private handleMessage(ev: MessageEvent): void {
    let msg: any;
    try {
      msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
    } catch {
      this.emitError(this.toError('INVALID_PAYLOAD', 'Malformed server message'));
      return;
    }
    if (!msg || typeof msg !== 'object') return;

    switch (msg.kind) {
      case 'snapshot':
        this.applySnapshot(msg.snapshot as GameSnapshot);
        break;
      case 'event':
        this.applyEvent(msg.event as GameEvent);
        break;
      case 'ack':
        this.resolvePending(msg.idempotencyKey, msg.result);
        break;
      case 'error':
        this.handleServerError(msg);
        break;
      default:
        break;
    }
  }

  private applyResume(result: ResumeResult): void {
    this.applySnapshot(result.snapshot);
    const ordered = [...result.replayed].sort((a, b) => a.seq - b.seq);
    for (const event of ordered) {
      this.applyEvent(event);
    }
  }

  private applySnapshot(snapshot: GameSnapshot): void {
    if (!snapshot || typeof snapshot.seq !== 'number') return;
    // Ignore stale snapshots to avoid regressing state after reordering.
    if (snapshot.seq < this.lastSeq) return;
    this.lastSeq = snapshot.seq;
    this.seat = snapshot.seat;
    for (const listener of this.snapshotListeners) listener(snapshot);
  }

  private applyEvent(event: GameEvent): void {
    if (!event || typeof event.seq !== 'number') return;
    // Drop duplicates and out-of-order events after reconnect.
    if (event.seq <= this.lastSeq) return;
    this.lastSeq = event.seq;
    for (const listener of this.eventListeners) listener(event);
  }

  private handleServerError(msg: any): void {
    const err = this.toError(
      (msg.code as GameSocketErrorCode) ?? 'SERVER_ERROR',
      typeof msg.message === 'string' ? msg.message : 'Server error',
      typeof msg.requestId === 'string' ? msg.requestId : undefined,
    );
    if (msg.idempotencyKey) {
      this.rejectPending(msg.idempotencyKey, err);
    }
    if (err.code === 'AUTH_EXPIRED') {
      this.setState('failed');
      void this.options.onAuthExpired?.();
    }
    this.emitError(err);
  }

  private request<T>(kind: string, payload: Record<string, unknown>): Promise<T> {
    const idempotencyKey = String(payload.idempotencyKey);
    return new Promise<T>((resolve, reject) => {
      if (!this.socket || this.state !== 'open') {
        reject(this.toError('NETWORK_ERROR', 'Socket not open'));
        return;
      }
      this.pending.set(idempotencyKey, {
        idempotencyKey,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      try {
        this.socket.send(JSON.stringify({ kind, ...payload }));
      } catch {
        this.pending.delete(idempotencyKey);
        reject(this.toError('NETWORK_ERROR', 'Failed to send'));
      }
    });
  }

  private resolvePending(idempotencyKey: string, result: unknown): void {
    const entry = this.pending.get(idempotencyKey);
    if (!entry) return;
    this.pending.delete(idempotencyKey);
    entry.resolve(result);
  }

  private rejectPending(idempotencyKey: string, err: GameSocketError): void {
    const entry = this.pending.get(idempotencyKey);
    if (!entry) return;
    this.pending.delete(idempotencyKey);
    entry.reject(err);
  }

  private rejectAllPending(code: GameSocketErrorCode, message: string): void {
    for (const entry of this.pending.values()) {
      entry.reject(this.toError(code, message));
    }
    this.pending.clear();
  }

  private mapCloseToError(ev: CloseEvent): GameSocketError {
    // 4001/4401: auth; 4003/4403: forbidden role; 4429: rate limited.
    switch (ev.code) {
      case 4001:
      case 4401:
        return this.toError('AUTH_EXPIRED', 'Session expired');
      case 4003:
      case 4403:
        return this.toError('FORBIDDEN_ROLE', 'Not authorized for this seat');
      case 4429:
        return this.toError('RATE_LIMITED', 'Too many requests');
      default:
        return this.toError('NETWORK_ERROR', ev.reason || 'Connection lost');
    }
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    for (const listener of this.stateListeners) listener(next);
  }

  private emitError(err: GameSocketError): void {
    for (const listener of this.errorListeners) listener(err);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private toError(
    code: GameSocketErrorCode,
    message: string,
    requestId?: string,
  ): GameSocketError {
    return { code, message, requestId };
  }
}
