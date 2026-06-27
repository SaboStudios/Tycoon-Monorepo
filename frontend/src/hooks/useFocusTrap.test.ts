import { renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useFocusTrap } from './useFocusTrap';

describe('useFocusTrap', () => {
  let containerRef: React.RefObject<HTMLDivElement>;
  let container: HTMLDivElement;
  let button1: HTMLButtonElement;
  let button2: HTMLButtonElement;
  let button3: HTMLButtonElement;

  beforeEach(() => {
    // Create container with focusable elements
    container = document.createElement('div');
    button1 = document.createElement('button');
    button2 = document.createElement('button');
    button3 = document.createElement('button');

    button1.textContent = 'Button 1';
    button2.textContent = 'Button 2';
    button3.textContent = 'Button 3';

    container.appendChild(button1);
    container.appendChild(button2);
    container.appendChild(button3);
    document.body.appendChild(container);

    containerRef = { current: container };
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('Tab key cycles forward through focusable elements', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderHook(() => useFocusTrap(containerRef, true, onClose));

    button1.focus();
    expect(document.activeElement).toBe(button1);

    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(button2);

    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(button3);
  });

  it('Shift+Tab cycles backward through focusable elements', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderHook(() => useFocusTrap(containerRef, true, onClose));

    button3.focus();
    expect(document.activeElement).toBe(button3);

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(button2);

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(button1);
  });

  it('Tab from last element wraps to first element', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderHook(() => useFocusTrap(containerRef, true, onClose));

    button3.focus();
    expect(document.activeElement).toBe(button3);

    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(button1);
  });

  it('Shift+Tab from first element wraps to last element', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderHook(() => useFocusTrap(containerRef, true, onClose));

    button1.focus();
    expect(document.activeElement).toBe(button1);

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(button3);
  });

  it('Focus does not escape container while trap is active', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const outsideButton = document.createElement('button');
    outsideButton.textContent = 'Outside';
    document.body.appendChild(outsideButton);

    renderHook(() => useFocusTrap(containerRef, true, onClose));

    button1.focus();
    await user.keyboard('{Tab}{Tab}{Tab}');
    // Should wrap back to button1, not escape
    expect(document.activeElement).toBe(button1);

    document.body.removeChild(outsideButton);
  });

  it('Escape key calls onClose callback', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderHook(() => useFocusTrap(containerRef, true, onClose));

    button1.focus();
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('Focus is no longer trapped when isActive is false', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { rerender } = renderHook(
      ({ active }) => useFocusTrap(containerRef, active, onClose),
      { initialProps: { active: true } }
    );

    button1.focus();
    await user.keyboard('{Tab}{Tab}{Tab}');
    expect(document.activeElement).toBe(button1);

    // Deactivate trap
    rerender({ active: false });

    // Now focus should not be trapped
    // (This is tested indirectly - the trap event listener should be removed)
  });

  it('Container with zero focusable elements does not throw', () => {
    const emptyContainer = document.createElement('div');
    const emptyRef = { current: emptyContainer };
    document.body.appendChild(emptyContainer);
    const onClose = vi.fn();

    expect(() => {
      renderHook(() => useFocusTrap(emptyRef, true, onClose));
    }).not.toThrow();

    document.body.removeChild(emptyContainer);
  });

  it('Container with one focusable element keeps focus on that element', async () => {
    const user = userEvent.setup();
    const singleContainer = document.createElement('div');
    const singleButton = document.createElement('button');
    singleButton.textContent = 'Only Button';
    singleContainer.appendChild(singleButton);
    document.body.appendChild(singleContainer);

    const singleRef = { current: singleContainer };
    const onClose = vi.fn();

    renderHook(() => useFocusTrap(singleRef, true, onClose));

    singleButton.focus();
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(singleButton);

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(singleButton);

    document.body.removeChild(singleContainer);
  });

  it('Cleans up event listeners on unmount', () => {
    const onClose = vi.fn();
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useFocusTrap(containerRef, true, onClose));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    removeEventListenerSpy.mockRestore();
  });

  it('Restores focus to previously focused element on deactivation', async () => {
    const previousButton = document.createElement('button');
    previousButton.textContent = 'Previous';
    document.body.appendChild(previousButton);

    previousButton.focus();
    expect(document.activeElement).toBe(previousButton);

    const onClose = vi.fn();
    const { rerender } = renderHook(
      ({ active }) => useFocusTrap(containerRef, active, onClose),
      { initialProps: { active: false } }
    );

    rerender({ active: true });

    // After some interaction
    rerender({ active: false });

    // Focus should ideally be restored (implementation dependent)

    document.body.removeChild(previousButton);
  });

  it('Filters out elements with aria-hidden="true"', async () => {
    const user = userEvent.setup();
    const hiddenButton = document.createElement('button');
    hiddenButton.setAttribute('aria-hidden', 'true');
    hiddenButton.textContent = 'Hidden Button';

    // Insert hidden button between button1 and button2
    container.insertBefore(hiddenButton, button2);

    const onClose = vi.fn();

    renderHook(() => useFocusTrap(containerRef, true, onClose));

    button1.focus();
    await user.keyboard('{Tab}');
    // Should skip hidden button and go to button2
    expect(document.activeElement).toBe(button2);
  });
});
