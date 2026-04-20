import React, { useRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useFocusTrap } from '../src/hooks/useFocusTrap';

// ── Minimal test harness ──────────────────────────────────────────────────────

function Harness({
  active,
  onClose,
}: {
  active: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active, onClose);

  return (
    <div>
      <button data-testid="outside">Outside</button>
      <div ref={ref} data-testid="container">
        <button data-testid="first">First</button>
        <button data-testid="second">Second</button>
        <button data-testid="last">Last</button>
      </div>
    </div>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useFocusTrap', () => {
  it('calls onClose when Escape is pressed while active', () => {
    const onClose = vi.fn();
    render(<Harness active={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose on Escape when inactive', () => {
    const onClose = vi.fn();
    render(<Harness active={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('wraps Tab from last focusable element to first', () => {
    render(<Harness active={true} onClose={vi.fn()} />);
    const last = screen.getByTestId('last');
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab', shiftKey: false });
    // Focus should wrap to first
    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('wraps Shift+Tab from first focusable element to last', () => {
    render(<Harness active={true} onClose={vi.fn()} />);
    const first = screen.getByTestId('first');
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId('last'));
  });

  it('does not trap Tab when inactive', () => {
    render(<Harness active={false} onClose={vi.fn()} />);
    const outside = screen.getByTestId('outside');
    outside.focus();
    // Tab should not be intercepted — no error thrown
    fireEvent.keyDown(document, { key: 'Tab' });
    // Focus stays on outside (no trap active)
    expect(document.activeElement).toBe(outside);
  });
});
