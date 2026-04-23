import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PurchaseModal } from "../src/components/ui/purchase-modal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (key === "shop.purchase_confirmation_msg") return `Confirm purchase of ${opts?.name}`;
      const map: Record<string, string> = {
        "shop.confirm_purchase": "Confirm Purchase",
        "shop.cancel": "Cancel",
        "shop.purchase": "Purchase",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: () => undefined,
}));

function renderModal(props: Partial<React.ComponentProps<typeof PurchaseModal>> = {}) {
  const defaults = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    itemName: "Speed Boost",
    itemPrice: "100",
    itemCurrency: "NEAR",
  };
  const merged = { ...defaults, ...props };
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PurchaseModal } from '../src/components/ui/purchase-modal';

// react-i18next: return the key's defaultValue so tests are locale-independent
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? _key,
  }),
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  itemName: 'Speed Boost',
  itemPrice: '100.00',
  itemCurrency: 'USD',
};

function renderModal(props: Partial<typeof defaultProps> = {}) {
  const merged = { ...defaultProps, ...props, onClose: vi.fn(), onConfirm: vi.fn() };
  render(<PurchaseModal {...merged} />);
  return merged;
}

// ─── Render / interaction ────────────────────────────────────────────────────

describe("PurchaseModal", () => {
  it("renders when open", () => {
    renderModal();
    expect(screen.getByTestId("purchase-modal")).toBeInTheDocument();
    expect(screen.getByTestId("purchase-modal-cancel")).toBeInTheDocument();
    expect(screen.getByTestId("purchase-modal-confirm")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    renderModal({ isOpen: false });
    expect(screen.queryByTestId("purchase-modal")).toBeNull();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const { onClose } = renderModal();
    await userEvent.click(screen.getByTestId("purchase-modal-cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Purchase is clicked", async () => {
    const { onConfirm } = renderModal();
    await userEvent.click(screen.getByTestId("purchase-modal-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", async () => {
    const { onClose } = renderModal();
    await userEvent.click(screen.getByTestId("purchase-modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ─── SW-FE-028: CLS / LCP perf budget ─────────────────────────────────────

  describe("SW-FE-028 — CLS / LCP perf budget", () => {
    it("card has min-h class to prevent layout shift", () => {
      renderModal();
      const card = screen.getByTestId("purchase-modal").querySelector(".min-h-\\[220px\\]");
      expect(card).toBeInTheDocument();
    });

    it("price container has explicit height class to reserve space", () => {
      renderModal();
      const priceEl = screen.getByTestId("purchase-modal-price");
      // The inner div must carry h-10 so the price line never causes CLS
      const inner = priceEl.querySelector(".h-10");
      expect(inner).toBeInTheDocument();
    });
  });

  // ─── SW-FE-031: Security hardening ────────────────────────────────────────

  describe("SW-FE-031 — security hardening", () => {
    it("strips HTML tags from itemName", () => {
      renderModal({ itemName: '<img src=x onerror="alert(1)">Boost' });
      // The sanitized name should appear without the tag
      expect(screen.getByText(/Confirm purchase of Boost/)).toBeInTheDocument();
      expect(screen.queryByRole("img")).toBeNull();
    });

    it("strips HTML tags from itemPrice", () => {
      renderModal({ itemPrice: '<script>alert(1)</script>100' });
      const priceEl = screen.getByTestId("purchase-modal-price");
      expect(priceEl.innerHTML).not.toContain("<script>");
      expect(priceEl.textContent).toContain("100");
    });

    it("strips HTML tags from itemCurrency", () => {
      renderModal({ itemCurrency: '<b>NEAR</b>' });
      const priceEl = screen.getByTestId("purchase-modal-price");
      expect(priceEl.innerHTML).not.toContain("<b>");
      expect(priceEl.textContent).toContain("NEAR");
    });

    it("renders plain text props without modification", () => {
      renderModal({ itemName: "Speed Boost", itemPrice: "100", itemCurrency: "NEAR" });
      expect(screen.getByTestId("purchase-modal-price").textContent).toContain("100 NEAR");
    });
describe('PurchaseModal', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

  // ── Render ────────────────────────────────────────────────────────────────

  it('renders nothing when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByTestId('purchase-modal')).toBeNull();
  });

  it('renders the modal when isOpen is true', () => {
    renderModal();
    expect(screen.getByTestId('purchase-modal')).toBeInTheDocument();
    expect(screen.getByText('Confirm Purchase')).toBeInTheDocument();
    expect(screen.getByText(/Speed Boost/)).toBeInTheDocument();
    expect(screen.getByTestId('purchase-modal-price')).toHaveTextContent('100.00 USD');
  });

  // ── ARIA / semantics ──────────────────────────────────────────────────────

  it('has role="dialog" with aria-modal="true"', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('labels the dialog with aria-labelledby pointing to the title', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'purchase-modal-title');
    expect(document.getElementById('purchase-modal-title')).toHaveTextContent(
      'Confirm Purchase',
    );
  });

  it('describes the dialog with aria-describedby pointing to the description', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-describedby', 'purchase-modal-description');
    expect(document.getElementById('purchase-modal-description')).toHaveTextContent(
      'Speed Boost',
    );
  });

  it('price region has aria-live="polite" and aria-atomic="true"', () => {
    renderModal();
    const price = screen.getByTestId('purchase-modal-price');
    expect(price).toHaveAttribute('aria-live', 'polite');
    expect(price).toHaveAttribute('aria-atomic', 'true');
  });

  it('close button has a descriptive aria-label', () => {
    renderModal();
    expect(screen.getByTestId('purchase-modal-close')).toHaveAttribute(
      'aria-label',
      'Close',
    );
  });

  // ── Focus order ───────────────────────────────────────────────────────────

  it('moves focus to the close (×) button on open', async () => {
    vi.useFakeTimers();
    renderModal();
    // Flush all pending requestAnimationFrame callbacks
    await act(async () => { vi.runAllTimers(); });
    vi.useRealTimers();
    expect(document.activeElement).toBe(screen.getByTestId('purchase-modal-close'));
  });

  it('tab order is: close → cancel → confirm', () => {
    renderModal();
    const close = screen.getByTestId('purchase-modal-close');
    const cancel = screen.getByTestId('purchase-modal-cancel');
    const confirm = screen.getByTestId('purchase-modal-confirm');

    // All three must be in the DOM and focusable
    [close, cancel, confirm].forEach((el) => {
      expect(el).toBeInTheDocument();
      expect(el).not.toHaveAttribute('tabindex', '-1');
    });

    // DOM order: close appears before cancel, cancel before confirm
    const all = Array.from(
      screen.getByTestId('purchase-modal').querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    );
    expect(all.indexOf(close)).toBeLessThan(all.indexOf(cancel));
    expect(all.indexOf(cancel)).toBeLessThan(all.indexOf(confirm));
  });

  // ── Keyboard ──────────────────────────────────────────────────────────────

  it('calls onClose when Escape is pressed', () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('wraps Tab from confirm (last) back to close (first)', async () => {
    renderModal();
    const confirm = screen.getByTestId('purchase-modal-confirm');
    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(screen.getByTestId('purchase-modal-close'));
  });

  it('wraps Shift+Tab from close (first) back to confirm (last)', async () => {
    renderModal();
    const close = screen.getByTestId('purchase-modal-close');
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId('purchase-modal-confirm'));
  });

  // ── Interactions ──────────────────────────────────────────────────────────

  it('calls onClose when the × button is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByTestId('purchase-modal-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByTestId('purchase-modal-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Confirm is clicked', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderModal();
    await user.click(screen.getByTestId('purchase-modal-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByTestId('purchase-modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Scroll lock ───────────────────────────────────────────────────────────

  it('locks body scroll when open', () => {
    renderModal();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body scroll when unmounted', () => {
    const { unmount } = render(<PurchaseModal {...defaultProps} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('does not lock body scroll when closed', () => {
    renderModal({ isOpen: false });
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
