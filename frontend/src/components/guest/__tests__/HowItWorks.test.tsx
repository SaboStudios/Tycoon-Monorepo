import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import HowItWorks from '../HowItWorks';

// Mock swiper and its modules
vi.mock('swiper/react', () => ({
  Swiper: ({ children, onSlideChange, onSwiper }: any) => {
    const mockSwiper = {
      slideTo: vi.fn(),
      realIndex: 0,
    };
    // Simulate swiper initialization
    onSwiper?.(mockSwiper);
    return <div data-testid="swiper-mock">{children}</div>;
  },
  SwiperSlide: ({ children }: any) => (
    <div data-testid="swiper-slide">{children}</div>
  ),
}));

vi.mock('swiper/modules', () => ({
  Pagination: {},
  Autoplay: {},
}));

// Mock useReducedMotion hook
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

describe('HowItWorks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renders without throwing with required props', () => {
    it('renders the section landmark', () => {
      render(<HowItWorks />);
      expect(screen.getByRole('region', { name: /how it works carousel/i })).toBeInTheDocument();
    });

    it('renders without crashing', () => {
      expect(() => render(<HowItWorks />)).not.toThrow();
    });
  });

  describe('renders the correct default state', () => {
    it('displays the heading "How it works"', () => {
      render(<HowItWorks />);
      expect(screen.getByText('How it works')).toBeInTheDocument();
    });

    it('displays the description text', () => {
      render(<HowItWorks />);
      expect(
        screen.getByText(
          /It's super simple how Tycoon works/i
        )
      ).toBeInTheDocument();
    });

    it('renders all four carousel slides', () => {
      render(<HowItWorks />);
      const slides = screen.getAllByTestId('swiper-slide');
      expect(slides.length).toBeGreaterThanOrEqual(4);
    });

    it('displays the first slide by default', () => {
      render(<HowItWorks />);
      expect(screen.getByText('Connect & Play')).toBeInTheDocument();
    });
  });

  describe('handles missing optional props gracefully without throwing', () => {
    it('does not require any props', () => {
      expect(() => render(<HowItWorks />)).not.toThrow();
    });

    it('renders with default styling applied', () => {
      const { container } = render(<HowItWorks />);
      const section = container.querySelector('section');
      expect(section).toHaveClass('relative');
      expect(section).toHaveClass('w-full');
    });
  });

  describe('carousel functionality', () => {
    it('renders slide content with icons', () => {
      render(<HowItWorks />);
      // First slide has icon for "Connect & Play"
      expect(screen.getByText('Connect & Play')).toBeInTheDocument();
    });

    it('renders all slide titles', () => {
      render(<HowItWorks />);
      expect(screen.getByText('Connect & Play')).toBeInTheDocument();
      expect(screen.getByText('Let the Games Begin')).toBeInTheDocument();
      expect(screen.getByText('Think Smart, Play Hard')).toBeInTheDocument();
      expect(screen.getByText('Rise to the Top')).toBeInTheDocument();
    });

    it('renders slide descriptions', () => {
      render(<HowItWorks />);
      expect(
        screen.getByText(/Connect your Web3 wallet to start playing/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Once you're in, join a game/i)
      ).toBeInTheDocument();
    });

    it('renders navigation dots', () => {
      render(<HowItWorks />);
      const tablist = screen.getByRole('tablist', { name: /slide selection/i });
      expect(tablist).toBeInTheDocument();
    });

    it('renders exactly 4 navigation dots', () => {
      render(<HowItWorks />);
      const dots = screen.getAllByRole('tab', { name: /go to slide/i });
      expect(dots).toHaveLength(4);
    });
  });

  describe('navigation with dots', () => {
    it('dot buttons are clickable', () => {
      render(<HowItWorks />);
      const dots = screen.getAllByRole('tab', { name: /go to slide/i });
      expect(dots[0]).toBeInTheDocument();
      expect(dots[1]).toBeInTheDocument();
    });

    it('first dot is selected by default', () => {
      render(<HowItWorks />);
      const dots = screen.getAllByRole('tab', { name: /go to slide/i });
      expect(dots[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('clicking a dot updates aria-selected state', () => {
      render(<HowItWorks />);
      const dots = screen.getAllByRole('tab', { name: /go to slide/i });
      fireEvent.click(dots[1]);
      // After clicking dot 2, it should have aria-selected=true
      expect(dots[1]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('accessibility', () => {
    it('has appropriate role and aria-label for the section', () => {
      render(<HowItWorks />);
      expect(screen.getByRole('region', { name: /how it works carousel/i })).toBeInTheDocument();
    });

    it('has a live region that announces slide changes', () => {
      render(<HowItWorks />);
      expect(screen.getByTestId('carousel-live-region')).toBeInTheDocument();
    });

    it('live region has appropriate role and aria attributes', () => {
      render(<HowItWorks />);
      const liveRegion = screen.getByTestId('carousel-live-region');
      expect(liveRegion).toHaveAttribute('role', 'status');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    });

    it('navigation dots have proper tab role and labels', () => {
      render(<HowItWorks />);
      const dots = screen.getAllByRole('tab');
      dots.forEach((dot, index) => {
        expect(dot).toHaveAttribute('aria-label', `Go to slide ${index + 1}`);
      });
    });

    it('has accessible heading', () => {
      const { container } = render(<HowItWorks />);
      const heading = container.querySelector('h2');
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveClass('font-orbitron');
    });
  });

  describe('responsive design', () => {
    it('uses responsive sizing classes', () => {
      const { container } = render(<HowItWorks />);
      const section = container.querySelector('section');
      expect(section?.className).toMatch(/h-\[856px\]/);
    });

    it('has responsive padding', () => {
      const { container } = render(<HowItWorks />);
      const section = container.querySelector('section');
      expect(section).toHaveClass('flex');
      expect(section).toHaveClass('flex-col');
      expect(section).toHaveClass('items-center');
      expect(section).toHaveClass('justify-center');
    });
  });

  describe('background gradients', () => {
    it('renders background gradient containers', () => {
      const { container } = render(<HowItWorks />);
      const gradients = container.querySelectorAll('[style*="background"]');
      expect(gradients.length).toBeGreaterThan(0);
    });
  });
});
