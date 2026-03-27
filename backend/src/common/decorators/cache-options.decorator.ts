import { SetMetadata } from '@nestjs/common';

export interface CacheOptions {
  ttl?: number;
  keyPrefix?: string;
  useUserPrefix?: boolean;
}

export const CACHE_OPTIONS = 'cache_options';

/**
 * Decorator to specify custom cache options for a route.
 * @param options Cache options including TTL and key prefix.
 */
export const CacheOptions = (options: CacheOptions) =>
  SetMetadata(CACHE_OPTIONS, options);
