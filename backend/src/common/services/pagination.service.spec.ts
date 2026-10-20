import { PaginationService } from './pagination.service';
import { SortOrder, PAGINATION_MAX_LIMIT } from '../dto/pagination.dto';
import { SelectQueryBuilder } from 'typeorm';

/** Minimal stub that records the calls made by PaginationService. */
function buildQb(rows: object[] = [], total = 0) {
  const qb = {
    alias: 'entity',
    _orderBy: [] as { expr: string; dir: string }[],
    _where: [] as string[],
    _skip: 0,
    _take: 0,
    andWhere(cond: string) {
      this._where.push(cond);
      return this;
    },
    orderBy(expr: string, dir: string) {
      this._orderBy = [{ expr, dir }];
      return this;
    },
    addOrderBy(expr: string, dir: string) {
      this._orderBy.push({ expr, dir });
      return this;
    },
    skip(n: number) {
      this._skip = n;
      return this;
    },
    take(n: number) {
      this._take = n;
      return this;
    },
    getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
  };
  return qb as unknown as SelectQueryBuilder<object>;
}

describe('PaginationService', () => {
  let service: PaginationService;

  beforeEach(() => {
    service = new PaginationService();
  });

  it('returns correct meta for page 1', async () => {
    const qb = buildQb([{ id: 1 }, { id: 2 }], 25);
    const result = await service.paginate(qb, { page: 1, limit: 10 });

    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(10);
    expect(result.meta.totalItems).toBe(25);
    expect(result.meta.totalPages).toBe(3);
    expect(result.meta.hasNextPage).toBe(true);
    expect(result.meta.hasPreviousPage).toBe(false);
  });

  it('returns correct meta for last page', async () => {
    const qb = buildQb([{ id: 25 }], 25);
    const result = await service.paginate(qb, { page: 3, limit: 10 });

    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.hasPreviousPage).toBe(true);
  });

  it('clamps limit to PAGINATION_MAX_LIMIT', async () => {
    const qb = buildQb([], 0);
    const result = await service.paginate(qb, { page: 1, limit: 9999 });
    expect(result.meta.limit).toBe(PAGINATION_MAX_LIMIT);
  });

  it('applies stable secondary sort on id when sortBy is provided', async () => {
    const qb = buildQb([], 0);
    const stub = qb as unknown as {
      _orderBy: { expr: string; dir: string }[];
    };
    await service.paginate(qb, { page: 1, sortBy: 'created_at', sortOrder: SortOrder.DESC });

    expect(stub._orderBy).toHaveLength(2);
    expect(stub._orderBy[0].expr).toBe('entity.created_at');
    expect(stub._orderBy[1].expr).toBe('entity.id');
    expect(stub._orderBy[1].dir).toBe(SortOrder.DESC);
  });

  it('falls back to id DESC when no sortBy is given', async () => {
    const qb = buildQb([], 0);
    const stub = qb as unknown as {
      _orderBy: { expr: string; dir: string }[];
    };
    await service.paginate(qb, { page: 1 });

    expect(stub._orderBy).toHaveLength(1);
    expect(stub._orderBy[0].expr).toBe('entity.id');
    expect(stub._orderBy[0].dir).toBe(SortOrder.DESC);
  });

  it('applies search filter across searchable fields', async () => {
    const qb = buildQb([], 0);
    const stub = qb as unknown as { _where: string[] };
    await service.paginate(qb, { page: 1, search: 'foo' }, ['name', 'email']);

    expect(stub._where.length).toBeGreaterThan(0);
    expect(stub._where[0]).toContain('ILIKE');
  });

  it('skips search filter when no searchable fields provided', async () => {
    const qb = buildQb([], 0);
    const stub = qb as unknown as { _where: string[] };
    await service.paginate(qb, { page: 1, search: 'foo' });

    expect(stub._where).toHaveLength(0);
  });

  it('calculates correct skip offset', async () => {
    const qb = buildQb([], 100);
    const stub = qb as unknown as { _skip: number; _take: number };
    await service.paginate(qb, { page: 3, limit: 10 });

    expect(stub._skip).toBe(20);
    expect(stub._take).toBe(10);
  });
});
