/**
 * SW-BE-014: Games & matchmaking — pagination and stable sorting
 *
 * Validates that GetGamesDto and GetGamePlayersDto enforce their sortBy
 * allowlists, rejecting arbitrary column names that could be used to probe
 * schema or cause unexpected query behaviour.
 */

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GetGamesDto, GameSortField } from './get-games.dto';
import { GetGamePlayersDto, GamePlayerSortField } from './get-game-players.dto';

async function getErrors(DtoClass: new () => object, plain: object) {
  const instance = plainToInstance(DtoClass as new () => object, plain);
  const errors = await validate(instance as object);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

// ---------------------------------------------------------------------------
// GetGamesDto — sortBy allowlist
// ---------------------------------------------------------------------------

describe('GetGamesDto sortBy allowlist (SW-BE-014)', () => {
  it('accepts every valid GameSortField value', async () => {
    for (const field of Object.values(GameSortField)) {
      const errors = await getErrors(GetGamesDto, { sortBy: field });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an arbitrary column name', async () => {
    const errors = await getErrors(GetGamesDto, { sortBy: 'password' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a SQL-injection-style value', async () => {
    const errors = await getErrors(GetGamesDto, {
      sortBy: '1; DROP TABLE games--',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('defaults sortBy to created_at when omitted', () => {
    const dto = plainToInstance(GetGamesDto, {});
    expect(dto.sortBy).toBe(GameSortField.CREATED_AT);
  });

  it('passes with no sortBy (omitted)', async () => {
    const errors = await getErrors(GetGamesDto, {});
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// GetGamePlayersDto — sortBy allowlist
// ---------------------------------------------------------------------------

describe('GetGamePlayersDto sortBy allowlist (SW-BE-014)', () => {
  it('accepts every valid GamePlayerSortField value', async () => {
    for (const field of Object.values(GamePlayerSortField)) {
      const errors = await getErrors(GetGamePlayersDto, { sortBy: field });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an arbitrary column name', async () => {
    const errors = await getErrors(GetGamePlayersDto, { sortBy: 'password' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('defaults sortBy to turn_order when omitted', () => {
    const dto = plainToInstance(GetGamePlayersDto, {});
    expect(dto.sortBy).toBe(GamePlayerSortField.TURN_ORDER);
  });

  it('passes with no sortBy (omitted)', async () => {
    const errors = await getErrors(GetGamePlayersDto, {});
    expect(errors).toHaveLength(0);
  });
});
