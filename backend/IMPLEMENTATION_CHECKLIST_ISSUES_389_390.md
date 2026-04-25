# Implementation Checklist - Issues #389 & #390

## Issue #390: Nested Express/Nest Services - Shared Auth & Logging Middleware

### Shared Middleware Package
- [x] Create `backend/src/shared-middleware/` package
- [x] Implement JWT middleware with consistent validation
- [x] Implement HTTP logger middleware with structured logging
- [x] Implement error handler middleware with unified response format
- [x] Implement health check middleware
- [x] Create JWT configuration module
- [x] Create logger configuration module
- [x] Export types: `RequestWithUser`, `ErrorResponse`
- [x] Create `package.json` with dependencies
- [x] Create `tsconfig.json` for TypeScript compilation

### Service Classification
- [x] Document production services:
  - Admin Shop Management APIs (port 3001)
  - Theme Marketplace Integration (port 3002)
  - User Management (Admin) (port 3003)
  - Shop Analytics Dashboard (port 3004)
- [x] Document demo/development services (none currently)

### Health Endpoints
- [x] Create health check middleware with service metadata
- [x] Support custom health checks (database, Redis, etc.)
- [x] Return consistent health response format
- [x] Support healthy/degraded/unhealthy states

### Documentation
- [x] Create `SHARED_MIDDLEWARE_GUIDE.md` with:
  - Integration guide for each service
  - Environment variable setup
  - Health endpoint format
  - Error response format
  - JWT validation flow
  - Request logging format
  - Secret configuration best practices
  - Troubleshooting guide

### Smoke Test Script
- [x] Create `backend/scripts/smoke-test.sh`
- [x] Test health endpoints on all services
- [x] Test JWT validation
- [x] Test error response format
- [x] Test CORS headers
- [x] Make script executable

### Configuration Management
- [x] Implement JWT secret validation
- [x] Implement logger configuration
- [x] Document environment variables
- [x] Avoid hardcoded secrets

### Next Steps (To Be Done)
- [ ] Build shared middleware package: `npm run build`
- [ ] Integrate into Admin Shop Management APIs
- [ ] Integrate into Theme Marketplace Integration
- [ ] Integrate into User Management (Admin)
- [ ] Integrate into Shop Analytics Dashboard
- [ ] Run smoke tests
- [ ] Deploy to staging
- [ ] Monitor health endpoints in production

---

## Issue #389: Soft Delete vs Hard Delete Policy

### Schema Changes
- [x] Create migration: `AddSoftDeleteToUsers`
  - Add `deleted_at` column to users table
  - Create index on `deleted_at`
- [x] Create migration: `CreateAuditTrailTable`
  - Create `audit_trails` table with all required columns
  - Create indexes for performance

### User Entity Updates
- [x] Add `@DeleteDateColumn` to User entity
- [x] Add index on `deleted_at`
- [x] Import `DeleteDateColumn` from TypeORM

### Soft Delete Service
- [x] Create `SoftDeleteService` with methods:
  - `applyActiveFilter()` - Filter active records
  - `applyDeletedFilter()` - Filter deleted records
  - `softDelete()` - Logical delete
  - `restore()` - Restore deleted record (admin only)
  - `hardDelete()` - Physical delete

### Audit Trail Implementation
- [x] Create `AuditTrail` entity with:
  - User ID and email
  - Action type (enum)
  - Performed by (admin ID and email)
  - Changes (JSONB)
  - IP address and user agent
  - Reason for action
  - Timestamp
- [x] Create `AuditTrailService` with methods:
  - `log()` - Log audit event
  - `getUserAuditTrail()` - Get user's audit history
  - `getAuditTrailByAction()` - Get events by action type
- [x] Create `AuditTrailModule`
- [x] Add `AuditTrailModule` to `AppModule`

### Query Patterns
- [x] Document active-only queries (default)
- [x] Document deleted-only queries
- [x] Document all-records queries

### Admin Restore Path
- [x] Document restore endpoint: `POST /api/v1/admin/users/:id/restore`
- [x] Document requirements (admin role, audit logging)
- [x] Document reason parameter

### Foreign Key Constraints
- [x] Document handling of orphaned records
- [x] Document `ON DELETE SET NULL` vs `ON DELETE RESTRICT`
- [x] Document audit record constraints

### List Endpoints
- [x] Document default behavior (active only)
- [x] Document admin-only deleted records endpoint
- [x] Document query patterns

### Documentation
- [x] Create `SOFT_DELETE_AUDIT_POLICY.md` with:
  - When to use soft delete vs hard delete
  - Schema changes
  - Query patterns
  - Audit trail structure
  - Admin restore path
  - Foreign key handling
  - List endpoint behavior
  - Testing guidelines
  - Compliance notes

### Testing
- [ ] Test soft delete user
- [ ] Test query active users (excludes deleted)
- [ ] Test restore user
- [ ] Test audit trail logging
- [ ] Test foreign key constraints
- [ ] Test list endpoints (active only by default)
- [ ] Test admin restore endpoint
- [ ] Test audit trail queries

### Integration with Services
- [ ] Update User service to use soft delete
- [ ] Update user list endpoints to filter deleted
- [ ] Add admin restore endpoint
- [ ] Add audit logging to user deletion
- [ ] Update foreign key constraints
- [ ] Update tests

### Compliance & Legal
- [x] Document GDPR compliance
- [x] Document finance/audit requirements
- [x] Document legal requirements
- [x] Document anonymization approach

### Next Steps (To Be Done)
- [ ] Run migrations
- [ ] Update User service implementation
- [ ] Update user list endpoints
- [ ] Add admin restore endpoint
- [ ] Add audit logging to deletion flow
- [ ] Update foreign key constraints
- [ ] Add comprehensive tests
- [ ] Deploy to staging
- [ ] Verify audit trail logging

---

## Testing Checklist

### Issue #390 Tests
- [ ] Smoke test script runs successfully
- [ ] All health endpoints return 200
- [ ] JWT validation rejects unauthorized requests
- [ ] Error responses have consistent format
- [ ] CORS headers are present

### Issue #389 Tests
- [ ] Soft delete sets `deleted_at` timestamp
- [ ] Active user queries exclude deleted users
- [ ] Deleted user queries include only deleted users
- [ ] Restore endpoint sets `deleted_at` to null
- [ ] Audit trail logs all user lifecycle events
- [ ] Foreign key constraints prevent orphaned records
- [ ] Admin restore endpoint requires admin role
- [ ] Audit trail includes IP address and user agent

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation reviewed
- [ ] Smoke tests passing
- [ ] No breaking changes to existing APIs

### Staging Deployment
- [ ] Deploy migrations
- [ ] Deploy shared middleware package
- [ ] Deploy updated services
- [ ] Run smoke tests
- [ ] Monitor health endpoints
- [ ] Verify audit trail logging

### Production Deployment
- [ ] Backup database
- [ ] Deploy migrations
- [ ] Deploy shared middleware package
- [ ] Deploy updated services
- [ ] Run smoke tests
- [ ] Monitor logs and metrics
- [ ] Verify audit trail logging
- [ ] Document deployment in runbook

---

## Documentation Status

### Completed
- [x] `SHARED_MIDDLEWARE_GUIDE.md` - Complete integration guide
- [x] `SOFT_DELETE_AUDIT_POLICY.md` - Complete policy documentation
- [x] `IMPLEMENTATION_CHECKLIST_ISSUES_389_390.md` - This file

### To Be Updated
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Runbook for operations team
- [ ] Architecture diagram
- [ ] Database schema diagram

---

## Notes

### Issue #390 - Shared Middleware
- Shared middleware package is ready for integration
- Each service needs to be updated individually
- Environment variables must be set for each service
- Health endpoints should be tested after integration

### Issue #389 - Soft Delete & Audit Trail
- Migrations are ready to run
- Soft delete service is ready to use
- Audit trail service is ready to use
- User service needs to be updated to use soft delete
- All user deletion endpoints need to log audit events

### Timeline
- Shared middleware integration: 2-3 hours per service
- Soft delete implementation: 4-6 hours
- Testing and validation: 2-3 hours
- Total estimated time: 12-18 hours

### Risks & Mitigations
- **Risk**: Breaking existing APIs
  - **Mitigation**: Comprehensive testing, gradual rollout
- **Risk**: Data loss during migration
  - **Mitigation**: Database backup, rollback plan
- **Risk**: Performance impact from audit logging
  - **Mitigation**: Async logging, database indexing
