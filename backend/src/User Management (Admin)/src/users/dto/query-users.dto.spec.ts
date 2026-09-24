import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { QueryUsersDto } from './query-users.dto';
import { UserRole, UserStatus } from '../entities/user.entity';

describe('QueryUsersDto', () => {
  it('should accept valid query parameters', async () => {
    const dto = plainToInstance(QueryUsersDto, {
      page: 1,
      limit: 10,
      search: 'test',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should use default values when not provided', async () => {
    const dto = plainToInstance(QueryUsersDto, {});

    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
  });

  it('should reject invalid page number', async () => {
    const dto = plainToInstance(QueryUsersDto, { page: 0 });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('page');
  });

  it('should reject invalid limit', async () => {
    const dto = plainToInstance(QueryUsersDto, { limit: -1 });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('limit');
  });

  it('should reject invalid role', async () => {
    const dto = plainToInstance(QueryUsersDto, { role: 'invalid_role' });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('role');
  });

  it('should reject invalid status', async () => {
    const dto = plainToInstance(QueryUsersDto, { status: 'invalid_status' });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('status');
  });
});
