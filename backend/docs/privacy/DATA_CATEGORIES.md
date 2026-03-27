# User data categories (export scope)

This document maps **logical categories** to the **canonical table keys** in `payload.tables` of a user data export (`USER_DATA_EXPORT_TABLE_KEYS` in `user-data-export.constants.ts`). The export is a machine-readable JSON package for GDPR-style portability; it is not a full database dump.

| Category | Table keys | Notes |
|----------|------------|--------|
| Account & profile | `users` | Password hash is omitted. |
| Preferences & settings | `user_preferences` | |
| Moderation | `user_suspensions` | |
| Sessions | `refresh_tokens` | Raw token values are redacted. |
| Game participation | `game_players` | |
| Commerce | `purchases`, `user_inventory`, `coupon_usage_logs` | |
| Cosmetics | `user_skins` | |
| Social / gifts | `gifts` | Rows where the user is sender or receiver. |
| In-app messaging | `notifications` | |
| Audit & compliance | `audit_trails` | User-scoped events. |
| Perks & boosts | `player_perks`, `boost_usage_tracking`, `active_boosts`, `perk_analytics_events` | |
| Admin actions | `admin_logs` | Where the user acted as admin (`adminId`). |
| Marketing / waitlist | `waitlist_match_by_email` | Waitlist rows whose email matches the account email, including soft-deleted rows when applicable. |

Metadata outside `tables`: `export_version`, `generated_at`, `user_id`.
