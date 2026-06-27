import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import JoinOurCommunity from '../JoinOurCommunity';

describe('JoinOurCommunity', () => {
  describe('renders without throwing with required props', () => {
    it('renders the section landmark', () => {
      render(<JoinOurCommunity />);
      expect(screen.getByRole('region', { name: /join our community/i })).toBeInTheDocument();
    });

    it('renders without crashing', () => {
      expect(() => render(<JoinOurCommunity />)).not.toThrow();
    });
  });

  describe('renders the correct default state', () => {
    it('displays the heading "Join Our Community"', () => {
      render(<JoinOurCommunity />);
      expect(screen.getByText('Join Our Community')).toBeInTheDocument();
    });

    it('displays the community description', () => {
      render(<JoinOurCommunity />);
      expect(
        screen.getByText(
          /Join our community of players, builders, and dreamers shaping the future of gaming/i
        )
      ).toBeInTheDocument();
    });

    it('renders social media links', () => {
      render(<JoinOurCommunity />);
      expect(screen.getByRole('link', { name: /join our telegram community/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /follow us on x/i })).toBeInTheDocument();
    });
  });

  describe('handles missing optional props gracefully without throwing', () => {
    it('does not require any props', () => {
      expect(() => render(<JoinOurCommunity />)).not.toThrow();
    });

    it('renders with default styling applied', () => {
      const { container } = render(<JoinOurCommunity />);
      const section = container.querySelector('section');
      expect(section).toHaveClass('w-full');
    });
  });

  describe('social media links', () => {
    it('renders Telegram link with correct href', () => {
      render(<JoinOurCommunity />);
      const telegramLink = screen.getByRole('link', { name: /join our telegram community/i });
      expect(telegramLink).toHaveAttribute('href', 'https://t.me/+xJLEjw9tbyQwMGVk');
      expect(telegramLink).toHaveAttribute('target', '_blank');
      expect(telegramLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders X (Twitter) link with correct href', () => {
      render(<JoinOurCommunity />);
      const xLink = screen.getByRole('link', { name: /follow us on x/i });
      expect(xLink).toHaveAttribute('href', 'https://x.com/blockopoly1');
      expect(xLink).toHaveAttribute('target', '_blank');
      expect(xLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('links open in new tabs', () => {
      render(<JoinOurCommunity />);
      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).toHaveAttribute('target', '_blank');
      });
    });

    it('links have security attributes for external navigation', () => {
      render(<JoinOurCommunity />);
      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });
  });

  describe('link text and labels', () => {
    it('displays "Join our Telegram" text', () => {
      render(<JoinOurCommunity />);
      expect(screen.getByText('Join our Telegram')).toBeInTheDocument();
    });

    it('displays "Follow us on X" text', () => {
      render(<JoinOurCommunity />);
      expect(screen.getByText('Follow us on X')).toBeInTheDocument();
    });

    it('renders all text content without errors', () => {
      const { container } = render(<JoinOurCommunity />);
      expect(container.textContent).toContain('Join Our Community');
      expect(container.textContent).toContain('Join our Telegram');
      expect(container.textContent).toContain('Follow us on X');
    });
  });

  describe('accessibility', () => {
    it('has appropriate aria-label for the section', () => {
      render(<JoinOurCommunity />);
      expect(screen.getByRole('region', { name: /join our community/i })).toBeInTheDocument();
    });

    it('social media links have aria-labels', () => {
      render(<JoinOurCommunity />);
      const telegramLink = screen.getByRole('link', { name: /join our telegram community/i });
      const xLink = screen.getByRole('link', { name: /follow us on x/i });

      expect(telegramLink).toHaveAttribute('aria-label');
      expect(xLink).toHaveAttribute('aria-label');
    });

    it('has semantic heading', () => {
      const { container } = render(<JoinOurCommunity />);
      const heading = container.querySelector('h2');
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveClass('font-orbitron');
    });

    it('has semantic paragraph', () => {
      const { container } = render(<JoinOurCommunity />);
      const paragraphs = container.querySelectorAll('p');
      expect(paragraphs.length).toBeGreaterThan(0);
    });
  });

  describe('styling and layout', () => {
    it('uses flexbox for layout', () => {
      const { container } = render(<JoinOurCommunity />);
      const section = container.querySelector('section');
      expect(section).toHaveClass('flex');
      expect(section).toHaveClass('flex-col');
    });

    it('uses responsive spacing', () => {
      const { container } = render(<JoinOurCommunity />);
      const section = container.querySelector('section');
      expect(section?.className).toMatch(/py-/);
      expect(section?.className).toMatch(/px-/);
    });

    it('uses Tycoon design colors', () => {
      const { container } = render(<JoinOurCommunity />);
      const heading = container.querySelector('h2');
      expect(heading).toHaveClass('text-[#F0F7F7]');
    });
  });

  describe('SVG rendering', () => {
    it('renders SVG elements for button backgrounds', () => {
      const { container } = render(<JoinOurCommunity />);
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });

    it('SVGs are marked as decorative with aria-hidden', () => {
      const { container } = render(<JoinOurCommunity />);
      const decorativeSvgs = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(decorativeSvgs.length).toBeGreaterThan(0);
    });
  });

  describe('primary user interaction', () => {
    it('links are clickable', () => {
      render(<JoinOurCommunity />);
      const links = screen.getAllByRole('link');
      expect(links.length).toBe(2);
      links.forEach((link) => {
        expect(link).toHaveAttribute('href');
      });
    });

    it('clicking links should navigate to social media', () => {
      render(<JoinOurCommunity />);
      const telegramLink = screen.getByRole('link', { name: /join our telegram community/i });
      const xLink = screen.getByRole('link', { name: /follow us on x/i });

      expect(telegramLink.getAttribute('href')).toContain('t.me');
      expect(xLink.getAttribute('href')).toContain('x.com');
    });
  });
});
