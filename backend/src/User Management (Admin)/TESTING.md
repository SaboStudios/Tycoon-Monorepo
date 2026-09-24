# Testing Guide

## Prerequisites

1. Install dependencies:

```bash
npm install
```

2. Set up PostgreSQL database:

```bash
# Using Docker
docker run --name postgres-test -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=test_db -p 5432:5432 -d postgres:15

# Or install PostgreSQL locally and create database
createdb test_db
```

3. Configure environment variables:

```bash
cp .env.example .env
# Edit .env with your database credentials
```

## Running Tests

### Unit Tests

```bash
npm test
```

This runs all unit tests including:

- UsersService tests
- UsersController tests
- RolesGuard tests
- JwtStrategy tests
- DTO validation tests

### E2E Tests

```bash
npm run test:e2e
```

This runs end-to-end tests covering:

- User listing with pagination
- Search and filtering
- Role updates
- Status updates (suspend/activate)
- Password resets
- Audit log retrieval
- Authentication and authorization

### Test Coverage

```bash
npm run test:cov
```

Generates a coverage report in the `coverage/` directory.

### Watch Mode

```bash
npm run test:watch
```

## CI/CD Testing

The project includes GitHub Actions workflow that:

1. Sets up PostgreSQL service
2. Installs dependencies
3. Runs unit tests
4. Runs E2E tests
5. Generates coverage report

## Test Structure

```
src/
├── users/
│   ├── users.service.spec.ts       # Service unit tests
│   ├── users.controller.spec.ts    # Controller unit tests
│   └── dto/
│       ├── query-users.dto.spec.ts
│       └── reset-password.dto.spec.ts
├── auth/
│   ├── roles.guard.spec.ts
│   └── jwt.strategy.spec.ts
test/
└── users.e2e-spec.ts               # E2E integration tests
```

## Expected Test Results

All tests should pass with:

- ✓ 30+ unit tests
- ✓ 15+ E2E tests
- ✓ >80% code coverage

## Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running
- Check credentials in .env file
- Verify database exists

### Port Already in Use

- Change port in main.ts or stop conflicting service

### Module Not Found

- Run `npm install` to ensure all dependencies are installed
