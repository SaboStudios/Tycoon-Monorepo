import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DangerZone } from '../DangerZone';

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('DangerZone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the Danger Zone heading', () => {
      render(<DangerZone />);
      expect(screen.getByText('Danger Zone')).toBeInTheDocument();
    });

    it('renders the irreversible actions description', () => {
      render(<DangerZone />);
      expect(screen.getByText(/irreversible and destructive/i)).toBeInTheDocument();
    });

    it('renders the Delete Account section', () => {
      render(<DangerZone />);
      expect(screen.getByText('Delete Account')).toBeInTheDocument();
    });

    it('renders the Delete button', () => {
      render(<DangerZone />);
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('renders the Privacy Policy link', () => {
      render(<DangerZone />);
      expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    });

    it('does not show confirmation modal initially', () => {
      render(<DangerZone />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Confirmation modal', () => {
    it('opens confirmation modal when Delete button is clicked', async () => {
      render(<DangerZone />);
      await userEvent.click(screen.getByRole('button', { name: /delete/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('shows the modal title about account deletion', async () => {
      render(<DangerZone />);
      await userEvent.click(screen.getByRole('button', { name: /delete/i }));
      expect(screen.getByText('Delete Account?')).toBeInTheDocument();
    });

    it('shows warning about irreversibility in modal', async () => {
      render(<DangerZone />);
      await userEvent.click(screen.getByRole('button', { name: /delete/i }));
      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    });

    it('closes the modal when Cancel is clicked', async () => {
      render(<DangerZone />);
      await userEvent.click(screen.getByRole('button', { name: /delete/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Account deletion flow', () => {
    it('shows loading state while deleting', async () => {
      render(<DangerZone />);
      await userEvent.click(screen.getByRole('button', { name: /delete/i }));
      await userEvent.click(screen.getByRole('button', { name: /delete my account/i }));
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });

    it('closes modal after deletion completes', async () => {
      vi.useFakeTimers();
      render(<DangerZone />);
      await userEvent.click(screen.getByRole('button', { name: /delete/i }));
      await userEvent.click(screen.getByRole('button', { name: /delete my account/i }));
      await vi.runAllTimersAsync();
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      vi.useRealTimers();
    });
  });
});
