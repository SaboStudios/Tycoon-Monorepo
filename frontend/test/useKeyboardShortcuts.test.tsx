import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import {
  useKeyboardShortcuts,
  KEYBOARD_SHORTCUT_MAP,
} from '../src/hooks/useKeyboardShortcuts';

// ── useKeyboardShortcuts ──────────────────────────────────────────────────────

describe('useKeyboardShortcuts', () => {
  it('calls onInventory when "i" is pressed', () => {
    const onInventory = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onInventory }));
    fireEvent.keyDown(document, { key: 'i' });
    expect(onInventory).toHaveBeenCalledTimes(1);
  });

  it('calls onShop when "s" is pressed', () => {
    const onShop = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onShop }));
    fireEvent.keyDown(document, { key: 's' });
    expect(onShop).toHaveBeenCalledTimes(1);
  });

  it('calls onSettings when "," is pressed', () => {
    const onSettings = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onSettings }));
    fireEvent.keyDown(document, { key: ',' });
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it('calls onHelp when "?" is pressed', () => {
    const onHelp = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onHelp }));
    fireEvent.keyDown(document, { key: '?' });
    expect(onHelp).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire shortcuts when Ctrl modifier is held', () => {
    const onInventory = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onInventory }));
    fireEvent.keyDown(document, { key: 'i', ctrlKey: true });
    expect(onInventory).not.toHaveBeenCalled();
  });

  it('does NOT fire shortcuts when focus is inside an input', () => {
    const onShop = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onShop }));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: 's' });
    expect(onShop).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('does NOT fire shortcuts when focus is inside a textarea', () => {
    const onInventory = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onInventory }));
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();
    fireEvent.keyDown(ta, { key: 'i' });
    expect(onInventory).not.toHaveBeenCalled();
    document.body.removeChild(ta);
  });

  it('cleans up the event listener on unmount', () => {
    const onInventory = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ onInventory }));
    unmount();
    fireEvent.keyDown(document, { key: 'i' });
    expect(onInventory).not.toHaveBeenCalled();
  });
});

// ── KEYBOARD_SHORTCUT_MAP ─────────────────────────────────────────────────────

describe('KEYBOARD_SHORTCUT_MAP', () => {
  it('contains entries for all documented shortcuts', () => {
    const keys = KEYBOARD_SHORTCUT_MAP.map((s) => s.key);
    expect(keys).toContain('I');
    expect(keys).toContain('S');
    expect(keys).toContain(',');
    expect(keys).toContain('?');
    expect(keys).toContain('Esc');
    expect(keys).toContain('Tab');
  });

  it('every entry has a non-empty description', () => {
    for (const { description } of KEYBOARD_SHORTCUT_MAP) {
      expect(description.length).toBeGreaterThan(0);
    }
  });
});
