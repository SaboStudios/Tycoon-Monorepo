# Admin User Management Module - NestJS

A comprehensive admin user management module built with NestJS, featuring user control, audit logging, and role-based access control.

## Features

✅ View users with pagination
✅ Search and filter users by email, name, role, and status
✅ Suspend/activate user accounts
✅ Change user roles (USER, ADMIN, MODERATOR)
✅ Reset user passwords
✅ Complete audit logging for all admin actions
✅ Role-based access control (Admin only)
✅ Comprehensive unit and E2E tests

## Installation

```bash
npm install
```

## Database Setup

1. Create a PostgreSQL database
2. Copy `.env.example` to `.env` and configure your database credentials

```bash
cp .env.example .env
```

## Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start
```

## Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## API Endpoints

All endpoints require admin authentication via JWT Bearer token.

### Get All Users (Paginated)

```
GET /admin/users?page=1&limit=10&search=john&role=user&status=active
```

### Get Single User

```
GET /admin/users/:id
```

### Update User Role

```
PATCH /admin/users/:id/role
Body: { "role": "admin" }
```

### Update User Status

```
PATCH /admin/users/:id/status
Body: { "status": "suspended" }
```

### Reset User Password

```
POST /admin/users/:id/reset-password
Body: { "newPassword": "newPassword123" }
```

### Get User Audit Logs

```
GET /admin/users/:id/audit-logs?page=1&limit=10
```

## User Roles

- `user` - Regular user
- `moderator` - Moderator with elevated permissions
- `admin` - Full administrative access

## User Status

- `active` - User can access the system
- `suspended` - User is blocked from accessing the system

## Audit Logging

All admin actions are automatically logged with:

- Action type (role_changed, user_suspended, etc.)
- Target user
- Admin who performed the action
- Metadata (old/new values)
- Timestamp

## Architecture

- **Entities**: User, AuditLog
- **DTOs**: Query validation and transformation
- **Guards**: JWT authentication and role-based authorization
- **Service**: Business logic and database operations
- **Controller**: REST API endpoints

## Testing

The module includes comprehensive tests:

- Unit tests for service and controller
- E2E tests for all endpoints
- Test coverage for all features

All tests pass including CI/CD pipeline requirements.
