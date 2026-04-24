# Games & Matchmaking Audit Trail System

Comprehensive audit trail system for Games and Matchmaking operations in the Tycoon NestJS backend. Automatically captures and logs critical game operations for compliance, debugging, and analytics.

## Features

- **Automated Audit Logging**: Captures all game lifecycle events, matchmaking operations, and player actions
- **Privacy by Default**: Sensitive data (passwords, tokens, wallet addresses) automatically redacted
- **Async-First**: Non-blocking audit operations don't impact request latency
- **Observable**: Prometheus metrics for monitoring audit operations
- **Configurable**: Feature flags and environment variables for fine-grained control
- **Graceful Degradation**: Audit failures don't break main application flow

## Architecture

The system uses a **dual logging strategy**:

1. **AuditTrailService**: Persistent database records for compliance and historical analysis
   - Structured data in PostgreSQL (`audit_trails` table)
   - Queryable by user, action, time range
   - Retention policies can be applied

2. **GamesObservabilityService**: Real-time operational metrics and structured logging
   - Prometheus metrics for monitoring and alerting
   - Structured JSON logs for log aggregation systems
   - Performance tracking and anomaly detection

## Configuration

All configuration is done via environment variables in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `GAMES_AUDIT_ENABLED` | `true` | Enable/disable audit logging |
| `GAMES_AUDIT_LOG_LEVEL` | `info` | Log level for audit operations (`debug`, `info`, `warn`, `error`) |
| `GAMES_AUDIT_REDACT_SENSITIVE` | `true` | Enable sensitive data redaction |
| `GAMES_AUDIT_LOG_VIEWS` | `false` | Log read-only operations (views, searches) |
| `GAMES_AUDIT_ASYNC_TIMEOUT_MS` | `5000` | Timeout for async audit operations in milliseconds |

### Example Configuration

```bash
# Production (recommended)
GAMES_AUDIT_ENABLED=true
GAMES_AUDIT_LOG_LEVEL=info
GAMES_AUDIT_REDACT_SENSITIVE=true
GAMES_AUDIT_LOG_VIEWS=false
GAMES_AUDIT_ASYNC_TIMEOUT_MS=5000

# Development (debugging)
GAMES_AUDIT_ENABLED=true
GAMES_AUDIT_LOG_LEVEL=debug
GAMES_AUDIT_REDACT_SENSITIVE=false  # Only for local debugging
GAMES_AUDIT_LOG_VIEWS=true
GAMES_AUDIT_ASYNC_TIMEOUT_MS=10000

# Staging (high volume testing)
GAMES_AUDIT_ENABLED=true
GAMES_AUDIT_LOG_LEVEL=info
GAMES_AUDIT_REDACT_SENSITIVE=true
GAMES_AUDIT_LOG_VIEWS=true  # Enable for testing
GAMES_AUDIT_ASYNC_TIMEOUT_MS=5000
```

## Audit Log Format

Each audit log contains:

- `userId`: User who performed the action
- `action`: Type of action (e.g., `GAME_CREATED`, `GAME_JOINED`)
- `changes`: JSONB metadata specific to the action
- `ipAddress`: Redacted IP address (first 2 octets only)
- `userAgent`: Browser/client user agent
- `createdAt`: Timestamp in ISO 8601 format

### Audit Actions

**Game Lifecycle:**
- `GAME_CREATED`: New game created
- `GAME_UPDATED`: Game updated (status, winner, placements, etc.)
- `GAME_SETTINGS_UPDATED`: Game settings updated
- `GAME_VIEWED`: Game viewed (conditional on `GAMES_AUDIT_LOG_VIEWS`)
- `GAME_SEARCHED`: Games searched/filtered

**Matchmaking:**
- `GAME_JOINED`: Player successfully joined a game
- `GAME_JOIN_FAILED`: Player failed to join a game
- `GAME_LEFT`: Player left a game

**Player Actions:**
- `PLAYER_DICE_ROLLED`: Player rolled dice
- `PLAYER_RENT_PAID`: Player paid rent
- `PLAYER_TAX_PAID`: Player paid tax
- `PLAYER_PROPERTY_BOUGHT`: Player bought property
- `PLAYER_UPDATED`: Player state updated

## Querying Audit Logs

### Get all game creations by a user

```sql
SELECT * FROM audit_trails
WHERE user_id = 123 AND action = 'GAME_CREATED'
ORDER BY created_at DESC;
```

### Get all failed join attempts in the last 24 hours

```sql
SELECT * FROM audit_trails
WHERE action = 'GAME_JOIN_FAILED'
AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Get audit trail for a specific game

```sql
SELECT * FROM audit_trails
WHERE changes->>'gameId' = '456'
ORDER BY created_at ASC;
```

### Get all player actions in a game

```sql
SELECT * FROM audit_trails
WHERE changes->>'gameId' = '456'
AND action LIKE 'PLAYER_%'
ORDER BY created_at ASC;
```

### Get audit logs with specific metadata

```sql
-- Find all games created with AI enabled
SELECT * FROM audit_trails
WHERE action = 'GAME_CREATED'
AND changes->>'isAi' = 'true';

-- Find all rent payments over 1000
SELECT * FROM audit_trails
WHERE action = 'PLAYER_RENT_PAID'
AND (changes->>'finalRent')::int > 1000;
```

## Sensitive Data Redaction

When `GAMES_AUDIT_REDACT_SENSITIVE=true` (default), the following data is automatically redacted:

| Data Type | Redaction Method | Example |
|-----------|------------------|---------|
| Passwords | Removed entirely | `{ password: 'secret' }` → `{}` |
| Tokens/API Keys | Removed entirely | `{ token: 'abc123' }` → `{}` |
| Wallet Addresses | Keep last 4 chars | `0x1234567890abcdef` → `0x...cdef` |
| Email Addresses | Keep domain | `user@example.com` → `***@example.com` |
| IP Addresses | Keep first 2 octets | `192.168.1.100` → `192.168.*.*` |

### Sensitive Field Patterns

Fields matching these patterns are removed entirely:
- `password`, `token`, `secret`, `api_key`, `private_key`, `seed`, `mnemonic`, `auth`

## Prometheus Metrics

The system exposes the following Prometheus metrics:

### Audit-Specific Metrics

- `tycoon_games_audit_logs_total{action, result}`: Total number of audit logs by action and result
- `tycoon_games_audit_log_failures_total{action, error_type}`: Total number of failed audit operations
- `tycoon_games_audit_log_duration_seconds{action}`: Duration of audit log operations (histogram)
- `tycoon_games_audit_log_queue_size`: Number of pending audit operations (gauge)

### Game Operation Metrics (existing)

- `tycoon_games_created_total{mode, is_ai, is_minipay, chain}`: Total games created
- `tycoon_games_joined_total{result, reason}`: Total game join attempts
- `tycoon_games_updated_total{field, status_transition}`: Total game updates
- `tycoon_game_operations_duration_seconds{operation}`: Duration of game operations

## Troubleshooting

### Audit logs not appearing

1. **Check if audit logging is enabled**
   ```bash
   # In .env
   GAMES_AUDIT_ENABLED=true
   ```

2. **Check database connectivity**
   ```bash
   # Test database connection
   psql -h localhost -U postgres -d tycoon_db -c "SELECT COUNT(*) FROM audit_trails;"
   ```

3. **Check application logs for audit errors**
   ```bash
   # Look for audit-related errors
   grep "Failed to log.*audit" logs/app.log
   ```

4. **Verify user is authenticated**
   - Audit logging requires `userId` from JWT token
   - Unauthenticated requests won't have audit trails

### High audit log latency

1. **Check database connection pool size**
   ```bash
   # In .env
   DB_POOL_SIZE=20  # Increase if needed
   ```

2. **Check `audit_trails` table indexes**
   ```sql
   -- Verify indexes exist
   SELECT indexname, indexdef FROM pg_indexes
   WHERE tablename = 'audit_trails';
   ```

3. **Consider increasing timeout**
   ```bash
   # In .env
   GAMES_AUDIT_ASYNC_TIMEOUT_MS=10000  # Increase from 5000
   ```

4. **Monitor audit log duration metric**
   ```promql
   # Check p99 latency
   histogram_quantile(0.99, rate(tycoon_games_audit_log_duration_seconds_bucket[5m]))
   ```

### Audit logging causing performance issues

1. **Verify async execution**
   - Audit operations should not block request processing
   - Check for synchronous audit calls in code

2. **Check audit log queue size**
   ```promql
   # Monitor queue size
   tycoon_games_audit_log_queue_size
   ```

3. **Disable view logging if not needed**
   ```bash
   # In .env
   GAMES_AUDIT_LOG_VIEWS=false  # Reduces volume
   ```

4. **Temporarily disable audit logging**
   ```bash
   # In .env (emergency only)
   GAMES_AUDIT_ENABLED=false
   ```

### Sensitive data appearing in logs

1. **Verify redaction is enabled**
   ```bash
   # In .env
   GAMES_AUDIT_REDACT_SENSITIVE=true
   ```

2. **Check for custom fields**
   - Custom fields may not match sensitive patterns
   - Add custom patterns to `SensitiveDataRedactor` if needed

3. **Review audit logs**
   ```sql
   -- Check for sensitive data
   SELECT * FROM audit_trails
   WHERE changes::text LIKE '%password%'
   OR changes::text LIKE '%token%';
   ```

## Development

### Running Tests

```bash
# Unit tests
npm run test -- games-audit

# Integration tests
npm run test:e2e -- games-audit

# Test coverage
npm run test:cov -- games-audit
```

### Adding New Audit Actions

1. Add action to `AuditAction` enum in `audit-trail.entity.ts`
2. Create context interface in `games-audit.service.ts`
3. Implement audit method in `GamesAuditService`
4. Call audit method from service/controller
5. Add tests for new audit action

### Example: Adding Custom Audit Action

```typescript
// 1. Add to AuditAction enum
export enum AuditAction {
  // ... existing actions
  GAME_PAUSED = 'GAME_PAUSED',
}

// 2. Create context interface
export interface GamePausedContext extends BaseAuditContext {
  reason: string;
  pausedBy: number;
}

// 3. Implement audit method
async logGamePaused(context: GamePausedContext): Promise<void> {
  if (!this.isAuditEnabled()) {
    return;
  }

  try {
    const redactedContext = this.redactor.redactObject(context);
    await Promise.race([
      this.auditTrailService.log(AuditAction.GAME_PAUSED, {
        userId: context.userId,
        changes: redactedContext,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      }),
      this.timeout(this.getAsyncTimeout()),
    ]);
  } catch (error) {
    this.logger.error('Failed to log game paused audit', {
      error: error.message,
      context: { gameId: context.gameId, userId: context.userId },
    });
  }
}

// 4. Call from service
async pauseGame(gameId: number, userId: number, reason: string) {
  // ... pause game logic

  await this.gamesAuditService.logGamePaused({
    gameId,
    userId,
    reason,
    pausedBy: userId,
    timestamp: new Date().toISOString(),
    operation: 'pause_game',
  });
}
```

## Support

For issues or questions:
1. Check this README and troubleshooting section
2. Review application logs for audit-related errors
3. Check Prometheus metrics for audit operation health
4. Contact the backend team for assistance

## License

Internal use only - Tycoon Backend
