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

### 4. Use Rate Limiting for Admin Endpoints

```typescript
import { Throttle } from '@nestjs/throttler';

@Post()
@UseGuards(JwtAuthGuard, AdminGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })  // 10 requests per minute
create() {
  return {};
}
```

### 5. Log Admin Actions

```typescript
import { AdminLogsService } from '../admin-logs/admin-logs.service';

@Delete(':id')
@UseGuards(JwtAuthGuard, AdminGuard)
async remove(
  @Param('id') id: number,
  @Request() req: { user: { id: number } },
) {
  const result = await this.service.remove(id);
  
  // Log admin action
  await this.adminLogsService.createLog(
    req.user.id,
    'resource:delete',
    id,
    null,
    req,
  );
  
  return result;
}
```

### 6. Validate Input Data

```typescript
import { ValidationPipe } from '@nestjs/common';

@Post()
@UseGuards(JwtAuthGuard, AdminGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
create(@Body() createDto: CreateDto) {
  return this.service.create(createDto);
}
```

### 7. Use DTOs with Class Validator

```typescript
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateResourceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
```

---

## Complete Examples

### Example 1: Simple Admin-Only Controller

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ResourceService } from './resource.service';
import { CreateResourceDto } from './dto/create-resource.dto';

@ApiTags('admin-resources')
@ApiBearerAuth()
@Controller('admin/resources')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Get()
  @ApiOperation({ summary: 'List all resources (Admin only)' })
  @ApiResponse({ status: 200, description: 'Resources retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  findAll() {
    return this.resourceService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new resource (Admin only)' })
  @ApiResponse({ status: 201, description: 'Resource created successfully' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  create(@Body() createDto: CreateResourceDto) {
    return this.resourceService.create(createDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a resource (Admin only)' })
  @ApiResponse({ status: 204, description: 'Resource deleted successfully' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  remove(@Param('id') id: number) {
    return this.resourceService.remove(id);
  }
}
```

### Example 2: Mixed Public and Admin Routes

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ResourceService } from './resource.service';
import { CreateResourceDto } from './dto/create-resource.dto';

@ApiTags('resources')
@Controller('resources')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  // Public endpoint - no guards
  @Get()
  @ApiOperation({ summary: 'List all resources (Public)' })
  findAll() {
    return this.resourceService.findAll();
  }

  // Authenticated endpoint - JwtAuthGuard only
  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my resources (Authenticated users)' })
  findMy(@Request() req: { user: { id: number } }) {
    return this.resourceService.findByUserId(req.user.id);
  }

  // Admin-only endpoint
  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a resource (Admin only)' })
  create(@Body() createDto: CreateResourceDto) {
    return this.resourceService.create(createDto);
  }
}
```

### Example 3: Role-Based Access with Multiple Roles

```typescript
import {
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('content')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContentController {
  // Only admins can create
  @Post()
  @Roles(Role.ADMIN)
  create() {
    return { message: 'Content created' };
  }

  // Admins and moderators can approve
  @Post('approve')
  @Roles(Role.ADMIN, Role.MODERATOR)
  approve() {
    return { message: 'Content approved' };
  }

  // All authenticated users can view
  @Get()
  @Roles(Role.ADMIN, Role.MODERATOR, Role.USER)
  findAll() {
    return [];
  }
}
```

---

## Checklist for Adding New Admin Capability

- [ ] Choose appropriate guard (AdminGuard or RolesGuard)
- [ ] Import required dependencies
- [ ] Apply `JwtAuthGuard` first, then admin guard
- [ ] Add `@ApiBearerAuth()` decorator
- [ ] Add Swagger documentation (`@ApiOperation`, `@ApiResponse`)
- [ ] Implement rate limiting if needed
- [ ] Add admin action logging if modifying data
- [ ] Create integration tests for 403 responses
- [ ] Test with both admin and non-admin users
- [ ] Update `ADMIN_ROUTES_MATRIX.md` documentation
- [ ] Run all tests to ensure no regressions

---

## Troubleshooting

### Issue: Getting 401 instead of 403

**Cause**: `JwtAuthGuard` is failing before `AdminGuard` can check admin status.

**Solution**: Ensure JWT token is valid and includes required fields (`sub`, `email`, `role`, `is_admin`).

### Issue: RolesGuard always denies access

**Cause**: Missing `@Roles()` decorator.

**Solution**: Add `@Roles(Role.ADMIN)` or appropriate roles to the route.

### Issue: Tests failing with database errors

**Cause**: Missing entities or incorrect database configuration.

**Solution**: Ensure all required entities are imported in test module and database is properly initialized.

---

## Additional Resources

- [NestJS Guards Documentation](https://docs.nestjs.com/guards)
- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [Admin Routes Matrix](./ADMIN_ROUTES_MATRIX.md)
- [JWT Authentication Guide](./TOKEN_REFRESH_SECURITY_GUIDE.md)

---

## Questions or Issues?

If you encounter any issues or have questions about adding admin capabilities, please:

1. Review this guide thoroughly
2. Check existing admin controllers for reference
3. Review the integration tests in `test/admin-role-verification.e2e-spec.ts`
4. Consult the team's security guidelines

---

**Last Updated**: 2024  
**Maintained By**: Backend Team
