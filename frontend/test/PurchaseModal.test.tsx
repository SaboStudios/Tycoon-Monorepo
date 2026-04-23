import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PurchaseModal } from '../src/components/ui/purchase-modal';

// Return defaultValue verbatim — the modal bakes itemName into defaultValue
// via template literal so no extra interpolation is needed here.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: Record<string, unknown>) =>
      (opts?.defaultValue as string | undefined) ?? _key,
  }),
}));

const BASE = {
  isOpen: true as boolean,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  itemName: 'Speed Boost' as string,
  itemPrice: '100.00' as string,
  itemCurrency: 'USD' as string,
};

/** Render with fresh spy functions each time. */
function setup(overrides: Partial<typeof BASE> = {}) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  const props = { ...BASE, ...overrides, onClose, onConfirm };
  const result = render(<PurchaseModal {...props} />);
  return { ...result, onClose, onConfirm, props };
}

afterEach(() => {
  document.body.style.overflow = '';
  vi.clearAllMocks();
});

// ── Render ───────────────────────────────────────────────────────────────────

describe('render', () => {
  it('renders nothing when isOpen is false', () => {
    setup({ isOpen: false });
    expect(screen.queryByTestId('purchase-modal')).toBeNull();
  });

  it('renders the modal when isOpen is true', () => {
    setup();
    expect(screen.getByTestId('purchase-modal')).toBeInTheDocument();
    expect(screen.getByText('Confirm Purchase')).toBeInTheDocument();
    expect(screen.getByTestId('purchase-modal-price')).toHaveTextContent('100.00 USD');
  });

  it('renders itemName inside the description', () => {
    setup({ itemName: 'Golden Dice' });
    expect(document.getElementById('purchase-modal-description')).toHaveTextContent(
      'Golden Dice',
    );
  });

  it('renders updated itemPrice and itemCurrency', () => {
    setup({ itemPrice: '9.99', itemCurrency: 'EUR' });
    expect(screen.getByTestId('purchase-modal-price')).toHaveTextContent('9.99 EUR');
  });

  it('renders a zero price without error', () => {
    setup({ itemPrice: '0.00', itemCurrency: 'USD' });
    expect(screen.getByTestId('purchase-modal-price')).toHaveTextContent('0.00 USD');
  });

  it('renders all three action buttons', () => {
    setup();
    expect(screen.getByTestId('purchase-modal-close')).toBeInTheDocument();
    expect(screen.getByTestId('purchase-modal-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('purchase-modal-confirm')).toBeInTheDocument();
  });
});

// ── ARIA / semantics ──────────────────────────────────────────────────────────

describe('ARIA and semantics', () => {
  it('has role="dialog" with aria-modal="true"', () => {
    setup();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('labels the dialog via aria-labelledby pointing to the title', () => {
    setup();
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-labelledby',
      'purchase-modal-title',
    );
    expect(document.getElementById('purchase-modal-title')).toHaveTextContent(
      'Confirm Purchase',
    );
  });

  it('describes the dialog via aria-describedby pointing to the description', () => {
    setup();
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-describedby',
      'purchase-modal-description',
    );
    expect(document.getElementById('purchase-modal-description')).toHaveTextContent(
      'Speed Boost',
    );
  });

  it('price region has aria-live="polite" and aria-atomic="true"', () => {
    setup();
    const price = screen.getByTestId('purchase-modal-price');
    expect(price).toHaveAttribute('aria-live', 'polite');
    expect(price).toHaveAttribute('aria-atomic', 'true');
  });

  it('close button has a descriptive aria-label', () => {
    setup();
    expect(screen.getByTestId('purchase-modal-close')).toHaveAttribute(
      'aria-label',
      'Close',
    );
  });

  it('backdrop is aria-hidden so screen readers skip it', () => {
    setup();
    expect(screen.getByTestId('purchase-modal-backdrop')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('all buttons have type="button"', () => {
    setup();
    ['purchase-modal-close', 'purchase-modal-cancel', 'purchase-modal-confirm'].forEach(
      (id) => expect(screen.getByTestId(id)).toHaveAttribute('type', 'button'),
    );
  });
});

// ── Focus order ───────────────────────────────────────────────────────────────

describe('focus order', () => {
  it('moves focus to the close (×) button on open', async () => {
    vi.useFakeTimers();
    setup();
    await act(async () => { vi.runAllTimers(); });
    vi.useRealTimers();
    expect(document.activeElement).toBe(screen.getByTestId('purchase-modal-close'));
  });

  it('tab order is: close → cancel → confirm', () => {
    setup();
    const close = screen.getByTestId('purchase-modal-close');
    const cancel = screen.getByTestId('purchase-modal-cancel');
    const confirm = screen.getByTestId('purchase-modal-confirm');

    [close, cancel, confirm].forEach((el) =>
      expect(el).not.toHaveAttribute('tabindex', '-1'),
    );

    const focusable = Array.from(
      screen.getByTestId('purchase-modal').querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    );
    expect(focusable.indexOf(close)).toBeLessThan(focusable.indexOf(cancel));
    expect(focusable.indexOf(cancel)).toBeLessThan(focusable.indexOf(confirm));
  });

  it('restores focus to the previously-focused element after modal closes', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <PurchaseModal {...BASE} onClose={onClose} onConfirm={onConfirm} isOpen={true} />,
    );
    rerender(
      <PurchaseModal {...BASE} onClose={onClose} onConfirm={onConfirm} isOpen={false} />,
    );
    await act(async () => {});
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});

// ── Keyboard ──────────────────────────────────────────────────────────────────

describe('keyboard', () => {
  it('calls onClose when Escape is pressed', () => {
    const { onClose } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for non-Escape keys', () => {
    const { onClose } = setup();
    ['Enter', 'Space', 'ArrowDown', 'a'].forEach((key) =>
      fireEvent.keyDown(document, { key }),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('wraps Tab from confirm (last) back to close (first)', () => {
    setup();
    const confirm = screen.getByTestId('purchase-modal-confirm');
    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(screen.getByTestId('purchase-modal-close'));
  });

  it('wraps Shift+Tab from close (first) back to confirm (last)', () => {
    setup();
    const close = screen.getByTestId('purchase-modal-close');
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId('purchase-modal-confirm'));
  });

  it('Enter on focused confirm button triggers onConfirm', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    screen.getByTestId('purchase-modal-confirm').focus();
    await user.keyboard('{Enter}');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Enter on focused cancel button triggers onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    screen.getByTestId('purchase-modal-cancel').focus();
    await user.keyboard('{Enter}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Space on focused close button triggers onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    screen.getByTestId('purchase-modal-close').focus();
    await user.keyboard(' ');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── Click interactions ────────────────────────────────────────────────────────

describe('click interactions', () => {
  it('calls onClose when the × button is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.click(screen.getByTestId('purchase-modal-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.click(screen.getByTestId('purchase-modal-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Confirm is clicked', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    await user.click(screen.getByTestId('purchase-modal-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.click(screen.getByTestId('purchase-modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Cancel does NOT call onConfirm', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    await user.click(screen.getByTestId('purchase-modal-cancel'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Confirm does NOT call onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.click(screen.getByTestId('purchase-modal-confirm'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('backdrop click does NOT call onConfirm', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    await user.click(screen.getByTestId('purchase-modal-backdrop'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('multiple Confirm clicks each fire onConfirm once per click', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    const btn = screen.getByTestId('purchase-modal-confirm');
    await user.click(btn);
    await user.click(btn);
    await user.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(3);
  });
});

// ── Scroll lock ───────────────────────────────────────────────────────────────

describe('scroll lock', () => {
  it('locks body scroll when open', () => {
    setup();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body scroll when unmounted', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const { unmount } = render(
      <PurchaseModal {...BASE} onClose={onClose} onConfirm={onConfirm} />,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('does not lock body scroll when closed', () => {
    setup({ isOpen: false });
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('preserves a pre-existing overflow value when modal closes', () => {
    document.body.style.overflow = 'auto';
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const { unmount } = render(
      <PurchaseModal {...BASE} onClose={onClose} onConfirm={onConfirm} isOpen={true} />,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });

  it('restores scroll when isOpen toggles from true to false', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <PurchaseModal {...BASE} onClose={onClose} onConfirm={onConfirm} isOpen={true} />,
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender(
      <PurchaseModal {...BASE} onClose={onClose} onConfirm={onConfirm} isOpen={false} />,
    );
    expect(document.body.style.overflow).toBe('');
  });
});

// ── Prop updates ──────────────────────────────────────────────────────────────

describe('prop updates', () => {
  it('re-renders with a new itemName', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <PurchaseModal {...BASE} onClose={onClose} onConfirm={onConfirm} />,
    );
    rerender(
      <PurchaseModal
        {...BASE}
        onClose={onClose}
        onConfirm={onConfirm}
        itemName="Legendary Card"
      />,
    );
    expect(document.getElementById('purchase-modal-description')).toHaveTextContent(
      'Legendary Card',
    );
  });

  it('re-renders with a new itemPrice and itemCurrency', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <PurchaseModal {...BASE} onClose={onClose} onConfirm={onConfirm} />,
    );
    rerender(
      <PurchaseModal
        {...BASE}
        onClose={onClose}
        onConfirm={onConfirm}
        itemPrice="250.00"
        itemCurrency="NEAR"
      />,
    );
    expect(screen.getByTestId('purchase-modal-price')).toHaveTextContent('250.00 NEAR');
  });

  it('hides the modal when isOpen changes to false', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <PurchaseModal {...BASE} onClose={onClose} onConfirm={onConfirm} isOpen={true} />,
    );
    expect(screen.getByTestId('purchase-modal')).toBeInTheDocument();
    rerender(
      <PurchaseModal {...BASE} onClose={onClose} onConfirm={onConfirm} isOpen={false} />,
    );
    expect(screen.queryByTestId('purchase-modal')).toBeNull();
  });

  it('shows the modal when isOpen changes to true', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <PurchaseModal {...BASE} onClose={onClose} onConfirm={onConfirm} isOpen={false} />,
    );
    expect(screen.queryByTestId('purchase-modal')).toBeNull();
    rerender(
      <PurchaseModal {...BASE} onClose={onClose} onConfirm={onConfirm} isOpen={true} />,
    );
    expect(screen.getByTestId('purchase-modal')).toBeInTheDocument();
  });
});
