import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FooterErrorFallback } from '../FooterErrorFallback';

describe('FooterErrorFallback', () => {
  it('renders a contentinfo landmark', () => {
    render(<FooterErrorFallback />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('has an accessible label indicating error state', () => {
    render(<FooterErrorFallback />);
    expect(screen.getByRole('contentinfo')).toHaveAttribute(
      'aria-label',
      'Site footer (error state)',
    );
  });

  it('shows the copyright year', () => {
    render(<FooterErrorFallback />);
    expect(
      screen.getByText(new RegExp(String(new Date().getFullYear()))),
    ).toBeInTheDocument();
  });
});
