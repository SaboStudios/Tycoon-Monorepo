/** Minimal @nestjs/throttler stub for unit tests. */
export const ThrottlerGuard = class {
  canActivate() { return true; }
};
export const ThrottlerException = class extends Error {};
export const Throttle = () => () => {};
export const SkipThrottle = () => () => {};
export class ThrottlerModule {
  static forRoot = jest
    .fn()
    .mockReturnValue({ module: ThrottlerModule });
  static forRootAsync = jest
    .fn()
    .mockReturnValue({ module: ThrottlerModule });
}
