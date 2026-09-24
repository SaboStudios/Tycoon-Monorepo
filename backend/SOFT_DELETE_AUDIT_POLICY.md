# Soft Delete & Audit Trail Policy

## Overview

This document outlines the soft delete and audit trail implementation for the Tycoon backend, addressing issue #389.

## Soft Delete Policy

### When to Use Soft Delete

Soft delete (logical delete) is used when historical data must be preserved for:
- Audit trails and compliance
- Financial records and reconciliation
- User activity history
- Legal requirements

**Entities using soft delete:**
- `User` - Users can be soft-deleted; history preserved for audit
- `AdminLog` - Audit records (never deleted)
- `AuditTrail` - Deletion events tracked

### When to Use Hard Delete

Hard delete (physical delete) is used only when:
- Data is temporary or non-critical
- No compliance requirements
- Explicitly approved by legal/finance teams

**Entities using hard delete:**
- Session tokens (after expiration)
- Temporary cache entries
- Non-critical logs (after retention period)

## Implementation Details

### User Soft Delete

#### Schema Changes

```sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL;
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
```

#### Query Patterns

**Active users only (default):**
```typescript
const users = await userRepository
  .createQueryBuilder('user')
  .where('user.deleted_at IS NULL')
  .getMany();
```

**Deleted users only:**
```typescript
const deletedUsers = await userRepository
  .createQueryBuilder('user')
  .where('user.deleted_at IS NOT NULL')
  .getMany();
```

**All users (including deleted):**
```typescript
const allUsers = await userRepository.find();
```

### Soft Delete Service

The `SoftDeleteService` provides utilities:

```typescript
// Soft delete (logical)
await softDeleteService.softDelete(userRepository, userId);

// Restore (admin only)
await softDeleteService.restore(userRepository, userId);

// Hard delete (permanent)
await softDeleteService.hardDelete(userRepository, userId);
```

## Audit Trail

### AuditTrail Entity

Tracks all user lifecycle events:

```typescript
enum AuditAction {
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_SOFT_DELETED = 'USER_SOFT_DELETED',
  USER_RESTORED = 'USER_RESTORED',
  USER_HARD_DELETED = 'USER_HARD_DELETED',
}
```

### Audit Log Structure

```json
{
  "id": 1,
  "userId": 123,
  "action": "USER_SOFT_DELETED",
  "userEmail": "user@example.com",
  "performedBy": 456,
  "performedByEmail": "admin@example.com",
  "changes": {
    "deleted_at": "2024-03-26T10:00:00Z"
  },
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "reason": "User requested account deletion",
  "created_at": "2024-03-26T10:00:00Z"
}
```

### Logging User Deletions

```typescript
await auditTrailService.log(AuditAction.USER_SOFT_DELETED, {
  userId: user.id,
  userEmail: user.email,
  performedBy: admin.id,
  performedByEmail: admin.email,
  changes: { deleted_at: new Date() },
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
  reason: 'User requested deletion',
});
```

## Admin Restore Path

### Endpoint

```
POST /api/v1/admin/users/:id/restore
```

### Requirements

- Admin role required
- Audit trail logged
- Reason documented

### Example

```typescript
@Post(':id/restore')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
async restoreUser(
  @Param('id') userId: number,
  @Body() { reason }: RestoreUserDto,
  @Request() req: RequestWithUser,
) {
  await this.softDeleteService.restore(this.userRepository, userId);
  
  await this.auditTrailService.log(AuditAction.USER_RESTORED, {
    userId,
    performedBy: req.user.id,
    performedByEmail: req.user.email,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    reason,
  });

  return { message: 'User restored successfully' };
}
```

## Foreign Key Constraints

### Handling Orphaned Records

When a user is soft-deleted:

1. **Direct references** - Use `ON DELETE SET NULL` or `ON DELETE RESTRICT`
2. **Audit references** - Keep intact for historical accuracy
3. **Financial records** - Never delete; use anonymization if needed

### Example Migration

```typescript
// Existing FK with hard delete
ALTER TABLE orders DROP CONSTRAINT fk_orders_user_id;
ALTER TABLE orders ADD CONSTRAINT fk_orders_user_id 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

// Audit records - no cascade
ALTER TABLE audit_trails DROP CONSTRAINT fk_audit_trails_user_id;
ALTER TABLE audit_trails ADD CONSTRAINT fk_audit_trails_user_id 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
```

## List Endpoints

### Default Behavior

All list endpoints return **active records only**:

```typescript
@Get()
async findAll(@Query() query: PaginationDto) {
  return this.userService.findActive(query);
}
```

### Include Deleted Option

Admin-only endpoint to view deleted records:

```typescript
@Get('deleted')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
async findDeleted(@Query() query: PaginationDto) {
  return this.userService.findDeleted(query);
}
```

## Testing

### Test Cases

1. **Soft delete user** - Verify `deleted_at` is set
2. **Query active users** - Verify deleted users excluded
3. **Restore user** - Verify `deleted_at` is null
4. **Audit trail** - Verify all actions logged
5. **Foreign keys** - Verify no orphaned records

### Example Test

```typescript
it('should soft delete user and log audit trail', async () => {
  const user = await userRepository.save({ email: 'test@example.com' });
  
  await softDeleteService.softDelete(userRepository, user.id);
  
  const deletedUser = await userRepository.findOne(user.id);
  expect(deletedUser.deleted_at).toBeDefined();
  
  const auditLog = await auditTrailRepository.findOne({
    where: { userId: user.id, action: AuditAction.USER_SOFT_DELETED },
  });
  expect(auditLog).toBeDefined();
});
```

## Compliance & Legal

- **GDPR**: Soft delete preserves audit trail for compliance
- **Finance**: All transactions remain traceable
- **Legal**: Deletion events documented with timestamps and actors
- **Anonymization**: Use `anonymized_id` for sensitive data if needed

## Migration Checklist

- [ ] Add `deleted_at` column to users table
- [ ] Create `audit_trails` table
- [ ] Update User entity with `@DeleteDateColumn`
- [ ] Implement `SoftDeleteService`
- [ ] Implement `AuditTrailService`
- [ ] Update user list endpoints to filter deleted
- [ ] Add admin restore endpoint
- [ ] Update foreign key constraints
- [ ] Add tests for soft delete flow
- [ ] Document in API docs
- [ ] Update user deletion endpoints
