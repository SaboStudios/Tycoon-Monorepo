import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  NearWalletNotInstalledError,
  NearWalletProvider,
  NearWalletRejectedError,
  useNearWallet,
} from '@/components/providers/near-wallet-provider';

const signAndSendTransaction = vi.fn();
const signOut = vi.fn().mockResolvedValue(undefined);
const walletMock = { signAndSendTransaction, signOut };

let selectorWallet = vi.fn().mockResolvedValue(walletMock);
let storeState: { accounts: Array<{ accountId: string }> } = { accounts: [] };
const subscribers: Array<(state: typeof storeState) => void> = [];

vi.mock('@near-wallet-selector/core', () => ({
  setupWalletSelector: vi.fn().mockImplementation(async () => ({
    wallet: (...args: unknown[]) => selectorWallet(...args),
    store: {
      getState: () => storeState,
      observable: {
        subscribe: (cb: (state: typeof storeState) => void) => {
          subscribers.push(cb);
          return { unsubscribe: () => undefined };
        },
      },
    },
  })),
}));

vi.mock('@near-wallet-selector/modal-ui', () => ({
  setupModal: vi.fn().mockReturnValue({ show: vi.fn() }),
}));

vi.mock('@near-wallet-selector/my-near-wallet', () => ({
  setupMyNearWallet: vi.fn().mockReturnValue({}),
}));

function Harness({ onReady }: { onReady: (value: ReturnType<typeof useNearWallet>) => void }) {
  const value = useNearWallet();
  onReady(value);
  return null;
}

async function renderProvider() {
  let latest: ReturnType<typeof useNearWallet> | null = null;
  render(
    <NearWalletProvider>
      <Harness
        onReady={(value) => {
          latest = value;
        }}
      />
    </NearWalletProvider>,
  );
  await waitFor(() => expect(latest?.ready).toBe(true));
  return () => {
    if (!latest) throw new Error('provider value not ready');
    return latest;
  };
}

describe('NearWalletProvider', () => {
  beforeEach(() => {
    signAndSendTransaction.mockReset();
    signOut.mockClear();
    selectorWallet = vi.fn().mockResolvedValue(walletMock);
    storeState = { accounts: [] };
    subscribers.length = 0;
  });

  it('resolves callContractMethod and records a confirmed transaction', async () => {
    signAndSendTransaction.mockResolvedValue({
      transaction: { hash: 'ABC123' },
      status: { SuccessValue: '' },
    });
    const getValue = await renderProvider();

    let record;
    await act(async () => {
      record = await getValue().callContractMethod('addMessage', { text: 'hi' });
    });

    expect(record).toMatchObject({ phase: 'confirmed', methodName: 'addMessage' });
    expect(getValue().transactions).toHaveLength(1);
    expect(getValue().transactions[0].phase).toBe('confirmed');
  });

  it('maps a user rejection to NearWalletRejectedError, distinct from a missing wallet', async () => {
    signAndSendTransaction.mockRejectedValue(new Error('User rejected the request'));
    const getValue = await renderProvider();

    await expect(
      act(async () => {
        await getValue().callContractMethod('addMessage');
      }),
    ).rejects.toBeInstanceOf(NearWalletRejectedError);

    expect(getValue().transactions[0].phase).toBe('failed');
  });

  it('maps a missing wallet to NearWalletNotInstalledError, not a rejection', async () => {
    selectorWallet = vi.fn().mockRejectedValue(new Error('No wallet selected'));
    const getValue = await renderProvider();

    await expect(
      act(async () => {
        await getValue().callContractMethod('addMessage');
      }),
    ).rejects.toBeInstanceOf(NearWalletNotInstalledError);

    expect(getValue().transactions[0].phase).toBe('failed');
  });

  it('clearTransactions empties the transaction list', async () => {
    signAndSendTransaction.mockResolvedValue({
      transaction: { hash: 'ABC123' },
      status: { SuccessValue: '' },
    });
    const getValue = await renderProvider();

    await act(async () => {
      await getValue().callContractMethod('addMessage');
    });
    expect(getValue().transactions).toHaveLength(1);

    act(() => {
      getValue().clearTransactions();
    });
    expect(getValue().transactions).toHaveLength(0);
  });

  it('only displays the latest transaction', async () => {
    signAndSendTransaction
      .mockResolvedValueOnce({ transaction: { hash: 'ONE' }, status: { SuccessValue: '' } })
      .mockResolvedValueOnce({ transaction: { hash: 'TWO' }, status: { SuccessValue: '' } });
    const getValue = await renderProvider();

    await act(async () => {
      await getValue().callContractMethod('addMessage');
    });
    await act(async () => {
      await getValue().callContractMethod('addMessage');
    });

    expect(getValue().transactions).toHaveLength(1);
    expect(getValue().transactions[0].hash).toBe('TWO');
  });

  it('throws when used outside the provider', () => {
    function Bomb() {
      useNearWallet();
      return null;
    }
    expect(() => render(<Bomb />)).toThrow('useNearWallet must be used within NearWalletProvider');
  });
});
