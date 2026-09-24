# Shop Admin Backend

Admin CRUD system for managing shop items with authentication, authorization, and image upload capabilities.

## Features

- ✅ Admin authentication with JWT
- ✅ Create, read, update, delete shop items
- ✅ Update item prices
- ✅ Activate/deactivate items
- ✅ Upload images and assets (up to 5 images per item)
- ✅ Bulk update operations
- ✅ Admin-only access control
- ✅ Comprehensive test coverage
- ✅ CI/CD pipeline with GitHub Actions

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` file:

```bash
cp .env.example .env
```

3. Update `.env` with your configuration:

```
PORT=3000
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
UPLOAD_DIR=uploads
```

## Running the Application

Development mode:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

## Testing

Run all tests:

```bash
npm test
```

Run tests for CI:

```bash
npm run test:ci
```

## API Endpoints

### Authentication

**POST /api/auth/login**

- Login with admin credentials
- Body: `{ "username": "admin", "password": "admin123" }`
- Returns: `{ "token": "...", "user": {...} }`

### Shop Items (Admin Only)

**POST /api/shop**

- Create new item
- Headers: `Authorization: Bearer <token>`
- Body: `{ "name": "Item Name", "description": "Description", "price": 99.99, "isActive": true }`

**GET /api/shop**

- Get all items
- Query params: `?active=true` (optional, filter active items only)

**GET /api/shop/:id**

- Get item by ID

**PUT /api/shop/:id**

- Update item
- Headers: `Authorization: Bearer <token>`
- Body: `{ "name": "New Name", "price": 149.99, "isActive": false }`

**PATCH /api/shop/:id/price**

- Update item price
- Headers: `Authorization: Bearer <token>`
- Body: `{ "price": 79.99 }`

**PATCH /api/shop/:id/status**

- Activate/deactivate item
- Headers: `Authorization: Bearer <token>`
- Body: `{ "isActive": false }`

**POST /api/shop/:id/images**

- Upload images (max 5 per request)
- Headers: `Authorization: Bearer <token>`
- Content-Type: `multipart/form-data`
- Form field: `images` (multiple files)

**POST /api/shop/bulk/update**

- Bulk update items
- Headers: `Authorization: Bearer <token>`
- Body: `{ "updates": [{ "id": "1", "data": { "price": 99 } }, { "id": "2", "data": { "isActive": false } }] }`

**DELETE /api/shop/:id**

- Delete item
- Headers: `Authorization: Bearer <token>`

## Default Admin Credentials

- Username: `admin`
- Password: `admin123`

**⚠️ Change these credentials in production!**

## Test Coverage

The project includes comprehensive tests covering:

- Authentication flows
- Authorization checks
- CRUD operations
- Bulk updates
- Image uploads
- Error handling
- Middleware validation

## CI/CD

GitHub Actions workflow runs on:

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

The CI pipeline:

1. Runs tests on Node.js 18.x and 20.x
2. Generates coverage reports
3. Builds the application
4. Validates build output

## Project Structure

```
src/
├── __tests__/          # Test files
├── middleware/         # Auth and upload middleware
├── routes/            # API routes
├── services/          # Business logic
├── types/             # TypeScript types
├── app.ts             # Express app setup
└── index.ts           # Server entry point
```

## Security Notes

- JWT tokens expire after 24 hours
- Only admin users can manage shop items
- Image uploads limited to 5MB per file
- Only image files (jpeg, jpg, png, gif, webp) allowed
- Passwords hashed with bcrypt

## Production Considerations

This is a minimal implementation. For production:

- Replace in-memory storage with a database (PostgreSQL, MongoDB, etc.)
- Add rate limiting
- Implement proper logging
- Add request validation with libraries like Joi or Zod
- Use cloud storage for images (S3, Cloudinary, etc.)
- Add pagination for item listings
- Implement proper error tracking (Sentry, etc.)
- Add API documentation (Swagger/OpenAPI)
