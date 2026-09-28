export interface JwtPayload {
  sub: number;
  id: number;
  email: string;
  role: string;
  is_admin: boolean;
  /**
   * Epoch seconds of the primary login that minted this token. Absent on
   * tokens minted by /auth/refresh. Used by RecentAuthGuard for step-up.
   */
  auth_time?: number;
  /** Authentication methods of the primary login, e.g. ['pwd'] or ['wallet']. */
  amr?: string[];
}
