# Token Refresh Security - Developer Guide

## Quick Start

### Running the Migration

Before using the new security features, run the database migration:

```bash
npm run migration:run
```

This will:
- Update the `refresh_tokens` table schema
- Add metadata tracking columns
- Clear existing tokens (users will need to re-authenticate)

### Environment Configuration

Add to your `.env` file:

```bash
# Optional: Clock skew tolerance (default: 60 seconds)
JWT_CLOCK_SKEW_SECONDS=60
```

## Key Changes for Developers

### 1. Token Storage

**Before:**
```typescript
// Tokens stored in plaintext
token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**After:**
```typescript
// Tokens stored as SHA-256 hashes
tokenHash: "ebd917958fc7b45aa35d972f7babc2331c0776a4a2aed01a6d54f799d0407735"
```

### 2. Token Creation

The `createRefreshToken` method now:
- Returns an object with `{ token, entity }` instead of just the entity
- Accepts optional `ipAddress` and `userAgent` parameters
- Generates unique tokens using JWT ID (jti)

**Usage:**
```typescript
const { token, entity } = await authService.createRefreshToken(
  userId,
  '192.168.1.1',  // optional
  'Mozilla/5.0'    // optional
);

// Use token for response
return { refreshToken: token };
```

### 3. Token Refresh

The `refreshTokens` method now:
- Accepts optional `ipAddress` and `userAgent` parameters
- Implements reuse detection
- Logs security events

**Usage:**
```typescript
const result = await authService.refreshTokens(
  refreshToken,
  req.ip,                      // optional
  req.headers['user-agent']    // optional
);
```

### 4. Security Events

Monitor logs for token reuse detection:

```typescript
// Log format
[AuthService] Refresh token reuse detected for user 123. Revoking all tokens.
```

## Testing

### Running Security Tests

```bash
# Run token security integration tests
npm run test:e2e -- auth-token-security.e2e-spec.ts

# Run all auth tests
npm test -- auth.service.spec.ts
```

### Writing Tests

When testing token refresh:

```typescript
// Create a token
const { token } = await authService.createRefreshToken(userId);

// Use it once (this revokes it)
await authService.refreshTokens(token);

// Trying to use it again should fail
await expect(
  authService.refreshTokens(token)
).rejects.toThrow('Token reuse detected');
```

## Common Scenarios

### Scenario 1: Normal Token Refresh

```typescript
// Client sends refresh token
POST /api/v1/auth/refresh
{
  "refreshToken": "eyJhbGc..."
}

// Server response
{
  "accessToken": "new-access-token",
  "refreshToken": "new-refresh-token"  // Old token is now invalid
}
```

### Scenario 2: Token Reuse Attack

```typescript
// Attacker tries to reuse an old token
POST /api/v1/auth/refresh
{
  "refreshToken": "old-revoked-token"
}

// Server response
401 Unauthorized
{
  "statusCode": 401,
  "message": "Token reuse detected"
}

// All user tokens are now revoked
// User must re-authenticate
```

### Scenario 3: User Logout

```typescript
// User logs out
POST /api/v1/auth/logout

// All refresh tokens for this user are revoked
// Any subsequent refresh attempts will fail
```

## Security Best Practices

### 1. Always Pass Metadata

When calling auth service methods, always pass IP address and user agent:

```typescript
// ✅ Good
await authService.refreshTokens(
  token,
  req.ip,
  req.headers['user-agent']
);

// ❌ Bad (missing metadata)
await authService.refreshTokens(token);
```

### 2. Handle Token Reuse Errors

```typescript
try {
  const result = await authService.refreshTokens(token);
  return result;
} catch (error) {
  if (error.message === 'Token reuse detected') {
    // Log security event
    logger.warn('Potential security breach detected');
    
    // Force user to re-authenticate
    throw new UnauthorizedException('Please log in again');
  }
  throw error;
}
```

### 3. Monitor Token Metrics

Track these metrics in production:
- Token refresh rate
- Token reuse detection frequency
- Failed refresh attempts
- Token lifetime distribution

### 4. Clock Synchronization

Ensure server clocks are synchronized:
- Use NTP (Network Time Protocol)
- Monitor clock drift
- Adjust `JWT_CLOCK_SKEW_SECONDS` if needed

## Troubleshooting

### Issue: "Token reuse detected" on legitimate requests

**Possible Causes:**
1. Client is caching old tokens
2. Multiple requests using the same token
3. Race condition in token refresh

**Solutions:**
1. Ensure client updates stored token after each refresh
2. Implement request queuing on client side
3. Add retry logic with exponential backoff

### Issue: "Invalid refresh token" errors

**Possible Causes:**
1. Token expired
2. Token was revoked (logout)
3. Database migration cleared tokens

**Solutions:**
1. Check token expiration time
2. Verify user hasn't logged out
3. Prompt user to re-authenticate

### Issue: Clock skew errors

**Possible Causes:**
1. Server clocks out of sync
2. `JWT_CLOCK_SKEW_SECONDS` too low

**Solutions:**
1. Synchronize server clocks with NTP
2. Increase clock skew tolerance
3. Monitor server time drift

## API Reference

### AuthService Methods

#### `createRefreshToken(userId, ipAddress?, userAgent?)`

Creates a new refresh token with metadata.

**Parameters:**
- `userId` (number): User ID
- `ipAddress` (string, optional): Client IP address
- `userAgent` (string, optional): Client user agent

**Returns:**
```typescript
{
  token: string;      // The actual JWT token
  entity: RefreshToken;  // Database entity
}
```

#### `refreshTokens(token, ipAddress?, userAgent?)`

Refreshes access and refresh tokens.

**Parameters:**
- `token` (string): Current refresh token
- `ipAddress` (string, optional): Client IP address
- `userAgent` (string, optional): Client user agent

**Returns:**
```typescript
{
  accessToken: string;
  refreshToken: string;
}
```

**Throws:**
- `UnauthorizedException`: Invalid, expired, or reused token

#### `logout(userId)`

Revokes all refresh tokens for a user.

**Parameters:**
- `userId` (number): User ID

**Returns:** `Promise<void>`

## Migration Guide

### For Existing Applications

1. **Backup Database**
   ```bash
   pg_dump your_database > backup.sql
   ```

2. **Run Migration**
   ```bash
   npm run migration:run
   ```

3. **Update Environment**
   ```bash
   echo "JWT_CLOCK_SKEW_SECONDS=60" >> .env
   ```

4. **Notify Users**
   - All users will need to re-authenticate
   - Existing refresh tokens are invalidated

5. **Monitor Logs**
   - Watch for "Token reuse detected" warnings
   - Track authentication failures

6. **Rollback Plan**
   ```bash
   npm run migration:revert
   ```

## Additional Resources

- [Implementation Documentation](../TOKEN_REFRESH_SECURITY_IMPLEMENTATION.md)
- [Integration Tests](../test/auth-token-security.e2e-spec.ts)
- [OWASP JWT Security](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
