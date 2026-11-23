import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JoinRoomForm } from '../components/join/JoinRoomForm';

async function submitCode(code: string) {
  await userEvent.type(screen.getByLabelText(/room code/i), code);
  await userEvent.click(screen.getByRole('button', { name: /join room/i }));
}

describe('JoinRoomForm HTTP error mapping (#2147)', () => {
  it('shows the not-found sentence for a 404', async () => {
    const onJoin = vi.fn().mockRejectedValue({ status: 404 });
    render(<JoinRoomForm onJoin={onJoin} />);

    await submitCode('ABCD');

    expect(await screen.findByText(/no room matches that code/i)).toBeInTheDocument();
  });

  it('shows the rate-limit sentence for a 429', async () => {
    const onJoin = vi.fn().mockRejectedValue({ status: 429 });
    render(<JoinRoomForm onJoin={onJoin} />);

    await submitCode('ABCD');

    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
  });

  it('keeps the generic server sentence for an unknown error', async () => {
    const onJoin = vi.fn().mockRejectedValue(new Error('boom'));
    render(<JoinRoomForm onJoin={onJoin} />);

    await submitCode('ABCD');

    expect(
      await screen.findByText(/something went wrong on our side/i),
    ).toBeInTheDocument();
  });

  it('maps a 403 Response to the forbidden sentence', async () => {
    const response = new Response(null, { status: 403 });
    const onJoin = vi.fn().mockRejectedValue(response);
    render(<JoinRoomForm onJoin={onJoin} />);

    await submitCode('ABCD');

    expect(
      await screen.findByText(/do not have access to this room/i),
    ).toBeInTheDocument();
  });

  it('maps a 401 to the session-expired sentence', async () => {
    const onJoin = vi.fn().mockRejectedValue({ status: 401 });
    render(<JoinRoomForm onJoin={onJoin} />);

    await submitCode('ABCD');

    expect(await screen.findByText(/your session expired/i)).toBeInTheDocument();
  });
});
