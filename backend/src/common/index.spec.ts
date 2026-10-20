/**
 * #1926 – barrel surface guard
 *
 * Asserts that backend/src/common/index.ts re-exports all expected symbols so
 * that future edits cannot silently drop them and force consumers to reach into
 * deep paths.
 */
import * as barrel from './index';

describe('common/index barrel', () => {
  // #1926 – newly added exports
  it('exports RawBodyMiddleware', () => {
    expect((barrel as Record<string, unknown>)['RawBodyMiddleware']).toBeDefined();
  });

  it('exports SoftDeleteService', () => {
    expect((barrel as Record<string, unknown>)['SoftDeleteService']).toBeDefined();
  });

  // Pre-existing exports – guard against accidental removal
  it('exports PaginationService', () => {
    expect((barrel as Record<string, unknown>)['PaginationService']).toBeDefined();
  });

  it('exports HttpExceptionFilter', () => {
    expect((barrel as Record<string, unknown>)['HttpExceptionFilter']).toBeDefined();
  });

  it('exports AppThrottlerGuard', () => {
    expect((barrel as Record<string, unknown>)['AppThrottlerGuard']).toBeDefined();
  });
});
