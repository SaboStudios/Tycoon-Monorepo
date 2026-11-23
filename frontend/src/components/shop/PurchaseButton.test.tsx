import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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