// ⬇ copy imports + beforeAll/afterAll app bootstrap from an existing e2e spec
describe('POST /games/:id/prize-claim', () => {
  // seed: finished game G with winner W (prize 1000), another user L, an unfinished game U

  it('concurrent duplicate claims -> exactly one grant, all return the same amount', async () => {
    const key = 'key-concurrent-0001';
    const res = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post(`/games/${G}/prize-claim`).set('Authorization', winnerToken).set('Idempotency-Key', key),
      ),
    );
    expect(res.every((r) => r.status === 200)).toBe(true);
    expect(res.filter((r) => r.body.status === 'claimed')).toHaveLength(1);
    expect(new Set(res.map((r) => r.body.amount))).toEqual(new Set(['1000']));
    // DB: exactly one claim row; winner balance credited exactly once
    expect(await claimRepo.count({ where: { gameId: G } })).toBe(1);
  });

  it('retry with a different key still returns the original claim (no double credit)', async () => { /* 2 sequential posts, different keys -> second is already_claimed, balance +1000 once */ });
  it('loser -> 403 NOT_WINNER, no claim row created', async () => { /* ... */ });
  it('unfinished game -> 409 GAME_NOT_FINISHED', async () => { /* ... */ });
  it('unknown game -> 404', async () => { /* ... */ });
  it('no token -> 401; expired token -> 401', async () => { /* ... */ });
  it('missing / malformed / oversized Idempotency-Key -> 400', async () => { /* '', 'short', 'x'.repeat(65), 'bad key!' */ });
  it('client-supplied amount in body/query is ignored', async () => { /* send {amount: 999999}; response amount is still 1000 */ });
  it('DB failure -> 503 and no claim row (fail closed)', async () => { /* mock repo.save to throw non-HttpException */ });
});