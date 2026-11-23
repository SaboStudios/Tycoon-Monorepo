import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PurchaseButton from './PurchaseButton';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PurchaseButton currency label', () => {
  it('renders the currency supplied by the shop payload', () => {
    render(<PurchaseButton sku="skin-1" quantity={1} priceMinorUnits={1250} currency="NEAR" />);

    expect(screen.getByTestId('purchase-price')).toHaveTextContent('12.50 NEAR');
  });

  it('does not default to XLM when no currency is supplied', () => {
    render(<PurchaseButton sku="skin-1" quantity={1} priceMinorUnits={1250} />);

    const price = screen.getByTestId('purchase-price');
    expect(price).toHaveTextContent('12.50');
    expect(price).not.toHaveTextContent('XLM');
  });

  it('renders XLM only when the prop is explicitly XLM', () => {
    render(<PurchaseButton sku="skin-1" quantity={1} priceMinorUnits={1250} currency="XLM" />);

    expect(screen.getByTestId('purchase-price')).toHaveTextContent('12.50 XLM');
  });
});

describe('PurchaseButton pending state (#2171)', () => {
  it('disables the button while a purchase is pending and does not send a second request on a double click', async () => {
    // Deferred fetch: the request never settles until we resolve it below, so
    // the component stays in the `pending` state for the whole assertion.
    let resolveFetch!: (value: Response) => void;
    const deferred = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(deferred);
    vi.stubGlobal('fetch', fetchMock);

    render(<PurchaseButton sku="skin-1" quantity={1} />);

    const button = screen.getByRole('button', { name: /purchase/i });

    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());

    // A second click while the first request is still pending must not fire
    // another POST — the idempotency key is scoped to the intent, but the
    // button itself must also refuse to re-submit while in flight.
    fireEvent.click(button);
    fireEvent.click(button);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    // Settle the deferred promise so the test doesn't leak a pending timer.
    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({ orderId: 'order-1' }),
    } as Response);

    await waitFor(() => expect(button).not.toBeDisabled());
  });
});

// #2150 — the button can stay pending after unmount: the request must be
// aborted, and a response that arrives afterward must not touch state or
// notify the caller.
describe('PurchaseButton unmount safety', () => {
  let resolveFetch!: (value: unknown) => void;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const deferred = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    fetchMock = vi.fn(() => deferred);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('aborts the in-flight request on unmount', () => {
    const { unmount } = render(<PurchaseButton sku="skin-1" quantity={1} />);

    fireEvent.click(screen.getByRole('button'));

    const signal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it('does not call onPurchased when a late success resolves after unmount', async () => {
    const onPurchased = vi.fn();
    const { unmount } = render(<PurchaseButton sku="skin-1" quantity={1} onPurchased={onPurchased} />);

    fireEvent.click(screen.getByRole('button'));
    unmount();

    // The mock fetch does not itself honor the abort signal (it is a plain
    // deferred promise), so resolving it here exercises the explicit
    // `signal.aborted` guard in the handler rather than relying on fetch to
    // reject on its own.
    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ orderId: 'order-1' }) });
      await Promise.resolve();
    });

    expect(onPurchased).not.toHaveBeenCalled();
  });

  it('still calls onPurchased when the request completes before unmount', async () => {
    const onPurchased = vi.fn();
    render(<PurchaseButton sku="skin-1" quantity={1} onPurchased={onPurchased} />);

    fireEvent.click(screen.getByRole('button'));

    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ orderId: 'order-1' }) });
      await Promise.resolve();
    });

    expect(onPurchased).toHaveBeenCalledWith({ orderId: 'order-1', sku: 'skin-1', quantity: 1 });
  });
});
  });
});