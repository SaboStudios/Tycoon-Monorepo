import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import HeroSectionMobile from '../HeroSectionMobile';

// Mock router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock telemetry hook
const mockTrackHeroViewed = vi.fn();
const mockTrackCtaClicked = vi.fn();
vi.mock('@/hooks/useHeroTelemetry', () => ({
  useHeroTelemetry: () => ({
    trackHeroViewed: mockTrackHeroViewed,
    trackCtaClicked: mockTrackCtaClicked,
  }),
}));

// Mock sanitizeError
vi.mock('@/lib/errors', () => ({
  sanitizeError: (err: any) => ({
    userMessage: err?.message || 'Something went wrong',
  }),
}));

describe('HeroSectionMobile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockReset();
    mockTrackHeroViewed.mockReset();
    mockTrackCtaClicked.mockReset();
  });

  describe('renders without throwing with required props', () => {
    it('renders without crashing', () => {
      expect(() => render(<HeroSectionMobile />)).not.toThrow();
    });

    it('renders the section landmark', () => {
      render(<HeroSectionMobile />);
      expect(screen.getByRole('region', { name: /hero/i })).toBeInTheDocument();
    });
  });

  describe('renders the correct default state', () => {
    it('displays the main title', () => {
      render(<HeroSectionMobile />);
      // The title is wrapped in an h1 and uses i18n key
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it('renders all four CTA buttons', () => {
      render(<HeroSectionMobile />);
      expect(screen.getByRole('button', { name: /continue game/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /multiplayer/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /join room/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /challenge ai/i })).toBeInTheDocument();
    });

    it('renders buttons with different styling', () => {
      render(<HeroSectionMobile />);
      const continueButton = screen.getByRole('button', { name: /continue game/i });
      const multiplayerButton = screen.getByRole('button', { name: /multiplayer/i });

      expect(continueButton).toBeInTheDocument();
      expect(multiplayerButton).toBeInTheDocument();
      // Buttons should have different classes
      expect(continueButton.className).not.toBe(multiplayerButton.className);
    });

    it('fires trackHeroViewed on mount', () => {
      render(<HeroSectionMobile />);
      expect(mockTrackHeroViewed).toHaveBeenCalledTimes(1);
    });

    it('does not render error alert on initial load', () => {
      render(<HeroSectionMobile />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('handles missing optional props gracefully without throwing', () => {
    it('renders without className prop', () => {
      expect(() => render(<HeroSectionMobile />)).not.toThrow();
    });

    it('applies default styling when className is undefined', () => {
      const { container } = render(<HeroSectionMobile />);
      const section = container.querySelector('section');
      expect(section).toHaveClass('bg-[#010F10]');
      expect(section).toHaveClass('z-0');
      expect(section).toHaveClass('w-full');
    });

    it('applies custom className when provided', () => {
      const { container } = render(<HeroSectionMobile className="custom-class" />);
      const section = container.querySelector('section');
      expect(section).toHaveClass('custom-class');
    });
  });

  describe('CTA button navigation', () => {
    it('Continue Game button navigates to /game-settings', () => {
      render(<HeroSectionMobile />);
      const continueButton = screen.getByRole('button', { name: /continue game/i });

      fireEvent.click(continueButton);

      expect(mockTrackCtaClicked).toHaveBeenCalledWith('continue_game', '/game-settings');
      expect(mockPush).toHaveBeenCalledWith('/game-settings');
    });

    it('Multiplayer button navigates to /game-settings', () => {
      render(<HeroSectionMobile />);
      const multiplayerButton = screen.getByRole('button', { name: /multiplayer/i });

      fireEvent.click(multiplayerButton);

      expect(mockTrackCtaClicked).toHaveBeenCalledWith('multiplayer', '/game-settings');
      expect(mockPush).toHaveBeenCalledWith('/game-settings');
    });

    it('Join Room button navigates to /join-room', () => {
      render(<HeroSectionMobile />);
      const joinButton = screen.getByRole('button', { name: /join room/i });

      fireEvent.click(joinButton);

      expect(mockTrackCtaClicked).toHaveBeenCalledWith('join_room', '/join-room');
      expect(mockPush).toHaveBeenCalledWith('/join-room');
    });

    it('Challenge AI button navigates to /play-ai', () => {
      render(<HeroSectionMobile />);
      const challengeButton = screen.getByRole('button', { name: /challenge ai/i });

      fireEvent.click(challengeButton);

      expect(mockTrackCtaClicked).toHaveBeenCalledWith('challenge_ai', '/play-ai');
      expect(mockPush).toHaveBeenCalledWith('/play-ai');
    });
  });

  describe('error state', () => {
    it('shows error alert when navigation throws', () => {
      mockPush.mockImplementation(() => {
        throw new Error('Navigation failed');
      });

      render(<HeroSectionMobile />);
      const continueButton = screen.getByRole('button', { name: /continue game/i });

      fireEvent.click(continueButton);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('error message is displayed', () => {
      mockPush.mockImplementation(() => {
        throw new Error('Navigation failed');
      });

      render(<HeroSectionMobile />);
      const continueButton = screen.getByRole('button', { name: /continue game/i });

      fireEvent.click(continueButton);

      expect(screen.getByText('Navigation failed')).toBeInTheDocument();
    });

    it('shows Try Again button in error state', () => {
      mockPush.mockImplementation(() => {
        throw new Error('Navigation failed');
      });

      render(<HeroSectionMobile />);
      const continueButton = screen.getByRole('button', { name: /continue game/i });

      fireEvent.click(continueButton);

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('clicking Try Again clears error state', async () => {
      mockPush.mockImplementation(() => {
        throw new Error('Navigation failed');
      });

      render(<HeroSectionMobile />);
      const continueButton = screen.getByRole('button', { name: /continue game/i });

      fireEvent.click(continueButton);

      expect(screen.getByRole('alert')).toBeInTheDocument();

      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(tryAgainButton);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    it('Try Again button re-fires trackHeroViewed', () => {
      mockPush.mockImplementation(() => {
        throw new Error('Navigation failed');
      });

      render(<HeroSectionMobile />);
      const continueButton = screen.getByRole('button', { name: /continue game/i });

      fireEvent.click(continueButton);

      const initialCalls = mockTrackHeroViewed.mock.calls.length;

      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(tryAgainButton);

      expect(mockTrackHeroViewed.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });

  describe('accessibility', () => {
    it('has appropriate section role and aria-label', () => {
      render(<HeroSectionMobile />);
      expect(screen.getByRole('region', { name: /hero/i })).toBeInTheDocument();
    });

    it('all buttons have aria-labels', () => {
      render(<HeroSectionMobile />);
      const continueButton = screen.getByRole('button', { name: /continue game/i });
      const multiplayerButton = screen.getByRole('button', { name: /multiplayer/i });

      expect(continueButton).toHaveAttribute('aria-label');
      expect(multiplayerButton).toHaveAttribute('aria-label');
    });

    it('buttons are keyboard accessible', () => {
      render(<HeroSectionMobile />);
      const continueButton = screen.getByRole('button', { name: /continue game/i });

      // Button should be focusable
      expect(continueButton).toBeInTheDocument();
      continueButton.focus();
      expect(document.activeElement).toBe(continueButton);
    });

    it('error alert has proper role when shown', () => {
      mockPush.mockImplementation(() => {
        throw new Error('Navigation failed');
      });

      render(<HeroSectionMobile />);
      const continueButton = screen.getByRole('button', { name: /continue game/i });

      fireEvent.click(continueButton);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('responsive design', () => {
    it('uses responsive sizing classes', () => {
      const { container } = render(<HeroSectionMobile />);
      const section = container.querySelector('section');
      expect(section?.className).toMatch(/min-h-\[calc\(100dvh-87px\)\]/);
    });

    it('applies responsive padding', () => {
      const { container } = render(<HeroSectionMobile />);
      const section = container.querySelector('section');
      expect(section).toHaveClass('px-4');
      expect(section).toHaveClass('py-8');
    });
  });

  describe('button styling', () => {
    it('buttons are touch-friendly with minimum height', () => {
      render(<HeroSectionMobile />);
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button.className).toMatch(/min-h-\[48px\]/);
        expect(button.className).toMatch(/min-w-\[48px\]/);
      });
    });

    it('buttons have hover and active states', () => {
      render(<HeroSectionMobile />);
      const continueButton = screen.getByRole('button', { name: /continue game/i });
      expect(continueButton.className).toContain('active:scale-95');
      expect(continueButton.className).toContain('transition-transform');
    });
  });
});
