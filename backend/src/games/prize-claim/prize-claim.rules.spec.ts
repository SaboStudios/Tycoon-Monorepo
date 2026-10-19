import { decideClaim, FINISHED_STATUS } from './prize-claim.rules';

const game = (o: Partial<any> = {}) => ({
  status: FINISHED_STATUS, winnerId: 7, prizeAmount: '1000', ...o,
});
const claim = { amount: '1000', claimedAt: new Date('2026-01-01T00:00:00Z') };

describe('decideClaim', () => {
  const cases: Array<[string, any, any]> = [
    ['winner, finished, unclaimed -> grant', { game: game(), userId: 7, existing: null }, { kind: 'grant', amount: '1000' }],
    ['winner repeats claim -> replay', { game: game(), userId: 7, existing: claim }, { kind: 'replay', claim }],
    ['non-winner -> NOT_WINNER', { game: game(), userId: 8, existing: null }, { kind: 'reject', code: 'NOT_WINNER' }],
    ['non-winner with existing claim -> NOT_WINNER (no leak)', { game: game(), userId: 8, existing: claim }, { kind: 'reject', code: 'NOT_WINNER' }],
    ['game in progress -> GAME_NOT_FINISHED', { game: game({ status: 'IN_PROGRESS' }), userId: 7, existing: null }, { kind: 'reject', code: 'GAME_NOT_FINISHED' }],
    ['no winner yet -> NOT_WINNER', { game: game({ winnerId: null }), userId: 7, existing: null }, { kind: 'reject', code: 'NOT_WINNER' }],
    ['null prize -> NO_PRIZE', { game: game({ prizeAmount: null }), userId: 7, existing: null }, { kind: 'reject', code: 'NO_PRIZE' }],
    ['zero prize -> NO_PRIZE (boundary)', { game: game({ prizeAmount: '0' }), userId: 7, existing: null }, { kind: 'reject', code: 'NO_PRIZE' }],
    ['negative prize -> NO_PRIZE', { game: game({ prizeAmount: '-5' }), userId: 7, existing: null }, { kind: 'reject', code: 'NO_PRIZE' }],
    ['non-numeric prize -> NO_PRIZE', { game: game({ prizeAmount: '1e9' }), userId: 7, existing: null }, { kind: 'reject', code: 'NO_PRIZE' }],
    ['minimum prize 1 -> grant (boundary)', { game: game({ prizeAmount: '1' }), userId: 7, existing: null }, { kind: 'grant', amount: '1' }],
    ['string/number id mismatch handled', { game: game({ winnerId: '7' }), userId: 7, existing: null }, { kind: 'grant', amount: '1000' }],
  ];
  it.each(cases)('%s', (_n, input, expected) => {
    expect(decideClaim(input)).toEqual(expected);
  });
});