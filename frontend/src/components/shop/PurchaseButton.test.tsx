import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PurchaseButton from './PurchaseButton';

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