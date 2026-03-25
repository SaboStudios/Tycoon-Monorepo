# Quick Start Guide

## Installation & Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Start the development server:

```bash
npm run dev
```

The server will start on http://localhost:3000

## Testing the API

### Option 1: Using Postman

1. Import `postman_collection.json` into Postman
2. Run "Login as Admin" request (token will be saved automatically)
3. Test other endpoints

### Option 2: Using curl

1. Login to get token:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

2. Save the token from response and use it:

```bash
TOKEN="your-token-here"

# Create an item
curl -X POST http://localhost:3000/api/shop \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Widget",
    "description": "High-quality widget",
    "price": 99.99,
    "isActive": true
  }'

# Get all items
curl http://localhost:3000/api/shop

# Update price
curl -X PATCH http://localhost:3000/api/shop/1/price \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price": 79.99}'

# Deactivate item
curl -X PATCH http://localhost:3000/api/shop/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'

# Bulk update
curl -X POST http://localhost:3000/api/shop/bulk/update \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {"id": "1", "data": {"price": 99.99}},
      {"id": "2", "data": {"isActive": false}}
    ]
  }'
```

## Running Tests

```bash
# Run all tests with coverage
npm test

# Run tests in CI mode
npm run test:ci
```

## Building for Production

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

## Key Features Implemented

✅ Admin authentication with JWT
✅ Create shop items
✅ Update item details
✅ Update prices specifically
✅ Activate/deactivate items
✅ Upload images (up to 5 per request)
✅ Bulk update operations
✅ Delete items
✅ Admin-only access control
✅ Comprehensive test coverage (87%+)
✅ CI/CD ready with GitHub Actions

## Default Credentials

- Username: `admin`
- Password: `admin123`

⚠️ Change these in production!

## Project Structure

```
src/
├── __tests__/          # Test files
│   ├── auth.test.ts
│   ├── shop.test.ts
│   ├── shopService.test.ts
│   ├── middleware.test.ts
│   └── upload.test.ts
├── middleware/         # Auth and upload middleware
│   ├── auth.ts
│   └── upload.ts
├── routes/            # API routes
│   ├── authRoutes.ts
│   └── shopRoutes.ts
├── services/          # Business logic
│   └── shopService.ts
├── types/             # TypeScript types
│   └── index.ts
├── app.ts             # Express app setup
└── index.ts           # Server entry point
```

## Next Steps

For production deployment:

1. Replace in-memory storage with a database (PostgreSQL, MongoDB)
2. Add rate limiting
3. Implement proper logging
4. Use cloud storage for images (S3, Cloudinary)
5. Add pagination
6. Set up monitoring and error tracking
7. Configure HTTPS
8. Update JWT secret and admin credentials
