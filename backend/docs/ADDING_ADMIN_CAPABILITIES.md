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

### 4. Use Rate Limiting

Apply rate limiting to admin endpoints to prevent abuse:

```typescript
import { Throttle } from '@nestjs/throttler';

@Post()
@UseGuards(JwtAuthGuard, AdminGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })  // 10 requests per minute
create(@Body() createDto: CreateDto) {
  return this.service.create(createDto);
}
```

### 5. Log Admin Actions

Always log admin actions for audit purposes:

```typescript
import { Logger } from '@nestjs/common';

private readonly logger = new Logger(AdminFeatureController.name);

@Post()
@UseGuards(JwtAuthGuard, AdminGuard)
create(@Body() createDto: CreateDto, @Req() req: Request) {
  this.logger.log(`Admin action: create by user ${req.user.sub}`);
  return this.service.create(createDto);
}
```

---

## Complete Examples

### Example 1: Admin-Only CRUD Controller

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('admin-items')
@ApiBearerAuth()
@Controller('admin/items')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  @ApiOperation({ summary: 'List all items (Admin only)' })
  @ApiResponse({ status: 200, description: 'Items retrieved successfully.' })
  @ApiResponse({ status: 403, description: 'Admin role required.' })
  findAll() {
    return this.itemsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create item (Admin only)' })
  @ApiResponse({ status: 201, description: 'Item created successfully.' })
  @ApiResponse({ status: 403, description: 'Admin role required.' })
  create(@Body() createDto: CreateItemDto) {
    return this.itemsService.create(createDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update item (Admin only)' })
  @ApiResponse({ status: 200, description: 'Item updated successfully.' })
  @ApiResponse({ status: 404, description: 'Item not found.' })
  @ApiResponse({ status: 403, description: 'Admin role required.' })
  update(@Param('id') id: string, @Body() updateDto: UpdateItemDto) {
    return this.itemsService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete item (Admin only)' })
  @ApiResponse({ status: 200, description: 'Item deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Item not found.' })
  @ApiResponse({ status: 403, description: 'Admin role required.' })
  remove(@Param('id') id: string) {
    return this.itemsService.remove(id);
  }
}
```

### Example 2: Role-Based Access with Multiple Roles

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@ApiTags('moderation')
@ApiBearerAuth()
@Controller('moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModerationController {
  @Post('flag')
  @Roles(Role.ADMIN, Role.MODERATOR)
  flagContent(@Body() flagDto: FlagContentDto) {
    return this.moderationService.flag(flagDto);
  }

  @Post('ban')
  @Roles(Role.ADMIN)  // Only admins can ban
  banUser(@Body() banDto: BanUserDto) {
    return this.moderationService.ban(banDto);
  }
}
```

---

## In-Game Chat Moderation (ADR-1786)

This section documents the invariants and implementation guidance for in-game chat moderation, per issue #1786. It is the source of truth for chat abuse controls until a dedicated ADR supersedes it.

### Invariants

1. **Server authority**: The backend is the sole source of truth for chat moderation state. Clients (including the NEAR wallet UI) may request moderation actions but never mutate moderation state directly. Per ADR-003, NEAR is the only supported chain UI until Stellar is gated ready; no chat moderation path may claim Stellar readiness.
2. **Deny-by-default**: Every moderation entrypoint (REST or WS) must be guarded by `JwtAuthGuard` plus `AdminGuard` or `RolesGuard` with an explicit `@Roles(...)` declaration. Missing role metadata denies access.
3. **Fail-closed on writes**: If Postgres, Redis, or the shop-api dependency is unavailable, moderation writes (mute, ban, message delete) must reject rather than partially apply. Reads may degrade, writes may not.
4. **Idempotency**: Moderation actions must be idempotent under retries and WS reconnects. Duplicate requests for the same target/action must not double-apply or emit duplicate fanout.
5. **Explicit disable**: Chat may be explicitly disabled via a feature flag/kill switch. When disabled, the server rejects chat sends and moderation writes with a stable error code, and the client must not present chat as available.

### Error codes

Moderation endpoints must return errors aligned with `docs/API_ERROR_RESPONSE_STANDARDS.md`:

- `401` — unauthenticated (missing/expired JWT).
- `403` — authenticated but lacking `ADMIN`/`MODERATOR` role (deny-by-default).
- `409` — conflicting duplicate moderation action when idempotency key is reused with a different payload.
- `422` — invalid or adversarial input (unknown target, oversized payload, spoofed event).
- `503` — dependency outage on a write path (fail-closed).

All error responses must include the `requestId`/correlation id so operators can trace the action.

### Authz wiring

```typescript
@ApiTags('moderation')
@ApiBearerAuth()
@Controller('moderation/chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatModerationController {
  @Post('mute')
  @Roles(Role.ADMIN, Role.MODERATOR)
  mute(@Body() dto: MuteChatDto) {
    // Server-authoritative; never trust client-supplied actor identity.
    return this.chatModerationService.mute(dto);
  }
}
```

WS moderation events must perform the same seat/role check server-side before applying any action; never trust a client-asserted role.

### Observability

- Emit structured logs with `requestId`/correlation id on every moderation action.
- Emit metrics for moderation actions and chat-disable toggles (money/realtime-adjacent).
- Redact tokens and avoid PII in telemetry labels (use opaque user ids, not emails).

### Feature flag / kill switch

Chat and moderation writes must be gated behind a feature flag so operators can explicitly disable chat. When disabled, the server fails closed on chat sends and moderation writes and the client must reflect the disabled state rather than implying chat is available.

### Rollback

Disabling the chat feature flag reverts player-facing behavior without a deploy. Moderation writes are additive and idempotent, so rollback does not require data migration.
