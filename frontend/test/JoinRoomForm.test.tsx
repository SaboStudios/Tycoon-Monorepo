import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { JoinRoomForm, validateCode } from '../components/join/JoinRoomForm';
import { WALLET_MISSING_MESSAGE } from '../components/landing/Hero';

function pendingJoin() {
  return vi.fn().mockReturnValue(new Promise(() => {}));
}

describe('validateCode', () => {
  it('rejects an empty code', () => {
    expect(validateCode('')).toEqual({
      code: 'empty',
      message: 'Enter a room code to continue.',
    });
  });

  it('rejects a code shorter than 4 characters', () => {
    expect(validateCode('ABC')).toEqual({
      code: 'invalid_code',
      message: 'Room codes are 4–12 letters or numbers.',
    });
  });

  it('accepts a valid 4-character code', () => {
    expect(validateCode('ABCD')).toBeNull();
  });
});

describe('JoinRoomForm input normalization (#2149)', () => {
  it('shows the normalized uppercase value as the user types', () => {
    render(<JoinRoomForm onJoin={pendingJoin()} />);
    const input = screen.getByLabelText('Room code') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'ab' } });

    expect(input.value).toBe('AB');
  });

  it('drops a leading/trailing space from the field as the user types', () => {
    render(<JoinRoomForm onJoin={pendingJoin()} />);
    const input = screen.getByLabelText('Room code') as HTMLInputElement;

    fireEvent.change(input, { target: { value: ' ab12 ' } });

    expect(input.value).toBe('AB12');
  });

  it('submits exactly the string the field shows', async () => {
    const onJoin = vi.fn().mockResolvedValue({ roomId: 'room-1' });
    render(<JoinRoomForm onJoin={onJoin} />);
    const input = screen.getByLabelText('Room code') as HTMLInputElement;
    const form = input.closest('form') as HTMLFormElement;

    fireEvent.change(input, { target: { value: ' ab12 ' } });
    expect(input.value).toBe('AB12');

    fireEvent.submit(form);

    expect(onJoin).toHaveBeenCalledWith('AB12', expect.anything());
  });
});

describe('JoinRoomForm error clearing (#2148)', () => {
  it('clears an invalid_code error as soon as the user types', async () => {
    render(<JoinRoomForm onJoin={pendingJoin()} />);
    const input = screen.getByLabelText('Room code') as HTMLInputElement;
    const form = input.closest('form') as HTMLFormElement;

    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.submit(form);

    expect(
      await screen.findByText('Room codes are 4–12 letters or numbers.'),
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'abc' } });

    expect(
      screen.queryByText('Room codes are 4–12 letters or numbers.'),
    ).not.toBeInTheDocument();
  });

  it('clears an empty error as soon as the user types', async () => {
    render(<JoinRoomForm onJoin={pendingJoin()} />);
    const input = screen.getByLabelText('Room code') as HTMLInputElement;
    const form = input.closest('form') as HTMLFormElement;

    fireEvent.submit(form);
    expect(await screen.findByText('Enter a room code to continue.')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'a' } });

    expect(screen.queryByText('Enter a room code to continue.')).not.toBeInTheDocument();
  });

  it('keeps an auth_expired error visible while the user types, and the value still updates', async () => {
    const onJoin = vi.fn().mockRejectedValue({
      code: 'auth_expired',
      message: 'Your session expired. Reconnect your wallet to continue.',
    });
    render(<JoinRoomForm onJoin={onJoin} />);
    const input = screen.getByLabelText('Room code') as HTMLInputElement;
    const form = input.closest('form') as HTMLFormElement;

    fireEvent.change(input, { target: { value: 'ABCD' } });
    fireEvent.submit(form);

    expect(
      await screen.findByText('Your session expired. Reconnect your wallet to continue.'),
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'ABCDE' } });

    expect(
      screen.getByText('Your session expired. Reconnect your wallet to continue.'),
    ).toBeInTheDocument();
    expect(input.value).toBe('ABCDE');
  });

  it('keeps a rate_limited error visible while the user types', async () => {
    const onJoin = vi.fn().mockRejectedValue({
      code: 'rate_limited',
      message: 'Too many attempts. Wait a moment and try again.',
    });
    render(<JoinRoomForm onJoin={onJoin} />);
    const input = screen.getByLabelText('Room code') as HTMLInputElement;
    const form = input.closest('form') as HTMLFormElement;

    fireEvent.change(input, { target: { value: 'ABCD' } });
    fireEvent.submit(form);

    expect(
      await screen.findByText('Too many attempts. Wait a moment and try again.'),
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'ABCDEF' } });

    expect(
      screen.getByText('Too many attempts. Wait a moment and try again.'),
    ).toBeInTheDocument();
  });
});

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
  });
});
