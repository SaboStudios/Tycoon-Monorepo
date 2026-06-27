import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WhatIsTycoon from '../WhatIsTycoon';

describe('WhatIsTycoon', () => {
  describe('renders without throwing with required props', () => {
    it('renders the section landmark', () => {
      render(<WhatIsTycoon />);
      expect(screen.getByRole('region', { name: /what is tycoon/i })).toBeInTheDocument();
    });

    it('renders the section without crashing', () => {
      expect(() => render(<WhatIsTycoon />)).not.toThrow();
    });
  });

  describe('renders the correct default state', () => {
    it('displays the heading "What is Tycoon"', () => {
      render(<WhatIsTycoon />);
      expect(screen.getByText('What is Tycoon')).toBeInTheDocument();
    });

    it('displays the description text', () => {
      render(<WhatIsTycoon />);
      expect(
        screen.getByText(
          /Tycoon is a fun digital board game where you collect tokens, trade with others, and complete challenges to win, all powered by blockchain/i
        )
      ).toBeInTheDocument();
    });

    it('renders both the heading and description in a flex layout', () => {
      const { container } = render(<WhatIsTycoon />);
      const flexContainer = container.querySelector('.flex-1');
      expect(flexContainer).toBeInTheDocument();
    });
  });

  describe('handles missing optional props gracefully without throwing', () => {
    it('does not require any props', () => {
      expect(() => render(<WhatIsTycoon />)).not.toThrow();
    });

    it('renders with default styling applied', () => {
      const { container } = render(<WhatIsTycoon />);
      const section = container.querySelector('section');
      expect(section).toHaveClass('w-full');
      expect(section).toHaveClass('relative');
    });
  });

  describe('SVG rendering', () => {
    it('renders an SVG element', () => {
      const { container } = render(<WhatIsTycoon />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('SVG has appropriate attributes for responsiveness', () => {
      const { container } = render(<WhatIsTycoon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox');
      expect(svg).toHaveAttribute('fill', 'none');
    });
  });

  describe('accessibility', () => {
    it('has appropriate aria-label for the section', () => {
      render(<WhatIsTycoon />);
      expect(screen.getByRole('region', { name: /what is tycoon/i })).toBeInTheDocument();
    });

    it('headings have proper styling', () => {
      const { container } = render(<WhatIsTycoon />);
      const heading = container.querySelector('h2');
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveClass('font-orbitron');
    });

    it('text content is readable', () => {
      render(<WhatIsTycoon />);
      const description = screen.getByText(
        /Tycoon is a fun digital board game/i
      );
      expect(description).toHaveClass('font-dmSans');
    });
  });

  describe('responsive design', () => {
    it('uses responsive sizing classes', () => {
      const { container } = render(<WhatIsTycoon />);
      const section = container.querySelector('section');
      expect(section?.className).toMatch(/lg:h-\[400px\]/);
      expect(section?.className).toMatch(/md:h-\[300px\]/);
    });

    it('has responsive padding', () => {
      const { container } = render(<WhatIsTycoon />);
      const section = container.querySelector('section');
      expect(section).toHaveClass('px-4');
    });
  });
});
