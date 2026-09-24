import { useEffect, useCallback } from 'react';

export interface OverlayShortcuts {
  /** Open / close the inventory overlay (default: `i`) */
  onInventory?: () => void;
  /** Open / close the shop overlay (default: `s`) */
  onShop?: () => void;
  /** Open / close the settings overlay (default: `,`) */
  onSettings?: () => void;
  /** Open / close the help / cheat-sheet overlay (default: `?`) */
  onHelp?: () => void;
}

/**
 * Registers global keyboard shortcuts for game overlays.
 *
 * Shortcuts are suppressed when focus is inside an editable element
 * (input, textarea, select, contenteditable) so they don't interfere
 * with typing.
 *
 * All handlers are optional — only the ones provided are registered.
 */
export function useKeyboardShortcuts(shortcuts: OverlayShortcuts): void {
  const { onInventory, onShop, onSettings, onHelp } = shortcuts;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't fire shortcuts while the user is typing
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't fire when modifier keys are held (except Shift for `?`)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      switch (e.key) {
        case 'i':
        case 'I':
          onInventory?.();
          break;
        case 's':
        case 'S':
          onShop?.();
          break;
        case ',':
          onSettings?.();
          break;
        case '?':
          onHelp?.();
          break;
      }
    },
    [onInventory, onShop, onSettings, onHelp],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/** Canonical shortcut map — single source of truth for the cheat sheet. */
export const KEYBOARD_SHORTCUT_MAP = [
  { key: 'I', description: 'Toggle Inventory' },
  { key: 'S', description: 'Toggle Shop' },
  { key: ',', description: 'Toggle Settings' },
  { key: '?', description: 'Toggle Help / Shortcuts' },
  { key: 'Esc', description: 'Close active overlay' },
  { key: 'Tab', description: 'Move focus forward within overlay' },
  { key: 'Shift + Tab', description: 'Move focus backward within overlay' },
] as const;
