import { renderHook, act } from '@testing-library/react';
import { useClaimPrize } from './useClaimPrize';

const ok = (body: any, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);

describe('useClaimPrize', () => {
  beforeEach(() => { global.fetch = jest.fn(); });

  it('renders the server amount on success', async () => {
    (fetch as jest.Mock).mockReturnValue(ok({ status: 'claimed', amount: '1000' }));
    const { result } = renderHook(() => useClaimPrize(1));
    await act(async () => { await result.current.claim(); });
    expect(result.current.state).toEqual({ phase: 'claimed', amount: '1000', replay: false });
  });

  it('already_claimed is a success state', async () => {
    (fetch as jest.Mock).mockReturnValue(ok({ status: 'already_claimed', amount: '1000' }));
    const { result } = renderHook(() => useClaimPrize(1));
    await act(async () => { await result.current.claim(); });
    expect(result.current.state).toMatchObject({ phase: 'claimed', replay: true });
  });

  it('double click sends one request', async () => {
    (fetch as jest.Mock).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useClaimPrize(1));
    act(() => { result.current.claim(); result.current.claim(); });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retry after a network failure reuses the same Idempotency-Key', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('net')).mockReturnValueOnce(ok({ status: 'claimed', amount: '1' }));
    const { result } = renderHook(() => useClaimPrize(1));
    await act(async () => { await result.current.claim(); });
    expect(result.current.state).toMatchObject({ phase: 'error', retryable: true });
    await act(async () => { await result.current.claim(); });
    const keys = (fetch as jest.Mock).mock.calls.map((c) => c[1].headers['Idempotency-Key']);
    expect(keys[0]).toBe(keys[1]);
  });

  it.each([[403, 'forbidden', false], [409, 'not_finished', false], [404, 'not_found', false], [429, 'rate_limited', true], [500, 'unavailable', true]])(
    'maps HTTP %i to %s', async (status, code, retryable) => {
      (fetch as jest.Mock).mockReturnValue(ok({}, status));
      const { result } = renderHook(() => useClaimPrize(1));
      await act(async () => { await result.current.claim(); });
      expect(result.current.state).toEqual({ phase: 'error', code, retryable });
    });
}); 