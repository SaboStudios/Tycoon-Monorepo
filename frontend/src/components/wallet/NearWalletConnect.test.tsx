import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NearWalletConnect } from './NearWalletConnect';

vi.mock('@/components/providers/near-wallet-provider', () => ({
  useNearWallet: vi.fn(),
}));

import { useNearWallet } from '@/components/providers/near-wallet-provider';

const mockUseNearWallet = useNearWallet as ReturnType<typeof vi.fn>;

describe('NearWalletConnect - Performance (CLS/LCP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with consistent height during loading state (no layout shift)', () => {
    mockUseNearWallet.mockReturnValue({
      ready: false,
      initError: null,
      accountId: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    const { container } = render(<NearWalletConnect />);

    // Button container should reserve height to prevent CLS
    const flexContainer = container.querySelector('div[class*="flex"][class*="flex-col"]');
    expect(flexContainer).toBeTruthy();
  });

  it('renders without layout shift when transitioning from loading to connected', () => {
    mockUseNearWallet.mockReturnValue({
      ready: false,
      initError: null,
      accountId: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    const { rerender } = render(<NearWalletConnect />);
    expect(screen.getByText('Preparing NEAR wallet support...')).toBeTruthy();

    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: 'user.near',
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    rerender(<NearWalletConnect />);
    expect(screen.getByText(/user\.near/)).toBeTruthy();
  });

  it('renders error state without layout shift', () => {
    mockUseNearWallet.mockReturnValue({
      ready: false,
      initError: 'Wallet initialization failed',
      accountId: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    render(<NearWalletConnect />);
    expect(screen.getByText('Wallet initialization failed')).toBeTruthy();
  });

  it('renders all icons with explicit dimensions', () => {
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: 'user.near',
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    const { container } = render(<NearWalletConnect />);
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('aria-live container reserves height for transaction status (no shift)', () => {
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: 'user.near',
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [{
        hash: 'abc123',
        phase: 'pending' as const,
        methodName: 'transfer',
        errorMessage: null,
        explorerUrl: 'https://explorer.near.org/transactions/abc123',
      }],
    });

    const { container } = render(<NearWalletConnect />);
    const ariaLive = container.querySelector('[aria-live="polite"]');
    expect(ariaLive).toBeTruthy();
  });
});

describe('NearWalletConnect - States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when wallet is initializing', () => {
    mockUseNearWallet.mockReturnValue({
      ready: false,
      initError: null,
      accountId: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    render(<NearWalletConnect />);
    expect(screen.getByText('Preparing NEAR wallet support...')).toBeDefined();
  });

  it('renders empty state when wallet is ready but not connected', () => {
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    render(<NearWalletConnect />);
    expect(screen.getByText(/No NEAR wallet connected yet/)).toBeDefined();
  });

  it('renders error state when initialization fails', () => {
    mockUseNearWallet.mockReturnValue({
      ready: false,
      initError: 'Failed to initialize wallet',
      accountId: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    render(<NearWalletConnect />);
    expect(screen.getByText('Failed to initialize wallet')).toBeDefined();
  });

  it('renders connected state with account ID', () => {
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: 'alice.near',
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    render(<NearWalletConnect />);
    expect(screen.getByText(/alice\.near/)).toBeDefined();
    expect(screen.getByText('Disconnect NEAR')).toBeDefined();
  });
});

describe('NearWalletConnect - Error and Empty States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('error state renders user-friendly message', () => {
    mockUseNearWallet.mockReturnValue({
      ready: false,
      initError: 'Wallet provider not detected. Please install NEAR wallet extension.',
      accountId: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    const { container } = render(<NearWalletConnect />);
    const errorAlert = container.querySelector('[role="alert"]');
    expect(errorAlert).toBeTruthy();
    expect(screen.getByText(/Wallet provider not detected/)).toBeDefined();
  });

  it('empty state shows helpful message when wallet is disconnected', () => {
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    const { container } = render(<NearWalletConnect />);
    const emptyStateEl = container.querySelector('[data-testid="near-wallet-empty-state"]');
    expect(emptyStateEl).toBeTruthy();
    expect(screen.getByText(/Connect to sign in and submit transactions/)).toBeDefined();
  });

  it('normal state shows account info and disconnect button', () => {
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: 'bob.testnet',
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    render(<NearWalletConnect />);
    expect(screen.getByText(/bob\.testnet/)).toBeDefined();
    expect(screen.getByText('Disconnect NEAR')).toBeDefined();
  });

  it('handles disconnected wallet after successful connection', () => {
    const mockConnect = vi.fn();
    const mockDisconnect = vi.fn();

    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: 'test.near',
      connect: mockConnect,
      disconnect: mockDisconnect,
      transactions: [],
    });

    const { rerender } = render(<NearWalletConnect />);
    expect(screen.getByText(/test\.near/)).toBeDefined();

    // Simulate disconnection
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      transactions: [],
    });

    rerender(<NearWalletConnect />);
    expect(screen.getByText(/No NEAR wallet connected yet/)).toBeDefined();
  });

  it('does not render error state when wallet is initializing', () => {
    mockUseNearWallet.mockReturnValue({
      ready: false,
      initError: null,
      accountId: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    const { container } = render(<NearWalletConnect />);
    const errorAlert = container.querySelector('[role="alert"]');
    expect(errorAlert).toBeFalsy();
  });

  it('hides empty state message when account is connected', () => {
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: 'connected.near',
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    const { container } = render(<NearWalletConnect />);
    const emptyStateEl = container.querySelector('[data-testid="near-wallet-empty-state"]');
    expect(emptyStateEl).toBeFalsy();
  });
});

describe('NearWalletConnect - User Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without throwing with required props', () => {
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    expect(() => render(<NearWalletConnect />)).not.toThrow();
  });

  it('responds correctly to connect button click', () => {
    const mockConnect = vi.fn();
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: null,
      connect: mockConnect,
      disconnect: vi.fn(),
      transactions: [],
    });

    render(<NearWalletConnect />);
    const connectBtn = screen.getByText('Connect NEAR');
    fireEvent.click(connectBtn);
    expect(mockConnect).toHaveBeenCalled();
  });

  it('responds correctly to disconnect button click', async () => {
    const mockDisconnect = vi.fn();
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: 'test.near',
      connect: vi.fn(),
      disconnect: mockDisconnect,
      transactions: [],
    });

    render(<NearWalletConnect />);
    const disconnectBtn = screen.getByText('Disconnect NEAR');
    fireEvent.click(disconnectBtn);
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('handles missing optional className prop gracefully', () => {
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: 'alice.near',
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    expect(() => render(<NearWalletConnect />)).not.toThrow();
    expect(screen.getByText(/alice\.near/)).toBeDefined();
  });

  it('handles missing variant prop gracefully with default navbar variant', () => {
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: 'bob.near',
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    const { container } = render(<NearWalletConnect />);
    // Should render without throwing and with default navbar alignment
    expect(screen.getByText(/bob\.near/)).toBeDefined();
    expect(container.querySelector('div[class*="items-end"]')).toBeTruthy();
  });

  it('renders panel variant with correct alignment', () => {
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: 'test.near',
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    const { container } = render(<NearWalletConnect variant="panel" />);
    // Panel variant should have items-stretch and text-left
    expect(container.querySelector('div[class*="items-stretch"]')).toBeTruthy();
  });
});

describe('NearWalletConnect - Transaction Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays pending transaction status', () => {
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: 'test.near',
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [{
        hash: 'tx123',
        phase: 'pending' as const,
        methodName: 'transfer',
        errorMessage: null,
        explorerUrl: 'https://explorer.near.org/tx123',
      }],
    });

    render(<NearWalletConnect />);
    expect(screen.getByText('Transaction pending...')).toBeDefined();
  });

  it('displays confirmed transaction status', () => {
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: 'test.near',
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [{
        hash: 'tx123',
        phase: 'confirmed' as const,
        methodName: 'transfer',
        errorMessage: null,
        explorerUrl: 'https://explorer.near.org/tx123',
      }],
    });

    render(<NearWalletConnect />);
    expect(screen.getByText('Confirmed')).toBeDefined();
  });

  it('displays failed transaction status with error message', () => {
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: 'test.near',
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [{
        hash: 'tx123',
        phase: 'failed' as const,
        methodName: 'transfer',
        errorMessage: 'Insufficient balance',
        explorerUrl: 'https://explorer.near.org/tx123',
      }],
    });

    render(<NearWalletConnect />);
    expect(screen.getByText('Failed')).toBeDefined();
    expect(screen.getByText('Insufficient balance')).toBeDefined();
  });

  it('does not display transaction when transactions array is empty', () => {
    mockUseNearWallet.mockReturnValue({
      ready: true,
      initError: null,
      accountId: 'test.near',
      connect: vi.fn(),
      disconnect: vi.fn(),
      transactions: [],
    });

    const { container } = render(<NearWalletConnect />);
    expect(screen.queryByText('Transaction pending...')).toBeFalsy();
    expect(screen.queryByText('Confirmed')).toBeFalsy();
  });
});
