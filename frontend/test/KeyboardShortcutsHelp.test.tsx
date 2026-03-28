import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyboardShortcutsHelp } from '../src/components/game/KeyboardShortcutsHelp';

describe('KeyboardShortcutsHelp', () => {
  it('renders nothing when isOpen is false', () => {
    render(<KeyboardShortcutsHelp isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('keyboard-shortcuts-help')).toBeNull();
  });

  it('renders the cheat sheet when isOpen is true', () => {
    render(<KeyboardShortcutsHelp isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('keyboard-shortcuts-help')).toBeDefined();
    expect(screen.getByText('Keyboard Shortcuts')).toBeDefined();
  });

  it('displays all shortcut entries', () => {
    render(<KeyboardShortcutsHelp isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Toggle Inventory')).toBeDefined();
    expect(screen.getByText('Toggle Shop')).toBeDefined();
    expect(screen.getByText('Toggle Settings')).toBeDefined();
    expect(screen.getByText('Close active overlay')).toBeDefined();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsHelp isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close keyboard shortcuts help'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsHelp isOpen={true} onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.querySelector('[aria-hidden="true"]') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsHelp isOpen={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has correct ARIA attributes', () => {
    render(<KeyboardShortcutsHelp isOpen={true} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'shortcuts-help-title');
  });
});
