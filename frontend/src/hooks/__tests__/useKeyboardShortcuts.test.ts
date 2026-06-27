import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, OverlayShortcuts } from '../useKeyboardShortcuts';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('useKeyboardShortcuts', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  describe('hook initialization', () => {
    it('returns undefined (void function)', () => {
      const { result } = renderHook(() => useKeyboardShortcuts({}));
      expect(result.current).toBeUndefined();
    });

    it('registers keydown listener on mount', () => {
      renderHook(() => useKeyboardShortcuts({}));
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('unregisters keydown listener on unmount', () => {
      const { unmount } = renderHook(() => useKeyboardShortcuts({}));
      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('handles empty shortcuts object without throwing', () => {
      expect(() => {
        renderHook(() => useKeyboardShortcuts({}));
      }).not.toThrow();
    });

    it('handles all shortcut callbacks provided', () => {
      const callbacks: OverlayShortcuts = {
        onInventory: vi.fn(),
        onShop: vi.fn(),
        onSettings: vi.fn(),
        onHelp: vi.fn(),
      };

      expect(() => {
        renderHook(() => useKeyboardShortcuts(callbacks));
      }).not.toThrow();
    });
  });

  describe('registered shortcut fires callback', () => {
    it('fires onInventory when "i" key is pressed', () => {
      const onInventory = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onInventory }));

      const event = new KeyboardEvent('keydown', { key: 'i' });
      document.dispatchEvent(event);

      expect(onInventory).toHaveBeenCalled();
    });

    it('fires onInventory when "I" (uppercase) key is pressed', () => {
      const onInventory = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onInventory }));

      const event = new KeyboardEvent('keydown', { key: 'I' });
      document.dispatchEvent(event);

      expect(onInventory).toHaveBeenCalled();
    });

    it('fires onShop when "s" key is pressed', () => {
      const onShop = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onShop }));

      const event = new KeyboardEvent('keydown', { key: 's' });
      document.dispatchEvent(event);

      expect(onShop).toHaveBeenCalled();
    });

    it('fires onShop when "S" (uppercase) key is pressed', () => {
      const onShop = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onShop }));

      const event = new KeyboardEvent('keydown', { key: 'S' });
      document.dispatchEvent(event);

      expect(onShop).toHaveBeenCalled();
    });

    it('fires onSettings when "," key is pressed', () => {
      const onSettings = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onSettings }));

      const event = new KeyboardEvent('keydown', { key: ',' });
      document.dispatchEvent(event);

      expect(onSettings).toHaveBeenCalled();
    });

    it('fires onHelp when "?" key is pressed', () => {
      const onHelp = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onHelp }));

      const event = new KeyboardEvent('keydown', { key: '?' });
      document.dispatchEvent(event);

      expect(onHelp).toHaveBeenCalled();
    });

    it('fires correct callback for each registered shortcut', () => {
      const callbacks = {
        onInventory: vi.fn(),
        onShop: vi.fn(),
        onSettings: vi.fn(),
        onHelp: vi.fn(),
      };

      renderHook(() => useKeyboardShortcuts(callbacks));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
      expect(callbacks.onInventory).toHaveBeenCalledOnce();
      expect(callbacks.onShop).not.toHaveBeenCalled();
      expect(callbacks.onSettings).not.toHaveBeenCalled();
      expect(callbacks.onHelp).not.toHaveBeenCalled();
    });
  });

  describe('unregistered key combinations do not fire callbacks', () => {
    it('does not fire any callback for unregistered keys', () => {
      const callbacks = {
        onInventory: vi.fn(),
        onShop: vi.fn(),
        onSettings: vi.fn(),
        onHelp: vi.fn(),
      };

      renderHook(() => useKeyboardShortcuts(callbacks));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

      expect(callbacks.onInventory).not.toHaveBeenCalled();
      expect(callbacks.onShop).not.toHaveBeenCalled();
      expect(callbacks.onSettings).not.toHaveBeenCalled();
      expect(callbacks.onHelp).not.toHaveBeenCalled();
    });

    it('does not fire callback for unregistered "s" when onShop is not provided', () => {
      const onInventory = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onInventory }));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));

      expect(onInventory).not.toHaveBeenCalled();
    });

    it('ignores keys that are not shortcuts', () => {
      const onInventory = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onInventory }));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));

      expect(onInventory).not.toHaveBeenCalled();
    });
  });

  describe('suppression when input/textarea has focus', () => {
    it('does not fire callback when focus is on INPUT element', () => {
      const onInventory = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onInventory }));

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent('keydown', { key: 'i' });
      Object.defineProperty(event, 'target', { value: input, enumerable: true });
      document.dispatchEvent(event);

      expect(onInventory).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it('does not fire callback when focus is on TEXTAREA element', () => {
      const onShop = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onShop }));

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      const event = new KeyboardEvent('keydown', { key: 's' });
      Object.defineProperty(event, 'target', { value: textarea, enumerable: true });
      document.dispatchEvent(event);

      expect(onShop).not.toHaveBeenCalled();
      document.body.removeChild(textarea);
    });

    it('does not fire callback when focus is on SELECT element', () => {
      const onSettings = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onSettings }));

      const select = document.createElement('select');
      document.body.appendChild(select);
      select.focus();

      const event = new KeyboardEvent('keydown', { key: ',' });
      Object.defineProperty(event, 'target', { value: select, enumerable: true });
      document.dispatchEvent(event);

      expect(onSettings).not.toHaveBeenCalled();
      document.body.removeChild(select);
    });

    it('does not fire callback when focus is on contenteditable element', () => {
      const onHelp = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onHelp }));

      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      document.body.appendChild(editable);

      // Create a KeyboardEvent that will have isContentEditable true
      const event = new KeyboardEvent('keydown', { key: '?' });

      // Mock the isContentEditable property
      Object.defineProperty(event, 'target', {
        value: {
          ...editable,
          tagName: 'DIV',
          isContentEditable: true
        },
        enumerable: true,
        configurable: true
      });

      document.dispatchEvent(event);

      expect(onHelp).not.toHaveBeenCalled();
      document.body.removeChild(editable);
    });

    it('fires callback when focus is not on editable element', () => {
      const onInventory = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onInventory }));

      const div = document.createElement('div');
      document.body.appendChild(div);
      div.focus();

      const event = new KeyboardEvent('keydown', { key: 'i' });
      Object.defineProperty(event, 'target', { value: div, enumerable: true });
      document.dispatchEvent(event);

      expect(onInventory).toHaveBeenCalled();
      document.body.removeChild(div);
    });
  });

  describe('modifier key suppression', () => {
    it('does not fire callback when Ctrl key is held', () => {
      const onInventory = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onInventory }));

      const event = new KeyboardEvent('keydown', { key: 'i', ctrlKey: true });
      document.dispatchEvent(event);

      expect(onInventory).not.toHaveBeenCalled();
    });

    it('does not fire callback when Alt key is held', () => {
      const onShop = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onShop }));

      const event = new KeyboardEvent('keydown', { key: 's', altKey: true });
      document.dispatchEvent(event);

      expect(onShop).not.toHaveBeenCalled();
    });

    it('does not fire callback when Meta (Cmd) key is held', () => {
      const onSettings = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onSettings }));

      const event = new KeyboardEvent('keydown', { key: ',', metaKey: true });
      document.dispatchEvent(event);

      expect(onSettings).not.toHaveBeenCalled();
    });

    it('fires callback when Shift key is held (Shift is not suppressed)', () => {
      const onHelp = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onHelp }));

      const event = new KeyboardEvent('keydown', { key: '?', shiftKey: true });
      document.dispatchEvent(event);

      expect(onHelp).toHaveBeenCalled();
    });
  });

  describe('stale closure handling', () => {
    it('uses latest callback when dependencies change', () => {
      const onInventory1 = vi.fn();
      const onInventory2 = vi.fn();

      const { rerender } = renderHook(
        ({ callback }) => useKeyboardShortcuts({ onInventory: callback }),
        { initialProps: { callback: onInventory1 } }
      );

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
      expect(onInventory1).toHaveBeenCalledOnce();
      expect(onInventory2).not.toHaveBeenCalled();

      rerender({ callback: onInventory2 });

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
      expect(onInventory2).toHaveBeenCalledOnce();
    });

    it('removes old listener and adds new listener when callback changes', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const { rerender } = renderHook(
        ({ callback }) => useKeyboardShortcuts({ onInventory: callback }),
        { initialProps: { callback: callback1 } }
      );

      addEventListenerSpy.mockClear();
      removeEventListenerSpy.mockClear();

      rerender({ callback: callback2 });

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('listener cleanup on unmount', () => {
    it('removes event listener when hook unmounts', () => {
      const onInventory = vi.fn();
      const { unmount } = renderHook(() => useKeyboardShortcuts({ onInventory }));

      removeEventListenerSpy.mockClear();
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('no callbacks fire after unmount', () => {
      const onInventory = vi.fn();
      const { unmount } = renderHook(() => useKeyboardShortcuts({ onInventory }));

      unmount();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));

      expect(onInventory).not.toHaveBeenCalled();
    });

    it('does not throw when unmounting', () => {
      const onInventory = vi.fn();
      const { unmount } = renderHook(() => useKeyboardShortcuts({ onInventory }));

      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });

  describe('edge cases: null/undefined callbacks', () => {
    it('handles undefined onInventory without throwing', () => {
      expect(() => {
        renderHook(() => useKeyboardShortcuts({ onInventory: undefined }));
      }).not.toThrow();
    });

    it('handles all callbacks as undefined without throwing', () => {
      expect(() => {
        renderHook(() =>
          useKeyboardShortcuts({
            onInventory: undefined,
            onShop: undefined,
            onSettings: undefined,
            onHelp: undefined,
          })
        );
      }).not.toThrow();
    });

    it('does not fire callback when callback is undefined', () => {
      expect(() => {
        renderHook(() => useKeyboardShortcuts({ onInventory: undefined }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
      }).not.toThrow();
    });

    it('handles null callbacks gracefully', () => {
      expect(() => {
        renderHook(() => useKeyboardShortcuts({ onInventory: null as any }));
      }).not.toThrow();
    });

    it('handles mixed defined and undefined callbacks', () => {
      const onInventory = vi.fn();
      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({
          onInventory,
          onShop: undefined,
          onSettings: undefined,
          onHelp: undefined,
        })
      );

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
      expect(onInventory).toHaveBeenCalled();

      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });

  describe('edge cases: empty shortcut map', () => {
    it('handles empty shortcuts object', () => {
      const { unmount } = renderHook(() => useKeyboardShortcuts({}));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('does not fire any callback when shortcuts object is empty', () => {
      const { unmount } = renderHook(() => useKeyboardShortcuts({}));

      expect(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
      }).not.toThrow();

      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });

  describe('multiple shortcuts fired in sequence', () => {
    it('fires correct callbacks for multiple key presses', () => {
      const callbacks = {
        onInventory: vi.fn(),
        onShop: vi.fn(),
        onSettings: vi.fn(),
        onHelp: vi.fn(),
      };

      renderHook(() => useKeyboardShortcuts(callbacks));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ',' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));

      expect(callbacks.onInventory).toHaveBeenCalledOnce();
      expect(callbacks.onShop).toHaveBeenCalledOnce();
      expect(callbacks.onSettings).toHaveBeenCalledOnce();
      expect(callbacks.onHelp).toHaveBeenCalledOnce();
    });

    it('handles repeated key presses', () => {
      const onInventory = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onInventory }));

      for (let i = 0; i < 5; i++) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
      }

      expect(onInventory).toHaveBeenCalledTimes(5);
    });
  });
});
