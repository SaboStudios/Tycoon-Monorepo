import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Leaderboard } from './Leaderboard';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock toast
vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock Spinner
vi.mock('@/components/ui/spinner', () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

// Mock Card components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));

// Mock Button
vi.mock('@/components/ui/button', () => ({
  Button: ({ onClick, children, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

const mockLeaderboardData = {
  data: [
    {
      id: 1,
      username: 'Player1',
      game_won: 10,
      games_played: 15,
      total_earned: '1500.00',
    },
    {
      id: 2,
      username: 'Player2',
      game_won: 8,
      games_played: 12,
      total_earned: '1200.00',
    },
  ],
  meta: { totalPages: 1 },
};

describe('Leaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loading state', () => {
    it('renders spinner when loading', async () => {
      (global.fetch as any).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<Leaderboard />);
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders empty state when data is empty', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          meta: { totalPages: 1 },
        }),
      });

      render(<Leaderboard />);

      await waitFor(() => {
        expect(screen.getByTestId('leaderboard-empty')).toBeInTheDocument();
      });

      expect(screen.getByText('Leaderboard is empty.')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders error state when fetch fails', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(<Leaderboard />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load leaderboard')).toBeInTheDocument();
      });

      expect(screen.getByTestId('leaderboard-retry-button')).toBeInTheDocument();
    });

    it('displays error message from fetch failure', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Connection timeout'));

      render(<Leaderboard />);

      await waitFor(() => {
        expect(screen.getByText('Connection timeout')).toBeInTheDocument();
      });
    });

    it('retry button calls fetchLeaderboard when clicked', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(<Leaderboard />);

      await waitFor(() => {
        expect(screen.getByTestId('leaderboard-retry-button')).toBeInTheDocument();
      });

      // Reset the mock for the retry
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockLeaderboardData,
      });

      fireEvent.click(screen.getByTestId('leaderboard-retry-button'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2); // Initial + retry
      });
    });
  });

  describe('success state', () => {
    it('renders leaderboard with data', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockLeaderboardData,
      });

      render(<Leaderboard />);

      await waitFor(() => {
        expect(screen.getByText('Player1')).toBeInTheDocument();
        expect(screen.getByText('Player2')).toBeInTheDocument();
      });
    });

    it('displays player information correctly', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockLeaderboardData,
      });

      render(<Leaderboard />);

      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument(); // game_won
        expect(screen.getByText('8')).toBeInTheDocument();
      });
    });

    it('renders pagination buttons when totalPages > 1', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockLeaderboardData,
          meta: { totalPages: 3 },
        }),
      });

      render(<Leaderboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
      });
    });
  });

  describe('share profile', () => {
    it('opens share button for each player', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockLeaderboardData,
      });

      render(<Leaderboard />);

      await waitFor(() => {
        const shareButtons = screen.getAllByRole('button', { name: /share_profile/i });
        expect(shareButtons.length).toBeGreaterThan(0);
      });
    });
  });
});
