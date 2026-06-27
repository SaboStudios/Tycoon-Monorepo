import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NavbarErrorFallback } from '../NavbarErrorFallback';

describe('NavbarErrorFallback', () => {
  it('renders a banner landmark', () => {
    render(<NavbarErrorFallback />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('contains a home link with the brand name', () => {
    render(<NavbarErrorFallback />);
    const link = screen.getByRole('link', { name: /tycoon/i });
    expect(link).toHaveAttribute('href', '/');
  });

  it('has an accessible label indicating error state', () => {
    render(<NavbarErrorFallback />);
    expect(screen.getByRole('banner')).toHaveAttribute(
      'aria-label',
      'Site navigation (error state)',
    );
  });
});
