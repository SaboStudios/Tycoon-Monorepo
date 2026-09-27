# ADR-005: In-Game Chat Moderation

- Status: Accepted
- Date: 2026-09-26
- Deciders: Platform, Games, Security
- Author: Backend Team
- Related: ADR-002 (games realtime), ADR-004 (auth), `SECURITY.md`

## Context

In-game chat is a social feature for player interaction during Monopoly games. Without moderation controls, the platform risks:

- Harassment and toxic behavior
- Spam and bot abuse
- Adult/inappropriate content
- Platform liability for user-generated content

## Decision

Implement a hybrid moderation approach with automated filtering and manual admin controls.

### 1. Message Rate Limiting

- Players: 5 messages per 10 seconds per game
- Spectators: Read-only (no chat access)
- WebSocket rate limiting via `WsThrottlerGuard`

### 2. Automated Content Filtering

- **Profanity filter**: Configurable word list with fuzzy matching
- **Spam detection**: Duplicate message detection within 30-second window
- **Link filtering**: Block external URLs (configurable allowlist)
- **Length limits**: Max 500 characters per message

### 3. Admin Controls

- **Mute**: Temporarily disable chat for specific players
- **Ban**: Remove chat privileges for session duration
- **Audit log**: Record all moderation actions with reasons
- **Kill switch**: Global chat disable via feature flag

### 4. Implementation

```typescript
// backend/src/games/chat/moderation.service.ts
@Injectable()
export class ChatModerationService {
  async moderateMessage(message: ChatMessage): Promise<ModerationResult> {
    const checks = await Promise.all([
      this.checkRateLimit(message.playerId),
      this.checkProfanity(message.content),
      this.checkSpam(message.playerId, message.content),
      this.checkLinks(message.content),
    ]);

    const failed = checks.find(c => !c.passed);
    if (failed) {
      return { allowed: false, reason: failed.reason };
    }

    return { allowed: true };
  }
}
```

### 5. Feature Flag

- `CHAT_ENABLED`: Global toggle (default: `true`)
- `CHAT_MODERATION_ENABLED`: Toggle automated filtering (default: `true`)
- `CHAT_ADMIN_BYPASS`: Allow admins to bypass filters (default: `false`)

### 6. Metrics

- `chat_messages_total`: Total messages sent
- `chat_messages_blocked`: Messages blocked by filters
- `chat_moderation_actions_total`: Admin moderation actions
- `chat_rate_limit_hits_total`: Rate limit violations

### 7. Error Responses

```json
{
  "error": {
    "code": "CHAT_BLOCKED",
    "message": "Message blocked by content filter",
    "details": {
      "reason": "profanity",
      "retryAfterMs": 0
    }
  }
}
```

## Consequences

### Positive
- Protects players from harassment
- Reduces platform liability
- Auditable moderation trail
- Configurable per-deployment

### Negative
- False positives on profanity filter
- Additional latency for message processing
- Storage requirements for audit logs

## Testing

- Unit tests for each moderation check
- E2E tests for chat flow with blocked messages
- Load tests for rate limiting
- Security tests for bypass attempts

## References

- `backend/docs/privacy/DATA_CATEGORIES.md`
- `backend/src/games/games.gateway.ts`
- `backend/docs/ADR-002-games-realtime-transport.md`
