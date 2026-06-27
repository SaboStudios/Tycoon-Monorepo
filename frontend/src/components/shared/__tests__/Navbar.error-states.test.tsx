import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Navbar from '../Navbar';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/components/wallet/NearWalletConnect', () => ({
  NearWalletConnect: () => <div data-testid="wallet-connect" />,
}));
vi.mock('@/lib/nav-config', () => ({
  NAV_LINKS: [{ href: '/play', label: 'Play' }],
  isActivePath: () => false,
}));

const mockLogout = vi.fn();
let mockUser: { email: string } | null = null;

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: mockUser, logout: mockLogout }),
}));

describe('Navbar — empty/error states', () => {
  beforeEach(() => {
    mockUser = null;
    mockLogout.mockReset();
  });

  it('shows Login link when user is null (unauthenticated empty state)', () => {
    render(<Navbar />);
    expect(screen.getByRole('link', { name: /login/i })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
  });

  it('renders nav links even with empty user state', () => {
    render(<Navbar />);
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /play/i })).toBeInTheDocument();
  });

  it('shows Logout button and user email when user is authenticated', () => {
    mockUser = { email: 'test@tycoon.game' };
    render(<Navbar />);
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    expect(screen.getByText('test@tycoon.game')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /login/i })).not.toBeInTheDocument();
  });

  it('logout click does not propagate errors to the UI when logout throws', async () => {
    mockUser = { email: 'test@tycoon.game' };
    mockLogout.mockImplementation(() => {
      throw new Error('auth service error');
    });
    render(<Navbar />);
    const logoutBtn = screen.getByRole('button', { name: /logout/i });
    // Should not throw — the onClick wraps logout in try/catch
    await expect(userEvent.click(logoutBtn)).resolves.not.toThrow();
  });
});
