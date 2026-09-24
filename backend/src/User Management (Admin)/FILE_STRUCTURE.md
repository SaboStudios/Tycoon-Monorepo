# Project File Structure

```
admin-user-management/
│
├── .github/
│   └── workflows/
│       └── ci.yml                          # GitHub Actions CI/CD pipeline
│
├── scripts/
│   ├── run-all-tests.bat                   # Windows test runner
│   ├── run-all-tests.sh                    # Linux/Mac test runner
│   ├── setup-test-db.bat                   # Windows DB setup
│   └── setup-test-db.sh                    # Linux/Mac DB setup
│
├── src/
│   ├── auth/                               # Authentication & Authorization
│   │   ├── auth.module.ts                  # Auth module configuration
│   │   ├── jwt-auth.guard.ts               # JWT authentication guard
│   │   ├── jwt-auth.guard.spec.ts          # Guard tests
│   │   ├── jwt.strategy.ts                 # JWT validation strategy
│   │   ├── jwt.strategy.spec.ts            # Strategy tests
│   │   ├── roles.decorator.ts              # Roles metadata decorator
│   │   ├── roles.guard.ts                  # Role-based access guard
│   │   └── roles.guard.spec.ts             # Guard tests
│   │
│   ├── users/                              # User Management Module
│   │   ├── dto/                            # Data Transfer Objects
│   │   │   ├── query-users.dto.ts          # Pagination & filter DTO
│   │   │   ├── query-users.dto.spec.ts     # DTO validation tests
│   │   │   ├── reset-password.dto.ts       # Password reset DTO
│   │   │   ├── reset-password.dto.spec.ts  # DTO validation tests
│   │   │   ├── update-user-role.dto.ts     # Role update DTO
│   │   │   └── update-user-status.dto.ts   # Status update DTO
│   │   │
│   │   ├── entities/                       # Database Entities
│   │   │   ├── audit-log.entity.ts         # Audit log entity
│   │   │   └── user.entity.ts              # User entity
│   │   │
│   │   ├── users.controller.ts             # REST API endpoints
│   │   ├── users.controller.spec.ts        # Controller unit tests
│   │   ├── users.module.ts                 # Users module configuration
│   │   ├── users.service.ts                # Business logic
│   │   └── users.service.spec.ts           # Service unit tests
│   │
│   ├── app.module.ts                       # Root application module
│   └── main.ts                             # Application entry point
│
├── test/
│   ├── jest-e2e.json                       # E2E test configuration
│   └── users.e2e-spec.ts                   # E2E integration tests
│
├── .env.example                            # Environment variables template
├── .gitignore                              # Git ignore patterns
├── FILE_STRUCTURE.md                       # This file
├── IMPLEMENTATION_CHECKLIST.md             # Feature checklist
├── jest.config.js                          # Jest unit test config
├── nest-cli.json                           # NestJS CLI configuration
├── package.json                            # Dependencies & scripts
├── PROJECT_SUMMARY.md                      # Implementation summary
├── QUICK_START.md                          # Quick start guide
├── README.md                               # Main documentation
├── TESTING.md                              # Testing guide
└── tsconfig.json                           # TypeScript configuration
```

## File Count Summary

- **Source Files**: 17
- **Test Files**: 9
- **Configuration Files**: 6
- **Documentation Files**: 6
- **Script Files**: 4
- **Total Files**: 42+

## Key Files by Purpose

### Core Application

- `src/main.ts` - Application bootstrap
- `src/app.module.ts` - Root module with DB config
- `src/users/users.module.ts` - Users feature module
- `src/auth/auth.module.ts` - Authentication module

### Business Logic

- `src/users/users.service.ts` - User management logic
- `src/users/users.controller.ts` - REST API endpoints

### Data Models

- `src/users/entities/user.entity.ts` - User database model
- `src/users/entities/audit-log.entity.ts` - Audit log model

### Security

- `src/auth/jwt.strategy.ts` - JWT validation
- `src/auth/jwt-auth.guard.ts` - Authentication guard
- `src/auth/roles.guard.ts` - Authorization guard
- `src/auth/roles.decorator.ts` - Role metadata

### Validation

- `src/users/dto/*.dto.ts` - Input validation DTOs

### Testing

- `src/**/*.spec.ts` - Unit tests (32+ tests)
- `test/users.e2e-spec.ts` - E2E tests (15+ tests)

### Configuration

- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript compiler options
- `jest.config.js` - Unit test configuration
- `test/jest-e2e.json` - E2E test configuration
- `nest-cli.json` - NestJS CLI settings
- `.env.example` - Environment template

### CI/CD

- `.github/workflows/ci.yml` - GitHub Actions pipeline

### Documentation

- `README.md` - Main documentation
- `QUICK_START.md` - Getting started guide
- `TESTING.md` - Testing instructions
- `PROJECT_SUMMARY.md` - Implementation overview
- `IMPLEMENTATION_CHECKLIST.md` - Feature checklist
- `FILE_STRUCTURE.md` - This file

### Helper Scripts

- `scripts/setup-test-db.*` - Database setup
- `scripts/run-all-tests.*` - Test execution

## Lines of Code (Approximate)

- **Source Code**: ~1,200 lines
- **Test Code**: ~800 lines
- **Configuration**: ~200 lines
- **Documentation**: ~1,000 lines
- **Total**: ~3,200 lines

## Technology Stack

- **Framework**: NestJS 10
- **Language**: TypeScript 5
- **Database**: PostgreSQL + TypeORM
- **Authentication**: JWT (Passport)
- **Validation**: class-validator
- **Testing**: Jest + Supertest
- **CI/CD**: GitHub Actions
