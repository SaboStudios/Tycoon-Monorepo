export const IDEMPOTENCY_KEY_OPTIONS = 'idempotency_options';
export const IDEMPOTENCY_HEADER = 'X-Idempotency-Key';
export const DEFAULT_IDEMPOTENCY_TTL = 86400; // 24 hours in seconds
export const IDEMPOTENCY_KEY_PREFIX = 'idempotency:';

export interface IdempotencyOptions {
  /**
   * Time-to-live for idempotency key in seconds
   * Default: 24 hours (86400 seconds)
   */
  ttl?: number;
  
  /**
   * Whether to include request body in key generation
   * Default: false
   */
  includeBody?: boolean;
  
  /**
   * Whether to include query parameters in key generation
   * Default: true
   */
  includeQuery?: boolean;
  
  /**
   * Whether to include headers in key generation
   * Default: false
   */
  includeHeaders?: boolean;
  
  /**
   * List of headers to include if includeHeaders is true
   * Default: ['content-type', 'authorization']
   */
  headersToInclude?: string[];
  
  /**
   * Whether to store the full response for replay
   * Default: true
   */
  storeResponse?: boolean;
  
  /**
   * Maximum size of response to store (in bytes)
   * Default: 1MB
   */
  maxResponseSize?: number;
}
