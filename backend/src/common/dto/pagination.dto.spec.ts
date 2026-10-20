import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaginationDto, SortOrder, PAGINATION_MAX_LIMIT } from './pagination.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(PaginationDto, plain);
  return validate(dto);
}

describe('PaginationDto', () => {
  it('passes with valid defaults', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('passes with explicit valid values', async () => {
    const errors = await validateDto({
      page: 2,
      limit: 25,
      sortBy: 'created_at',
      sortOrder: 'DESC',
      search: 'hello',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects page < 1', async () => {
    const errors = await validateDto({ page: 0 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects limit < 1', async () => {
    const errors = await validateDto({ limit: 0 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it(`rejects limit > ${PAGINATION_MAX_LIMIT}`, async () => {
    const errors = await validateDto({ limit: PAGINATION_MAX_LIMIT + 1 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it(`accepts limit = ${PAGINATION_MAX_LIMIT}`, async () => {
    const errors = await validateDto({ limit: PAGINATION_MAX_LIMIT });
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid sortOrder', async () => {
    const errors = await validateDto({ sortOrder: 'RANDOM' });
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });

  it('defaults sortOrder to DESC', () => {
    const dto = plainToInstance(PaginationDto, {});
    expect(dto.sortOrder).toBe(SortOrder.DESC);
  });

  it('defaults page to 1', () => {
    const dto = plainToInstance(PaginationDto, {});
    expect(dto.page).toBe(1);
  });

  it('defaults limit to 10', () => {
    const dto = plainToInstance(PaginationDto, {});
    expect(dto.limit).toBe(10);
  });
});
