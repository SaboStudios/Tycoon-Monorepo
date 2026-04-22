import { SetMetadata } from '@nestjs/common';
import { IDEMPOTENCY_KEY_OPTIONS, IdempotencyOptions } from './idempotency.constants';

/**
 * Decorator to mark a method as idempotent
 */
export const Idempotent = (options: IdempotencyOptions = {}) =>
  SetMetadata(IDEMPOTENCY_KEY_OPTIONS, options);
