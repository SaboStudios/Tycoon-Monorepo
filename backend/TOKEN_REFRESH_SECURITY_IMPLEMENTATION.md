# Token Refresh Security Implementation

## Overview
This document describes the security improvements implemented for the token refresh mechanism in the Tycoon-Monorepo backend authentication system.

## Implemented Features

### 1. Token Hashing (SHA-256)
**Status:** ✅ Implemented

- Refresh tokens are now stored as SHA-256 hashes instead of plaintext
- Uses Node.js `crypto.createHash('sha256')` for hashing
- Tokens are hashed before storage and lookup operations
- Database schema updated: `token` column renamed to `tokenHash`

**Files Modified:**
- `src/modules/auth/entities/refresh-token.entity.ts`
- `src/modules/auth/auth.service.ts`
- `src/database/migrations/1740520000000-UpdateRefreshTokensForSecurity.ts`

### 2. Token Reuse Detection
**Status:** ✅ Implemented

- Detects when a revoked token is reused (potential security breach)
- Automatically revokes ALL tokens for the affected user when reuse is detected
- Logs security events using NestJS Logger
- Returns specific error message: "Token reuse detected"

**Implementation Details:**
- When a token is used for refresh, it's immediately revoked
- If an already-revoked token is presented, the system:
  1. Logs a warning with user ID
  2. Revokes all tokens for that user
  3. Throws `UnauthorizedException` with "Token reuse detected" message

**Files Modified:**
- `src/modules/auth/auth.service.ts`

### 3. Clock Skew Tolerance
**Status:** ✅ Implemented

- Added `JWT_CLOCK_SKEW_SECONDS` environment variable (default: 60 seconds)
- Configured JwtModule with `clockTolerance` in verify options
- Allows tokens to be valid within the tolerance window to account for clock differences between servers

**Configuration:**
```typescript
verifyOptions: {
  clockTolerance: configService.get<number>('jwt.clockTolerance') || 60,
}
```

**Files Modified:**
- `src/config/jwt.config.ts`
- `src/modules/auth/auth.module.ts`
- `.env.example`

### 4. Metadata Tracking
**Status:** ✅ Implemented

Added the following metadata fields to RefreshToken entity:
- `lastUsedAt`: Timestamp of last token usage
- `ipAddress`: IP address of the client (VARCHAR(45) to support IPv6)
- `userAgent`: User agent string from the client

**Implementation Details:**
- Metadata is captured during token creation and refresh
- Controller extracts IP and user agent from request
- Service methods updated to accept and store metadata

**Files Modified:**
- `src/modules/auth/entities/refresh-token.entity.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/auth.controller.ts`
- `src/database/migrations/1740520000000-UpdateRefreshTokensForSecurity.ts`

### 5. Token Uniqueness
**Status:** ✅ Implemented

- Added JWT ID (`jti`) claim to each refresh token
- Uses `crypto.randomBytes(16)` to generate unique identifiers
- Ensures each token has a unique hash even when created in rapid succession

**Files Modified:**
- `src/modules/auth/auth.service.ts`

### 6. Logout Improvements
**Status:** ✅ Verified

- Existing implementation already invalidates all refresh tokens for a user
- Verified through integration tests
- No changes needed

## Database Migration

### Migration: `1740520000000-UpdateRefreshTokensForSecurity.ts`

**Changes:**
1. Renamed `token` column to `tokenHash`
2. Added `lastUsedAt` column (TIMESTAMP, nullable)
3. Added `ipAddress` column (VARCHAR(45), nullable)
4. Added `userAgent` column (TEXT, nullable)
5. Cleared existing tokens (since they're not hashed)

**To Run Migration:**
```bash
npm run migration:run
```

## Integration Tests

### Test Suite: `test/auth-token-security.e2e-spec.ts`

**Test Coverage:**
- ✅ Token hashing (SHA-256 verification)
- ✅ Hashed token lookup and refresh
- ✅ Revoked token rejection
- ✅ Token reuse detection and family revocation
- ✅ Token rotation on each refresh
- ✅ Old token revocation after rotation
- ✅ IP address and user agent tracking
- ✅ Metadata updates on refresh
- ✅ Logout invalidates all tokens
- ✅ Tokens unusable after logout
- ✅ Clock skew tolerance
- ✅ Invalid token rejection
- ✅ Expired token rejection

**All 13 tests passing ✅**

**To Run Tests:**
```bash
npm run test:e2e -- auth-token-security.e2e-spec.ts
```

## Environment Variables

### New Variable

```bash
# Clock skew tolerance in seconds (default: 60)
# Allows tokens to be valid within this time window to account for clock differences
JWT_CLOCK_SKEW_SECONDS=60
```

### Existing Variables (No Changes)
```bash
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

## Security Benefits

1. **Token Confidentiality**: Hashed tokens prevent exposure of actual token values in database breaches
2. **Replay Attack Prevention**: Token reuse detection identifies and mitigates replay attacks
3. **Token Family Revocation**: Compromised token families are automatically invalidated
4. **Audit Trail**: Metadata tracking enables security analysis and anomaly detection
5. **Clock Synchronization**: Tolerance prevents false rejections due to minor clock differences
6. **Token Uniqueness**: JTI ensures each token is cryptographically unique

## API Changes

### Refresh Endpoint
**Endpoint:** `POST /api/v1/auth/refresh`

**No Breaking Changes** - The endpoint signature remains the same:

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

**Internal Changes:**
- Now captures IP address and user agent from request
- Stores metadata with new tokens
- Implements reuse detection logic

## Deployment Checklist

- [x] Run database migration
- [x] Update environment variables (add `JWT_CLOCK_SKEW_SECONDS`)
- [x] Run integration tests
- [x] Verify existing auth tests pass
- [ ] Deploy to staging environment
- [ ] Monitor logs for "Token reuse detected" warnings
- [ ] Verify token refresh flow in production

## Monitoring Recommendations

1. **Log Analysis**: Monitor for "Token reuse detected" warnings
2. **Metrics**: Track token refresh rates and reuse detection frequency
3. **Alerts**: Set up alerts for unusual token reuse patterns
4. **Audit**: Periodically review `ipAddress` and `userAgent` data for anomalies

## Future Enhancements

Potential improvements for consideration:
1. Rate limiting on token refresh endpoint
2. Geolocation-based anomaly detection
3. Device fingerprinting
4. Token binding to specific devices
5. Configurable token family size limits

## References

- [OWASP Token-Based Authentication](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [RFC 7519 - JSON Web Token (JWT)](https://tools.ietf.org/html/rfc7519)
- [OAuth 2.0 Token Revocation](https://tools.ietf.org/html/rfc7009)
