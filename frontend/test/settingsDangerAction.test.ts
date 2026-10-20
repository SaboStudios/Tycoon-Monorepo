import { performDangerAction } from '../app/settings/page';

describe('performDangerAction', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('resolves when the response is ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    await expect(performDangerAction('reset-progress')).resolves.toBeUndefined();
  });

  it('uses the JSON error message when the body is valid JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ message: 'Cannot reset right now.' }),
    }) as unknown as typeof fetch;

    await expect(performDangerAction('reset-progress')).rejects.toThrow(
      'Cannot reset right now.',
    );
  });

  it('falls back to a status-derived message when the error body is not JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    }) as unknown as typeof fetch;

    await expect(performDangerAction('delete-account')).rejects.toThrow(
      /500/,
    );
  });
});
