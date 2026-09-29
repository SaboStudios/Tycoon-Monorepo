# Adding Admin Capabilities Guide

This guide provides step-by-step instructions for adding new admin-protected capabilities to the Tycoon-Monorepo backend application.

## Table of Contents

1. [Overview](#overview)
2. [Choosing the Right Guard](#choosing-the-right-guard)
3. [Using AdminGuard](#using-adminguard)
4. [Using RolesGuard](#using-rolesguard)
5. [Adding Integration Tests](#adding-integration-tests)
6. [Security Best Practices](#security-best-practices)
7. [Complete Examples](#complete-examples)
8. [In-Game Chat Moderation (ADR-1786)](#in-game-chat-moderation-adr-1786)

---

## Overview

The backend provides two primary mechanisms for protecting admin routes:

- **AdminGuard**: Simple boolean check on `user.is_admin` field
- **RolesGuard**: Role-based access control using `user.role` field with `@Roles()` decorator

Both guards should always be paired with `JwtAuthGuard` to ensure the user is authenticated first.

---

## Choosing the Right Guard

### Use AdminGuard When:
- You need simple admin-only access control
- The route should only be accessible to users with `is_admin = true`
- You don't need granular role-based permissions

### Use RolesGuard When:
- You need role-based access control (e.g., ADMIN, USER, MODERATOR)
- Multiple roles should have access to the same endpoint
- You want explicit role declarations on routes

---

## Using AdminGuard

### Step 1: Import Required Dependencies

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
```

### Step 2: Apply Guards to Controller or Route

**Option A: Protect Entire Controller**

```typescript
@ApiTags('admin-feature')
@ApiBearerAuth()
@Controller('admin/feature')
@UseGuards(JwtAuthGuard, AdminGuard)  // All routes in this controller are protected
export class AdminFeatureController {
  @Get()
  findAll() {
    // Only admins can access this
    return [];
  }

  @Post()
  create() {
    // Only admins can access this
    return {};
  }
}
```

**Option B: Protect Specific Routes**

```typescript
@ApiTags('feature')
@Controller('feature')
export class FeatureController {
  @Get()
  findAll() {
    // Public or authenticated users can access
    return [];
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)  // Only this route is admin-protected
  @ApiBearerAuth()
  create() {
    // Only admins can access this
    return {};
  }
}
```

### Step 3: Add Swagger Documentation

```typescript
@Post()
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
@ApiOperation({ summary: 'Create a new resource (Admin only)' })
@ApiResponse({ 
  status: HttpStatus.CREATED, 
  description: 'Resource created successfully.' 
})
@ApiResponse({ 
  status: HttpStatus.FORBIDDEN, 
  description: 'Admin role required.' 
})
create(@Body() createDto: CreateDto) {
  return this.service.create(createDto);
}
```

---

## Using RolesGuard

### Step 1: Import Required Dependencies

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
```

### Step 2: Apply Guards and Roles

**Single Role:**

```typescript
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
create(@Body() createDto: CreateDto) {
  // Only users with ADMIN role can access
  return this.service.create(createDto);
}
```

**Multiple Roles:**

```typescript
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MODERATOR)  // Either role can access
@ApiBearerAuth()
create(@Body() createDto: CreateDto) {
  // Users with ADMIN or MODERATOR role can access
  return this.service.create(createDto);
}
```

### Step 3: Important Notes on RolesGuard

⚠️ **CRITICAL**: RolesGuard implements default deny behavior. If you use `@UseGuards(RolesGuard)` without the `@Roles()` decorator, the route will be **DENIED** by default.

```typescript
// ❌ WRONG - This will deny all access
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)  // Missing @Roles() decorator
create() {
  return {};
}

// ✅ CORRECT - Explicitly specify required roles
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
create() {
  return {};
}
```

---

## Admin Invite & Disable (No Shared Passwords)

Admin invite and disable flows must never rely on shared or static admin passwords. Invites are issued as single-use, expiring tokens; disabling revokes access without exposing credentials.

### Rules

- **No shared passwords**: never seed, document, or transmit a common admin password. Invites use per-user, single-use tokens with a short TTL.
- **Class-level guards**: the invite/disable controller must declare `@UseGuards(JwtAuthGuard, AdminGuard)` at the class level so every route is deny-by-default.
- **Audit every mutation**: both invite and disable write an `AuditTrail` entry, including failure paths (denied, expired, invalid token).
- **Redact secrets**: admin log views and audit output must redact invite tokens, JWTs, and any credential material before rendering.

### Example: Invite/Disable Controller

```typescript
import { Controller, Post, Param, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('admin-users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminGuard)  // Class-level: deny-by-default for all routes
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Post(':id/invite')
  @ApiOperation({ summary: 'Invite an admin (single-use token, no shared password)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Invite issued.' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin role required.' })
  invite(@Param('id') id: string) {
    return this.adminUsersService.invite(id);
  }

  @Post(':id/disable')
  @ApiOperation({ summary: 'Disable an admin and revoke access' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Admin disabled.' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin role required.' })
  disable(@Param('id') id: string) {
    return this.adminUsersService.disable(id);
  }
}
```

### Example: AuditTrail on Success and Failure

```typescript
async invite(id: string, actor: AdminActor) {
  try {
    const token = await this.issueSingleUseInvite(id);
    await this.auditTrail.record({
      action: 'admin.invite',
      actorId: actor.id,
      targetId: id,
      outcome: 'success',
      // Never persist the raw token; store a redacted reference only.
      metadata: { token: redact(token) },
    });
    return { invited: true };
  } catch (err) {
    await this.auditTrail.record({
      action: 'admin.invite',
      actorId: actor.id,
      targetId: id,
      outcome: 'failure',
      metadata: { reason: err.message },
    });
    throw err;
  }
}
```

### Redaction Helper

```typescript
export function redact(value: string): string {
  if (!value) return value;
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}
```

---

## Adding Integration Tests

### Step 1: Create Test File

Create a test file in the `test/` directory following the naming convention: `feature-name.e2e-spec.ts`

### Step 2: Set Up Test Module

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';

describe('Feature Admin Access (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let nonAdminToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // Use in-memory SQLite for testing
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
          synchronize: true,
          dropSchema: true,
        }),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
        // Import your feature module
        YourFeatureModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Create test tokens
    nonAdminToken = jwtService.sign({
      sub: 1,
      email: 'user@test.com',
      role: 'user',
      is_admin: false,
    });

    adminToken = jwtService.sign({
      sub: 2,
      email: 'admin@test.com',
      role: 'admin',
      is_admin: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // Test cases here
});
```

### Step 3: Write Test Cases

**Test 403 Response for Non-Admin:**

```typescript
it('should return 403 when non-admin user accesses admin endpoint', async () => {
  const response = await request(app.getHttpServer())
    .get('/admin/feature')
    .set('Authorization', `Bearer ${nonAdminToken}`)
    .expect(403);

  expect(response.body).toHaveProperty('message');
  expect(response.body.message).toContain('Admin role required');
});
```

**Test 200 Response for Admin:**

```typescript
it('should return 200 when admin user accesses admin endpoint', async () => {
  await request(app.getHttpServer())
    .get('/admin/feature')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
});
```

**Test 401 for Unauthenticated:**

```typescript
it('should return 401 when accessing without authentication', async () => {
  await request(app.getHttpServer())
    .get('/admin/feature')
    .expect(401);
});
```

### Step 4: Run Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- admin-role-verification.e2e-spec.ts
```

---

## Security Best Practices

### 1. Always Use JwtAuthGuard First

```typescript
// ✅ CORRECT - JwtAuthGuard ensures user is authenticated
@UseGuards(JwtAuthGuard, AdminGuard)

// ❌ WRONG - AdminGuard alone doesn't verify JWT
@UseGuards(AdminGuard)
```

### 2. Use ApiBearerAuth for Swagger

```typescript
@ApiBearerAuth()  // Documents that endpoint requires JWT token
@UseGuards(JwtAuthGuard, AdminGuard)
```

### 3. Add Appropriate HTTP Status Codes

```typescript
@ApiResponse({ status: 200, description: 'Success' })
@ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
@ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
```

### 4. Never Use Shared Admin Passwords

Admin invite and disable flows must not depend on a shared or static admin password. Use per-user, single-use invite tokens with a short TTL, and revoke access on disable. Never log, document, or commit credential material.

### 5. Audit All Admin Mutations

Every admin mutation (invite, disable, role change) must write an `AuditTrail` entry, including failure paths. Redact tokens and PII in audit output and admin log views.

---

## Complete Examples

See the sections above for full controller, service, and test examples covering AdminGuard, RolesGuard, invite/disable, and audit trails.

---

## In-Game Chat Moderation (ADR-1786)

See ADR-1786 for in-game chat moderation details.
