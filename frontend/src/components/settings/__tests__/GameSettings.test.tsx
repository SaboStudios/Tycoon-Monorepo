import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GameSettings } from '../GameSettings';

const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: () => ({ confirmLeave: () => true }),
}));

vi.mock('@/lib/validation', () => ({
  gameSettingsSchema: {
    safeParse: (data: { playerName: string; customStake?: string }) => {
      if (!data.playerName || data.playerName.trim() === '') {
        return {
          success: false,
          error: { issues: [{ path: ['playerName'], message: 'Player name is required' }] },
        };
      }
      return { success: true, data };
    },
  },
  mapServerErrors: vi.fn(() => ({})),
}));

vi.mock('@/components/settings/ThemeSettingsCard', () => ({
  ThemeSettingsCard: () => <div data-testid="theme-settings-card" />,
}));

describe('GameSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the Create Multiplayer Lobby heading', () => {
      render(<GameSettings />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Create Multiplayer Lobby');
    });

    it('renders the Lobby Configuration card', () => {
      render(<GameSettings />);
      expect(screen.getByText('Lobby Configuration')).toBeInTheDocument();
    });

    it('renders the Host Name input', () => {
      render(<GameSettings />);
      expect(screen.getByLabelText(/host name/i)).toBeInTheDocument();
    });

    it('renders the Economic Protocol card', () => {
      render(<GameSettings />);
      expect(screen.getByText('Economic Protocol')).toBeInTheDocument();
    });

    it('renders the Create Lobby button', () => {
      render(<GameSettings />);
      expect(screen.getByRole('button', { name: /create lobby/i })).toBeInTheDocument();
    });

    it('renders the Private Room switch', () => {
      render(<GameSettings />);
      expect(screen.getByRole('switch', { name: /private room/i })).toBeInTheDocument();
    });

    it('renders the ThemeSettingsCard', () => {
      render(<GameSettings />);
      expect(screen.getByTestId('theme-settings-card')).toBeInTheDocument();
    });
  });

  describe('Form interactions', () => {
    it('allows updating the host name', async () => {
      render(<GameSettings />);
      const input = screen.getByLabelText(/host name/i) as HTMLInputElement;
      await userEvent.clear(input);
      await userEvent.type(input, 'StellarKing');
      expect(input.value).toBe('StellarKing');
    });

    it('shows validation error when player name is empty', async () => {
      render(<GameSettings />);
      const input = screen.getByLabelText(/host name/i);
      await userEvent.clear(input);
      const createBtn = screen.getByRole('button', { name: /create lobby/i });
      await userEvent.click(createBtn);
      await waitFor(() => {
        expect(screen.getByText(/player name is required/i)).toBeInTheDocument();
      });
    });

    it('shows loading state after clicking Create Lobby with valid data', async () => {
      render(<GameSettings />);
      const createBtn = screen.getByRole('button', { name: /create lobby/i });
      await userEvent.click(createBtn);
      expect(screen.getByText(/deploying room/i)).toBeInTheDocument();
    });

    it('toggles Private Room switch', async () => {
      render(<GameSettings />);
      const privateSwitch = screen.getByRole('switch', { name: /private room/i });
      expect(privateSwitch).not.toBeChecked();
      await userEvent.click(privateSwitch);
      expect(privateSwitch).toBeChecked();
    });

    it('toggles Free Game switch to hide stake options', async () => {
      render(<GameSettings />);
      expect(screen.getByText(/entry stake/i)).toBeInTheDocument();
      const freeSwitch = screen.getByRole('switch', { name: /free game/i });
      await userEvent.click(freeSwitch);
      await waitFor(() => {
        expect(screen.queryByText(/stake amount/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('navigates to game-waiting after successful lobby creation', async () => {
      vi.useFakeTimers();
      render(<GameSettings />);
      await userEvent.click(screen.getByRole('button', { name: /create lobby/i }));
      await vi.runAllTimersAsync();
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/\/game-waiting\?gameCode=/));
      });
      vi.useRealTimers();
    });
  });
});
