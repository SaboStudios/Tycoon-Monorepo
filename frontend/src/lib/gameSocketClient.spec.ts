import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameSocketClient } from "./gameSocketClient";

/**
 * Minimal stub of the underlying socket transport. Exposes the surface the
 * client relies on (on/off/emit/close) so no real network is touched.
 */
function createMockSocket() {
  return {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    close: vi.fn(),
  };
}

type MockSocket = ReturnType<typeof createMockSocket>;

/**
 * Build a client wired to a mock socket. The factory is injected so the client
 * never opens a real connection.
 */
function createClient(socket: MockSocket) {
  return new GameSocketClient({
    createSocket: () => socket as unknown as ReturnType<
      ConstructorParameters<typeof GameSocketClient>[0]["createSocket"]
    >,
  });
}

describe("GameSocketClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("registers listeners on subscribe and removes them on unsubscribe", () => {
    const socket = createMockSocket();
    const client = createClient(socket);

    const handler = vi.fn();
    const unsubscribe = client.subscribe("game:state", handler);

    expect(socket.on).toHaveBeenCalledTimes(1);
    expect(socket.on).toHaveBeenCalledWith("game:state", handler);

    unsubscribe();

    expect(socket.off).toHaveBeenCalledTimes(1);
    expect(socket.off).toHaveBeenCalledWith("game:state", handler);
  });

  it("removes every listener registered on subscribe when unsubscribing", () => {
    const socket = createMockSocket();
    const client = createClient(socket);

    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = client.subscribe("game:state", first);
    const unsubscribeSecond = client.subscribe("game:state", second);

    expect(socket.on).toHaveBeenCalledTimes(2);

    unsubscribeFirst();
    unsubscribeSecond();

    expect(socket.off).toHaveBeenCalledTimes(2);
    expect(socket.off).toHaveBeenNthCalledWith(1, "game:state", first);
    expect(socket.off).toHaveBeenNthCalledWith(2, "game:state", second);
  });

  it("schedules a reconnect after a disconnect", () => {
    const socket = createMockSocket();
    const client = createClient(socket);

    client.connect();
    expect(socket.on).toHaveBeenCalledWith("disconnect", expect.any(Function));

    const onDisconnect = socket.on.mock.calls.find(
      ([event]) => event === "disconnect",
    )?.[1] as () => void;

    onDisconnect();

    // No reconnect before the first backoff interval elapses.
    expect(socket.close).not.toHaveBeenCalled();

    vi.advanceTimersByTime(client.getBackoffDelay());

    expect(socket.close).toHaveBeenCalledTimes(1);
  });

  it("grows the backoff delay between consecutive failed attempts", () => {
    const socket = createMockSocket();
    const client = createClient(socket);

    client.connect();

    const onDisconnect = socket.on.mock.calls.find(
      ([event]) => event === "disconnect",
    )?.[1] as () => void;

    const firstDelay = client.getBackoffDelay();
    onDisconnect();
    const secondDelay = client.getBackoffDelay();

    expect(secondDelay).toBeGreaterThan(firstDelay);
  });
});
