import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { DangerZone } from '../components/settings/DangerZone';

// #2154: a single Confirm click must not be enough for the strongest account
// actions. The confirm button in the danger-zone dialog must stay disabled
// until the user retypes the exact phrase shown in the dialog.
describe('DangerZone confirm-phrase gate (#2154)', () => {
  it('disables Confirm before any phrase is entered', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<DangerZone onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));

    const confirmButton = screen.getAllByRole('button', { name: 'Delete account' })[1];
    expect(confirmButton).toBeDisabled();
  });

  it('enables Confirm only once the exact phrase is typed', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<DangerZone onConfirm={onConfirm} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete account' })[0]);

    const phraseInput = screen.getByLabelText(/DELETE MY ACCOUNT/);
    const confirmButton = screen.getAllByRole('button', { name: 'Delete account' })[1];

    fireEvent.change(phraseInput, { target: { value: 'DELETE MY ACCOUNT' } });
    expect(confirmButton).not.toBeDisabled();
  });

  it('keeps Confirm disabled for a wrong phrase', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<DangerZone onConfirm={onConfirm} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete account' })[0]);

    const phraseInput = screen.getByLabelText(/DELETE MY ACCOUNT/);
    const confirmButton = screen.getAllByRole('button', { name: 'Delete account' })[1];

    fireEvent.change(phraseInput, { target: { value: 'delete my account' } });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(phraseInput, { target: { value: 'DELETE MY ACCOUNT ' } });
    expect(confirmButton).toBeDisabled();
  });

  it('does not call onConfirm when Cancel is clicked, even with the right phrase typed', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<DangerZone onConfirm={onConfirm} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete account' })[0]);

    const phraseInput = screen.getByLabelText(/DELETE MY ACCOUNT/);
    fireEvent.change(phraseInput, { target: { value: 'DELETE MY ACCOUNT' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm with the action id once the exact phrase enables Confirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<DangerZone onConfirm={onConfirm} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Reset progress' })[0]);

    const phraseInput = screen.getByLabelText(/RESET PROGRESS/);
    fireEvent.change(phraseInput, { target: { value: 'RESET PROGRESS' } });

    const confirmButton = screen.getAllByRole('button', { name: 'Reset progress' })[1];
    expect(confirmButton).not.toBeDisabled();

    await fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('reset-progress');
  });
});
