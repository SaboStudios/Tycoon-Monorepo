# STRIDE Threat Model: Tycoon Monorepo

## Overview

This document maps STRIDE threat categories to specific controls in the Tycoon platform. It serves as a reference for security reviews and incident response.

## Threat Categories & Controls

### Spoofing (Identity)

| Threat | Control | Implementation |
|--------|---------|----------------|
| JWT token forgery | RS256 signature verification | `backend/src/auth/ws-jwt.guard.ts` |
| Session hijacking | HttpOnly secure cookies + short TTL | `backend/src/auth/auth.service.ts` |
| Identity impersonation | Server-side seat validation per ADR-002 | `backend/src/games/games.gateway.ts:66` |
| Replay attacks | Idempotency keys on all mutations | `game:roll`, `game:buy` handlers |

### Tampering (Integrity)

| Threat | Control | Implementation |
|--------|---------|----------------|
| Client-side rule override | Ruleset hash pinned per game row | `board-tile-model.ts:computeRulesetHash()` |
| State mutation bypass | Server-authoritative game state | `BOARD_TILE_MODEL` constants |
| Database tampering | Transactional applies with event emission | `ApplyResult` pattern |
| WebSocket message injection | WsJwtGuard + room-scoped broadcasts | `GamesGateway` |

### Repudiation (Accountability)

| Threat | Control | Implementation |
|--------|---------|----------------|
| Action denial | Game event log with timestamps | `GameEvent` type union |
| Audit trail gaps | Structured logging per action | `backend/src/common/logger.ts` |
| Admin action opacity | Admin role verification + logging | `backend/src/admin/` |

### Information Disclosure (Confidentiality)

| Threat | Control | Implementation |
|--------|---------|----------------|
| Hidden card leakage | Spectator receives limited snapshot | `getSnapshot(gameId, role)` |
| Token in logs | Redaction middleware | `backend/src/shared-middleware/` |
| PII exposure | No PII in telemetry labels | Logging guidelines |
| Spectator sees private state | Role-based snapshot filtering | `GamesService.getSnapshot()` |

### Denial of Service (Availability)

| Threat | Control | Implementation |
|--------|---------|----------------|
| WebSocket flooding | Rate-limit join/roll actions | `backend/src/games/rate-limit/` |
| Resource exhaustion | Request size limits | Express body limits |
| Dependency outage | Fail-closed on Postgres/Redis/RPC | `GamesService` error handling |
| Concurrent duplicate requests | Idempotency key validation | Action handlers |

### Elevation of Privilege (Authorization)

| Threat | Control | Implementation |
|--------|---------|----------------|
| Spectator rolling dice | Role check before action | `FORBIDDEN_SPECTATOR` error |
| Unauthorized seat occupation | Seat authorization on join | `authorizeJoin()` |
| Admin bypass | JWT role claim verification | `WsJwtGuard` |
| Cross-game actions | gameId-scoped room membership | Room-based isolation |

## Implementation Checklist

- [x] JWT verification on WS handshake
- [x] Server-authoritative game state
- [x] Idempotency keys on mutations
- [x] Rate limiting on external entrypoints
- [x] Role-based snapshot filtering
- [x] Structured error codes
- [x] Audit logging
- [ ] Penetration testing (scheduled)
- [ ] Load testing for WS gateway

## Incident Response

1. **Token compromise**: Rotate JWT secrets, invalidate all sessions
2. **State corruption**: Restore from last valid snapshot, replay events
3. **WS abuse**: Block IP range, scale gateway instances
4. **Data breach**: Follow SECURITY.md disclosure process

## References

- `SECURITY.md` - Vulnerability reporting
- `backend/docs/ADR-002-games-realtime-transport.md` - WebSocket architecture
- `backend/docs/AUTH_JWT_RUNBOOK.md` - JWT implementation
- `backend/docs/CORS_SECURITY_GUIDE.md` - CORS configuration
