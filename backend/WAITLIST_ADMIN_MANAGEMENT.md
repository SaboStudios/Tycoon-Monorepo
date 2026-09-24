# Waitlist Admin Management Feature

## Overview
This feature allows administrators to manage waitlist entries with full CRUD operations, soft delete support, and comprehensive audit logging.

## Features Implemented

### 1. Update Endpoint
**Endpoint:** `PATCH /admin/waitlist/:id`

**Description:** Update an existing waitlist entry.

**Authentication:** Requires JWT token and admin role.

**Request Body:**
```json
{
  "wallet_address": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "email_address": "newemail@example.com",
  "telegram_username": "@newusername"
}
```

**Validation:**
- At least one field must be provided
- Email must be valid format
- Telegram username must start with @ and be 5-32 characters
- Checks for duplicate wallet/email addresses

**Response:** Returns updated waitlist entry

**Audit Log:** Creates log entry with action `waitlist:update`

### 2. Soft Delete Endpoint
**Endpoint:** `DELETE /admin/waitlist/:id`

**Description:** Soft delete a waitlist entry (marks as deleted but keeps in database).

**Authentication:** Requires JWT token and admin role.

**Response:** 204 No Content

**Audit Log:** Creates log entry with action `waitlist:soft_delete`

### 3. Hard Delete Endpoint
**Endpoint:** `DELETE /admin/waitlist/:id/permanent`

**Description:** Permanently delete a waitlist entry from the database.

**Authentication:** Requires JWT token and admin role.

**Response:** 204 No Content

**Audit Log:** Creates log entry with action `waitlist:hard_delete`

### 4. Soft Delete Support
- Added `deleted_at` column to waitlist table
- Uses TypeORM's `@DeleteDateColumn` decorator
- Soft deleted entries are automatically excluded from queries
- Can be restored if needed

### 5. Audit Logs
All admin actions are tracked with:
- Admin ID (who performed the action)
- Action type (`waitlist:update`, `waitlist:soft_delete`, `waitlist:hard_delete`)
- Target ID (waitlist entry ID)
- Details (for updates, includes the changes made)
- IP address
- User agent
- Timestamp

## Database Changes

### Migration: AddSoftDeleteToWaitlist
**File:** `1740437000000-AddSoftDeleteToWaitlist.ts`

Adds `deleted_at` column to the `waitlist` table:
```sql
ALTER TABLE waitlist ADD COLUMN deleted_at TIMESTAMP NULL;
```

## Files Created/Modified

### Created Files:
1. `dto/update-waitlist.dto.ts` - DTO for update requests
2. `database/migrations/1740437000000-AddSoftDeleteToWaitlist.ts` - Migration for soft delete
3. `waitlist-admin-update-delete.controller.spec.ts` - Controller tests
4. `waitlist-update-delete.service.spec.ts` - Service tests

### Modified Files:
1. `entities/waitlist.entity.ts` - Added `deleted_at` column
2. `waitlist.service.ts` - Added update, softDelete, hardDelete methods
3. `waitlist-admin.controller.ts` - Added update and delete endpoints
4. `waitlist.module.ts` - Imported AdminLogsModule

## Security

### Authorization
- All endpoints require JWT authentication
- All endpoints require admin role
- Rate limiting applied:
  - Update: 30 requests per 60 seconds
  - Soft Delete: 30 requests per 60 seconds
  - Hard Delete: 10 requests per 60 seconds (more restrictive)

### Validation
- Input validation using class-validator
- Duplicate checking for unique fields
- At least one field required for updates

## Usage Examples

### Update a Waitlist Entry
```bash
curl -X PATCH https://api.example.com/admin/waitlist/123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email_address": "newemail@example.com"
  }'
```

### Soft Delete an Entry
```bash
curl -X DELETE https://api.example.com/admin/waitlist/123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Permanently Delete an Entry
```bash
curl -X DELETE https://api.example.com/admin/waitlist/123/permanent \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Testing

Run the tests:
```bash
npm test -- waitlist-admin-update-delete.controller.spec.ts
npm test -- waitlist-update-delete.service.spec.ts
```

## Acceptance Criteria ✅

- [x] **Only admins can modify data** - All endpoints protected by JwtAuthGuard and AdminGuard
- [x] **Changes tracked** - All actions logged to admin_logs table with full audit trail
- [x] **Update endpoint** - PATCH /admin/waitlist/:id implemented
- [x] **Delete endpoint** - DELETE /admin/waitlist/:id (soft) and /admin/waitlist/:id/permanent (hard)
- [x] **Soft delete support** - deleted_at column added, TypeORM soft delete enabled
- [x] **Audit logs** - Integration with AdminLogsService for all operations

## Future Enhancements

1. Restore soft-deleted entries endpoint
2. Bulk update/delete operations
3. Export audit logs for specific waitlist entries
4. Email notifications to users when their entry is updated
5. Admin dashboard showing recent changes
