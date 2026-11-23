import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { JoinRoomForm } from '../components/join/JoinRoomForm';
import { WALLET_MISSING_MESSAGE } from '../components/landing/Hero';

describe('JoinRoomForm error focus and aria wiring (#2156)', () => {
  it('associates the input with the error via aria-describedby and marks it invalid after a failed submit', async () => {
    const onJoin = vi.fn().mockRejectedValue({ code: 'not_found', message: 'No room matches that code. Check it and try again.' });

    render(<JoinRoomForm onJoin={onJoin} initialCode="ABCD" />);

    const input = screen.getByLabelText('Room code');
    fireEvent.click(screen.getByRole('button', { name: /join room/i }));

    await waitFor(() => expect(onJoin).toHaveBeenCalled());

    const errorMessage = await screen.findByRole('alert');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain(errorMessage.id);
    expect(errorMessage).toHaveTextContent('No room matches that code. Check it and try again.');
  });

  it('returns focus to the input after a failed submit', async () => {
    const onJoin = vi.fn().mockRejectedValue({ code: 'server_error', message: 'Something went wrong on our side. Please try again.' });

    render(<JoinRoomForm onJoin={onJoin} initialCode="ABCD" />);

    const input = screen.getByLabelText('Room code');
    fireEvent.click(screen.getByRole('button', { name: /join room/i }));

    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    await waitFor(() => expect(input).toHaveFocus());
  });

  it('focuses the input and skips the API call for a client-side validation error (empty code)', () => {
    const onJoin = vi.fn();

    render(<JoinRoomForm onJoin={onJoin} initialCode="" />);

    const input = screen.getByLabelText('Room code');
    fireEvent.click(screen.getByRole('button', { name: /join room/i }));

    expect(onJoin).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveFocus();
  });

  it('does not set aria-invalid or aria-describedby when there is no error', () => {
    render(<JoinRoomForm onJoin={vi.fn()} initialCode="ABCD" />);

    const input = screen.getByLabelText('Room code');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });
});

describe('JoinRoomForm disabled-session copy (#2153)', () => {
  it('shows the shared missing-wallet sentence, not just a disabled button, when disabled', () => {
    render(<JoinRoomForm onJoin={vi.fn()} disabled />);

    const reason = screen.getByTestId('join-room-disabled-reason');
    expect(reason).toHaveTextContent(WALLET_MISSING_MESSAGE);
  });

  it('uses the exact sentence the landing hero uses for a missing wallet', () => {
    render(<JoinRoomForm onJoin={vi.fn()} disabled />);

    expect(screen.getByTestId('join-room-disabled-reason')).toHaveTextContent(
      WALLET_MISSING_MESSAGE,
    );
  });

  it('allows a custom disabledReason to override the default sentence', () => {
    render(<JoinRoomForm onJoin={vi.fn()} disabled disabledReason="Custom reason." />);

    expect(screen.getByTestId('join-room-disabled-reason')).toHaveTextContent('Custom reason.');
  });

  it('does not render the disabled-reason sentence when the form is enabled', () => {
    render(<JoinRoomForm onJoin={vi.fn()} />);

    expect(screen.queryByTestId('join-room-disabled-reason')).not.toBeInTheDocument();
  });

  it('does not run submit while disabled', () => {
    const onJoin = vi.fn();
    render(<JoinRoomForm onJoin={onJoin} initialCode="ABCD" disabled />);

    const button = screen.getByRole('button', { name: /join room/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('ties the input to the disabled reason via aria-describedby', () => {
    render(<JoinRoomForm onJoin={vi.fn()} disabled />);

    const input = screen.getByLabelText('Room code');
    const reason = screen.getByTestId('join-room-disabled-reason');
    expect(input.getAttribute('aria-describedby')).toContain(reason.id);
  });
});
