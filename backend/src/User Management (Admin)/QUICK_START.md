# Quick Start Guide

Get the admin user management module up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 12+ installed (or Docker)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Setup Database

### Option A: Using Docker (Recommended)

**Windows:**

```bash
scripts\setup-test-db.bat
```

**Linux/Mac:**

```bash
chmod +x scripts/setup-test-db.sh
./scripts/setup-test-db.sh
```

### Option B: Manual PostgreSQL Setup

1. Create database:

```sql
CREATE DATABASE test_db;
```

2. Configure environment:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=test_db
JWT_SECRET=your-secret-key
```

## Step 3: Run Tests

### All Tests at Once

**Windows:**

```bash
scripts\run-all-tests.bat
```

**Linux/Mac:**

```bash
chmod +x scripts/run-all-tests.sh
./scripts/run-all-tests.sh
```

### Individual Test Suites

```bash
# Unit tests only
npm test

# E2E tests only
npm run test:e2e

# With coverage
npm run test:cov
```

## Step 4: Start the Application

```bash
# Development mode
npm run start:dev

# Production build
npm run build
npm run start
```

The API will be available at `http://localhost:3000`

## Testing the API

### 1. Create an Admin User (Manual)

You'll need to manually insert an admin user into the database or create a seed script:

```sql
INSERT INTO users (id, email, password, "firstName", "lastName", role, status, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@example.com',
  '$2b$10$YourHashedPasswordHere',
  'Admin',
  'User',
  'admin',
  'active',
  NOW(),
  NOW()
);
```

### 2. Get JWT Token

You'll need to implement a login endpoint or manually generate a JWT token with:

- sub: user ID
- email: user email
- role: 'admin'

### 3. Test Endpoints

```bash
# List users
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/admin/users

# Get single user
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/admin/users/USER_ID

# Update role
curl -X PATCH \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"moderator"}' \
  http://localhost:3000/admin/users/USER_ID/role

# Suspend user
curl -X PATCH \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"suspended"}' \
  http://localhost:3000/admin/users/USER_ID/status

# Reset password
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"newPassword123"}' \
  http://localhost:3000/admin/users/USER_ID/reset-password

# Get audit logs
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/admin/users/USER_ID/audit-logs
```

## Expected Test Results

When you run the tests, you should see:

```
✓ UsersService (12 tests)
✓ UsersController (6 tests)
✓ RolesGuard (5 tests)
✓ JwtStrategy (2 tests)
✓ QueryUsersDto (6 tests)
✓ ResetPasswordDto (3 tests)
✓ Users Admin E2E (15 tests)

Total: 49+ tests passing
Coverage: >80%
```

## Troubleshooting

### Database Connection Failed

- Ensure PostgreSQL is running
- Check credentials in `.env`
- Verify database exists

### Tests Failing

- Run `npm install` to ensure all dependencies are installed
- Check PostgreSQL is accessible on port 5432
- Verify environment variables are set

### Port 3000 Already in Use

- Change port in `src/main.ts`
- Or stop the service using port 3000

## Next Steps

1. ✅ Tests are passing
2. Add authentication/login endpoint
3. Create database seed scripts
4. Add Swagger documentation
5. Deploy to production

## Need Help?

- Check `README.md` for detailed documentation
- See `TESTING.md` for testing guide
- Review `PROJECT_SUMMARY.md` for implementation details
- Check `IMPLEMENTATION_CHECKLIST.md` for feature list

## Success! 🎉

If all tests pass, your admin user management module is ready to use!
