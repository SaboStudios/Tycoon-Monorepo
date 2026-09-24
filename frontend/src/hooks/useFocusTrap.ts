import { useEffect, useRef, RefObject } from 'react';

const FOCUSABLE_SELECTORS =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus within `containerRef` while `active` is true.
 * Closes the container on Escape via `onClose`.
 * Returns focus to the previously focused element when deactivated.
 *
 * Safe for nested dialogs: each layer manages its own trap independently,
 * so there is no shared state that could cause double-trap bugs.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
): void {
  // Remember which element had focus before the trap activated
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!active) return;

    previousFocusRef.current = document.activeElement;

    // Move focus into the container on the next frame so the DOM is ready
    const raf = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const first = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)[0];
      first?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const container = containerRef.current;
      if (!container) return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
      ).filter((el) => !el.closest('[aria-hidden="true"]'));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown, true);
      // Restore focus to the element that was active before the trap
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [active, containerRef, onClose]);
}
