/**
 * SW-BE-005: Auth & JWT — audit trail hooks
 *
 * Canonical event names for all auth audit entries.
 * Using a const enum keeps the values tree-shakeable and prevents
 * magic strings from spreading across the codebase.
 */
export const AuthAuditEvent = {
  // Successful flows
  LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  LOGOUT: 'AUTH_LOGOUT',
  TOKEN_REFRESHED: 'AUTH_TOKEN_REFRESHED',
  WALLET_LOGIN_SUCCESS: 'AUTH_WALLET_LOGIN_SUCCESS',
  REGISTER_SUCCESS: 'AUTH_REGISTER_SUCCESS',

  // Failure / security events
  LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  LOGIN_SUSPENDED: 'AUTH_LOGIN_SUSPENDED',
  TOKEN_REUSE_DETECTED: 'AUTH_TOKEN_REUSE_DETECTED',
  TOKEN_REFRESH_FAILED: 'AUTH_TOKEN_REFRESH_FAILED',
  WALLET_LOGIN_FAILED: 'AUTH_WALLET_LOGIN_FAILED',
} as const;

export type AuthAuditEventType =
  (typeof AuthAuditEvent)[keyof typeof AuthAuditEvent];
