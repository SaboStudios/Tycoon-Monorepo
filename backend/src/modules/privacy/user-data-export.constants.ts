/**
 * Canonical table keys included in a user data export (`payload.tables`).
 * Keep in sync with `UserDataCollectorService` and privacy docs.
 * Does not include metadata keys (`export_version`, `generated_at`, `user_id`, `tables`).
 */
export const USER_DATA_EXPORT_TABLE_KEYS = [
  'users',
  'user_preferences',
  'user_suspensions',
  'refresh_tokens',
  'game_players',
  'purchases',
  'user_inventory',
  'coupon_usage_logs',
  'user_skins',
  'gifts',
  'notifications',
  'audit_trails',
  'player_perks',
  'boost_usage_tracking',
  'active_boosts',
  'perk_analytics_events',
  'admin_logs',
  'waitlist_match_by_email',
] as const;

export type UserDataExportTableKey = (typeof USER_DATA_EXPORT_TABLE_KEYS)[number];

export const USER_DATA_EXPORT_VERSION = '1';
