/**
 * Issue #772 — settings/ performance budget (CLS / LCP)
 *
 * Verifies that CLS-prone patterns are guarded:
 *  - Buttons with dynamic text carry a min-width so layout doesn't shift on
 *    state changes (idle → loading → success).
 *  - The SkeletonCard placeholder has an explicit height so content arriving
 *    later doesn't shift the page.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SkeletonCard } from '../SkeletonCard';
import { AccountSettings } from '../AccountSettings';
import { NotificationSettings } from '../NotificationSettings';

vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/ui/spinner', () => ({
  Spinner: () => <span data-testid="spinner" />,
}));

describe('settings/ — CLS / LCP performance budget (#772)', () => {
  describe('SkeletonCard', () => {
    it('renders with role="status" for screen-reader announcement', () => {
      render(<SkeletonCard />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('carries aria-busy="true" so assistive tech knows content is loading', () => {
      render(<SkeletonCard />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    });

    it('has an explicit height class on the inner placeholder to prevent layout shift', () => {
      const { container } = render(<SkeletonCard />);
      const placeholders = container.querySelectorAll('[class*="h-"]');
      expect(placeholders.length).toBeGreaterThan(0);
    });

    it('uses animate-pulse for a non-jarring loading indicator', () => {
      const { container } = render(<SkeletonCard />);
      expect(container.firstElementChild?.className).toContain('animate-pulse');
    });
  });

  describe('AccountSettings — button CLS prevention', () => {
    it('Update Email button has a min-w class to prevent width shift on loading', () => {
      render(<AccountSettings />);
      const btn = screen.getByRole('button', { name: /update email/i });
      expect(btn.className).toMatch(/min-w/);
    });

    it('Reset Password button is present and labelled', () => {
      render(<AccountSettings />);
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
    });
  });

  describe('NotificationSettings — button CLS prevention', () => {
    it('Save Preferences button has a min-w class to prevent width shift on loading', () => {
      render(<NotificationSettings />);
      const btn = screen.getByRole('button', { name: /save preferences/i });
      expect(btn.className).toMatch(/min-w/);
    });
  });
});
