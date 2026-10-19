import { BadRequestException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { IdempotencyKeyGuard } from './idempotency-key.guard';

function mockContext(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as ExecutionContext;
}

describe('IdempotencyKeyGuard', () => {
  const guard = new IdempotencyKeyGuard();

  it('rejects missing Idempotency-Key header', () => {
    expect(() => guard.canActivate(mockContext({}))).toThrow(BadRequestException);
  });

  it('rejects empty Idempotency-Key header', () => {
    expect(() => guard.canActivate(mockContext({ 'idempotency-key': '  ' }))).toThrow(
      BadRequestException,
    );
  });

  it('rejects Idempotency-Key longer than 255 characters', () => {
    expect(() =>
      guard.canActivate(mockContext({ 'idempotency-key': 'a'.repeat(256) })),
    ).toThrow(BadRequestException);
  });

  it('allows a valid Idempotency-Key', () => {
    expect(guard.canActivate(mockContext({ 'idempotency-key': 'valid-key' }))).toBe(true);
  });
});
