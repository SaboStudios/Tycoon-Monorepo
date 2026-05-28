import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import HeroSection from '../HeroSection';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockTrackHeroViewed = vi.fn();
const mockTrackCtaClicked = vi.fn();
vi.mock('@/hooks/useHeroTelemetry', () => ({
  useHeroTelemetry: () => ({
    trackHeroViewed: mockTrackHeroViewed,
    trackCtaClicked: mockTrackCtaClicked,
  }),
}));

vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

vi.mock('react-type-animation', () => ({
  TypeAnimation: ({ sequence }: { sequence: (string | number)[] }) => (
    <span>{sequence.find((s): s is string => typeof s === 'string')}</span>
  ),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('HeroSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockReset();
  });

  describe('normal render', () => {
    it('renders the hero section landmark', () => {
      render(<HeroSection />);
      expect(screen.getByRole('region', { name: /hero/i })).toBeDefined();
    });

    it('renders the main heading', () => {
      render(<HeroSection />);
      expect(screen.getByTestId('hero-main-title')).toBeDefined();
    });

    it('renders all four CTA buttons', () => {
      render(<HeroSection />);
      expect(screen.getByRole('button', { name: /continue game/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /multiplayer/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /join room/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /challenge ai/i })).toBeDefined();
    });

    it('fires trackHeroViewed on mount', () => {
      render(<HeroSection />);
      expect(mockTrackHeroViewed).toHaveBeenCalledTimes(1);
    });

    it('does not render the error alert on initial load', () => {
      render(<HeroSection />);
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('CTA navigation', () => {
    it('calls trackCtaClicked and router.push when Continue Game is clicked', () => {
      render(<HeroSection />);
      fireEvent.click(screen.getByRole('button', { name: /continue game/i }));
      expect(mockTrackCtaClicked).toHaveBeenCalledWith('continue_game', '/game-settings');
      expect(mockPush).toHaveBeenCalledWith('/game-settings');
    });

    it('calls trackCtaClicked and router.push when Multiplayer is clicked', () => {
      render(<HeroSection />);
      fireEvent.click(screen.getByRole('button', { name: /multiplayer/i }));
      expect(mockTrackCtaClicked).toHaveBeenCalledWith('multiplayer', '/game-settings');
      expect(mockPush).toHaveBeenCalledWith('/game-settings');
    });

    it('calls trackCtaClicked and router.push when Join Room is clicked', () => {
      render(<HeroSection />);
      fireEvent.click(screen.getByRole('button', { name: /join room/i }));
      expect(mockTrackCtaClicked).toHaveBeenCalledWith('join_room', '/join-room');
      expect(mockPush).toHaveBeenCalledWith('/join-room');
    });

    it('calls trackCtaClicked and router.push when Challenge AI is clicked', () => {
      render(<HeroSection />);
      fireEvent.click(screen.getByRole('button', { name: /challenge ai/i }));
      expect(mockTrackCtaClicked).toHaveBeenCalledWith('challenge_ai', '/play-ai');
      expect(mockPush).toHaveBeenCalledWith('/play-ai');
    });
  });

  describe('error state (null-guard)', () => {
    it('shows the error alert when navigation throws', () => {
      mockPush.mockImplementation(() => { throw new Error('Navigation failed'); });
      render(<HeroSection />);

      fireEvent.click(screen.getByRole('button', { name: /continue game/i }));

      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByRole('button', { name: /try again/i })).toBeDefined();
    });

    it('error message is always a non-empty string — never null or undefined', () => {
      mockPush.mockImplementation(() => { throw new Error('boom'); });
      render(<HeroSection />);

      fireEvent.click(screen.getByRole('button', { name: /continue game/i }));

      const alert = screen.getByRole('alert');
      // The second <p> inside the alert is the user-facing message
      const paragraphs = alert.querySelectorAll('p');
      expect(paragraphs.length).toBeGreaterThanOrEqual(2);
      expect(paragraphs[1]?.textContent?.trim().length).toBeGreaterThan(0);
    });

    it('clears the error and re-fires trackHeroViewed when Try Again is clicked', () => {
      mockPush.mockImplementationOnce(() => { throw new Error('fail'); });
      render(<HeroSection />);

      fireEvent.click(screen.getByRole('button', { name: /continue game/i }));
      expect(screen.getByRole('alert')).toBeDefined();

      const callsBefore = mockTrackHeroViewed.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));

      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByTestId('hero-main-title')).toBeDefined();
      expect(mockTrackHeroViewed.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  describe('className prop', () => {
    it('applies custom className to the section', () => {
      const { container } = render(<HeroSection className="custom-class" />);
      expect(container.querySelector('section')?.className).toContain('custom-class');
    });

    it('renders safely when className is undefined', () => {
      expect(() => render(<HeroSection />)).not.toThrow();
    });
  });
});
