import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AccountSettings } from '../AccountSettings';

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('AccountSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the Account Settings card heading', () => {
      render(<AccountSettings />);
      expect(screen.getByText('Account Settings')).toBeInTheDocument();
    });

    it('renders the Email Address section', () => {
      render(<AccountSettings />);
      expect(screen.getByText('Email Address')).toBeInTheDocument();
    });

    it('renders the email input with a default value', () => {
      render(<AccountSettings />);
      const input = screen.getByLabelText('Current Email');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('player@tycoon.game');
    });

    it('renders the Update Email button', () => {
      render(<AccountSettings />);
      expect(screen.getByRole('button', { name: /update email/i })).toBeInTheDocument();
    });

    it('renders the Password section', () => {
      render(<AccountSettings />);
      expect(screen.getByText('Password')).toBeInTheDocument();
    });

    it('renders the Reset Password button', () => {
      render(<AccountSettings />);
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
    });
  });

  describe('Email update', () => {
    it('allows typing into the email input', async () => {
      render(<AccountSettings />);
      const input = screen.getByLabelText('Current Email') as HTMLInputElement;
      await userEvent.clear(input);
      await userEvent.type(input, 'new@example.com');
      expect(input.value).toBe('new@example.com');
    });

    it('shows loading state while updating email', async () => {
      render(<AccountSettings />);
      const submitBtn = screen.getByRole('button', { name: /update email/i });
      await userEvent.click(submitBtn);
      expect(screen.getByText(/updating/i)).toBeInTheDocument();
    });

    it('disables the Update Email button while loading', async () => {
      render(<AccountSettings />);
      const submitBtn = screen.getByRole('button', { name: /update email/i });
      await userEvent.click(submitBtn);
      const loadingBtn = screen.getByRole('button', { name: /updating/i });
      expect(loadingBtn).toBeDisabled();
    });

    it('shows success state after email update completes', async () => {
      vi.useFakeTimers();
      render(<AccountSettings />);
      const submitBtn = screen.getByRole('button', { name: /update email/i });
      await userEvent.click(submitBtn);
      await vi.runAllTimersAsync();
      await waitFor(() => {
        expect(screen.getByText(/updated/i)).toBeInTheDocument();
      });
      vi.useRealTimers();
    });
  });

  describe('Password reset', () => {
    it('shows loading state while sending password reset', async () => {
      render(<AccountSettings />);
      const resetBtn = screen.getByRole('button', { name: /reset password/i });
      await userEvent.click(resetBtn);
      expect(screen.getByText(/sending/i)).toBeInTheDocument();
    });

    it('disables the Reset Password button while loading', async () => {
      render(<AccountSettings />);
      const resetBtn = screen.getByRole('button', { name: /reset password/i });
      await userEvent.click(resetBtn);
      const loadingBtn = screen.getByRole('button', { name: /sending/i });
      expect(loadingBtn).toBeDisabled();
    });
  });
});
