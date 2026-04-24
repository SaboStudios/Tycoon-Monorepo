import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'is_idempotent';
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);
