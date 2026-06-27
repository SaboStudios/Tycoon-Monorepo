import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SuspenseBoundary } from "./suspense-boundary";

function createSuspender() {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  function Suspender() {
    throw promise;
  }

  return { Suspender, resolvePromise: () => resolvePromise?.() };
}

describe("SuspenseBoundary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("delays showing the fallback until the minimum display duration has elapsed", async () => {
    const { Suspender, resolvePromise } = createSuspender();

    render(
      <SuspenseBoundary minDisplayTime={200}>
        <Suspender />
      </SuspenseBoundary>,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(199);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      resolvePromise();
    });

    await Promise.resolve();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
