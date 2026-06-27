import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NotificationSettings } from '../NotificationSettings';

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('NotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the Notifications card heading', () => {
      render(<NotificationSettings />);
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    it('renders Email Notifications toggle', () => {
      render(<NotificationSettings />);
      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    });

    it('renders Game Updates toggle', () => {
      render(<NotificationSettings />);
      expect(screen.getByText('Game Updates')).toBeInTheDocument();
    });

    it('renders Promotional Emails toggle', () => {
      render(<NotificationSettings />);
      expect(screen.getByText('Promotional Emails')).toBeInTheDocument();
    });

    it('renders the Save Preferences button', () => {
      render(<NotificationSettings />);
      expect(screen.getByRole('button', { name: /save preferences/i })).toBeInTheDocument();
    });

    it('has Email Notifications enabled by default', () => {
      render(<NotificationSettings />);
      const switches = screen.getAllByRole('switch');
      // First switch is email notifications — checked by default
      expect(switches[0]).toBeChecked();
    });

    it('has Promotional Emails disabled by default', () => {
      render(<NotificationSettings />);
      const switches = screen.getAllByRole('switch');
      // Third switch is promotions — unchecked by default
      expect(switches[2]).not.toBeChecked();
    });
  });

  describe('Toggle behavior', () => {
    it('toggles Email Notifications switch', async () => {
      render(<NotificationSettings />);
      const switches = screen.getAllByRole('switch');
      const emailSwitch = switches[0];
      expect(emailSwitch).toBeChecked();
      await userEvent.click(emailSwitch);
      expect(emailSwitch).not.toBeChecked();
    });

    it('toggles Promotional Emails switch on', async () => {
      render(<NotificationSettings />);
      const switches = screen.getAllByRole('switch');
      const promoSwitch = switches[2];
      expect(promoSwitch).not.toBeChecked();
      await userEvent.click(promoSwitch);
      expect(promoSwitch).toBeChecked();
    });
  });

  describe('Save preferences', () => {
    it('shows loading state while saving', async () => {
      render(<NotificationSettings />);
      const saveBtn = screen.getByRole('button', { name: /save preferences/i });
      await userEvent.click(saveBtn);
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });

    it('disables the save button while saving', async () => {
      render(<NotificationSettings />);
      const saveBtn = screen.getByRole('button', { name: /save preferences/i });
      await userEvent.click(saveBtn);
      const loadingBtn = screen.getByRole('button', { name: /saving/i });
      expect(loadingBtn).toBeDisabled();
    });

    it('disables all switches while saving', async () => {
      render(<NotificationSettings />);
      const saveBtn = screen.getByRole('button', { name: /save preferences/i });
      await userEvent.click(saveBtn);
      const switches = screen.getAllByRole('switch');
      switches.forEach((sw) => expect(sw).toBeDisabled());
    });

    it('re-enables save button after save completes', async () => {
      vi.useFakeTimers();
      render(<NotificationSettings />);
      const saveBtn = screen.getByRole('button', { name: /save preferences/i });
      await userEvent.click(saveBtn);
      await vi.runAllTimersAsync();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save preferences/i })).not.toBeDisabled();
      });
      vi.useRealTimers();
    });
  });
});
