# Waitlist Admin API - Quick Reference

## Authentication
All endpoints require:
- **Header:** `Authorization: Bearer <JWT_TOKEN>`
- **Role:** Admin

## Endpoints

### 1. Update Waitlist Entry

```http
PATCH /admin/waitlist/:id
Content-Type: application/json
Authorization: Bearer <token>

{
  "wallet_address": "GXXXXXXX...",
  "email_address": "user@example.com",
  "telegram_username": "@username"
}
```

**Response (200):**
```json
{
  "id": 123,
  "wallet_address": "GXXXXXXX...",
  "email_address": "user@example.com",
  "telegram_username": "@username",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-02T00:00:00.000Z",
  "deleted_at": null
}
```

**Errors:**
- `400` - Entry not found or validation failed
- `401` - Not authenticated
- `403` - Not an admin
- `409` - Duplicate wallet/email

---

### 2. Soft Delete Entry

```http
DELETE /admin/waitlist/:id
Authorization: Bearer <token>
```

**Response:** `204 No Content`

**Errors:**
- `400` - Entry not found
- `401` - Not authenticated
- `403` - Not an admin

---

### 3. Permanently Delete Entry

```http
DELETE /admin/waitlist/:id/permanent
Authorization: Bearer <token>
```

**Response:** `204 No Content`

**Errors:**
- `400` - Entry not found
- `401` - Not authenticated
- `403` - Not an admin

---

## Validation Rules

### Update DTO
- **At least one field required**
- `wallet_address`: String (optional)
- `email_address`: Valid email format (optional)
- `telegram_username`: Must start with `@`, 5-32 chars, alphanumeric + underscore (optional)

## Rate Limits
- Update: 30 requests per 60 seconds
- Soft Delete: 30 requests per 60 seconds
- Hard Delete: 10 requests per 60 seconds

## Audit Logs

All actions are logged to `admin_logs` table:

```json
{
  "adminId": 10,
  "action": "waitlist:update",
  "targetId": 123,
  "details": {
    "changes": {
      "email_address": "newemail@example.com"
    }
  },
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "createdAt": "2024-01-02T00:00:00.000Z"
}
```

### Action Types
- `waitlist:update` - Entry updated
- `waitlist:soft_delete` - Entry soft deleted
- `waitlist:hard_delete` - Entry permanently deleted

## Examples

### cURL Examples

**Update:**
```bash
curl -X PATCH "https://api.example.com/admin/waitlist/123" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{"email_address": "new@example.com"}'
```

**Soft Delete:**
```bash
curl -X DELETE "https://api.example.com/admin/waitlist/123" \
  -H "Authorization: Bearer eyJhbGc..."
```

**Hard Delete:**
```bash
curl -X DELETE "https://api.example.com/admin/waitlist/123/permanent" \
  -H "Authorization: Bearer eyJhbGc..."
```

### JavaScript/TypeScript Example

```typescript
const API_URL = 'https://api.example.com';
const token = 'your-jwt-token';

// Update entry
async function updateWaitlistEntry(id: number, data: any) {
  const response = await fetch(`${API_URL}/admin/waitlist/${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

// Soft delete
async function softDeleteEntry(id: number) {
  await fetch(`${API_URL}/admin/waitlist/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

// Hard delete
async function hardDeleteEntry(id: number) {
  await fetch(`${API_URL}/admin/waitlist/${id}/permanent`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}
```

## Testing

Use the Swagger UI at `/api/docs` to test endpoints interactively.
