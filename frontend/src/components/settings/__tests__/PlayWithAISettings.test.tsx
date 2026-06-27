import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PlayWithAISettings } from '../PlayWithAISettings';

const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/settings/ThemeSettingsCard', () => ({
  ThemeSettingsCard: () => <div data-testid="theme-settings-card" />,
}));

describe('PlayWithAISettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the AI Arena heading', () => {
      render(<PlayWithAISettings />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tycoon AI Arena');
    });

    it('renders the Tycoon Identity card', () => {
      render(<PlayWithAISettings />);
      expect(screen.getByText('Tycoon Identity')).toBeInTheDocument();
    });

    it('renders the player name input with a default value', () => {
      render(<PlayWithAISettings />);
      const input = screen.getByLabelText(/wallet \/ tycoon name/i) as HTMLInputElement;
      expect(input.value).toBe('Tycoon Player');
    });

    it('renders the Contract Settings card', () => {
      render(<PlayWithAISettings />);
      expect(screen.getByText('Contract Settings')).toBeInTheDocument();
    });

    it('renders the Initialize Session button', () => {
      render(<PlayWithAISettings />);
      expect(screen.getByRole('button', { name: /initialize session/i })).toBeInTheDocument();
    });

    it('renders the Governance Rules card', () => {
      render(<PlayWithAISettings />);
      expect(screen.getByText('Governance Rules')).toBeInTheDocument();
    });

    it('renders the ThemeSettingsCard', () => {
      render(<PlayWithAISettings />);
      expect(screen.getByTestId('theme-settings-card')).toBeInTheDocument();
    });

    it('renders the back button', () => {
      render(<PlayWithAISettings />);
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });
  });

  describe('Player name input', () => {
    it('allows updating the player name', async () => {
      render(<PlayWithAISettings />);
      const input = screen.getByLabelText(/wallet \/ tycoon name/i) as HTMLInputElement;
      await userEvent.clear(input);
      await userEvent.type(input, 'CryptoKing');
      expect(input.value).toBe('CryptoKing');
    });
  });

  describe('Start game flow', () => {
    it('shows loading state after clicking Initialize Session', async () => {
      render(<PlayWithAISettings />);
      const startBtn = screen.getByRole('button', { name: /initialize session/i });
      await userEvent.click(startBtn);
      expect(screen.getByText(/spinning up nodes/i)).toBeInTheDocument();
    });

    it('navigates to AI game route after session starts', async () => {
      vi.useFakeTimers();
      render(<PlayWithAISettings />);
      const startBtn = screen.getByRole('button', { name: /initialize session/i });
      await userEvent.click(startBtn);
      await vi.runAllTimersAsync();
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/\/ai-play\/game\//));
      });
      vi.useRealTimers();
    });
  });

  describe('Back navigation', () => {
    it('calls router.back() when back button is clicked', async () => {
      render(<PlayWithAISettings />);
      await userEvent.click(screen.getByRole('button', { name: /back/i }));
      expect(mockBack).toHaveBeenCalledOnce();
    });
  });

  describe('House rules toggles', () => {
    it('renders Asset Auctions switch checked by default', () => {
      render(<PlayWithAISettings />);
      const switches = screen.getAllByRole('switch');
      const auctionsSwitch = switches.find(
        (sw) => sw.id === 'auctions',
      );
      expect(auctionsSwitch).toBeChecked();
    });

    it('renders Free Parking Pool switch unchecked by default', () => {
      render(<PlayWithAISettings />);
      const parkingSwitch = screen.getByRole('switch', { name: '' });
      const switches = screen.getAllByRole('switch');
      // First switch is free parking, unchecked by default
      expect(switches[0]).not.toBeChecked();
    });
  });
});
