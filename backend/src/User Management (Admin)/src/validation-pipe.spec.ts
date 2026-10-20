import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { QueryUsersDto } from './users/dto/query-users.dto';

describe('Global ValidationPipe (admin bootstrap config)', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('rejects an unknown property with forbidNonWhitelisted', async () => {
    await expect(
      pipe.transform(
        { limit: '10', unknownField: 'x' },
        { type: 'body', metatype: QueryUsersDto } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('coerces a string query value to its DTO type via transform', async () => {
    const result = await pipe.transform(
      { limit: '10' },
      { type: 'query', metatype: QueryUsersDto } as any,
    );
    expect(result.limit).toBe(10);
    expect(typeof result.limit).toBe('number');
  });
});
