# Shared Middleware & Nested Services Guide

## Overview

This document outlines the shared middleware package and integration guide for nested Express/Nest services, addressing issue #390.

## Shared Middleware Package

### Location

```
backend/src/shared-middleware/
├── src/
│   ├── middleware/
│   │   ├── jwt.middleware.ts          # JWT validation
│   │   ├── http-logger.middleware.ts  # Request logging
│   │   ├── error-handler.middleware.ts # Error handling
│   │   └── health-check.middleware.ts # Health checks
│   ├── config/
│   │   ├── jwt.config.ts
│   │   └── logger.config.ts
│   ├── types/
│   │   ├── request-with-user.ts
│   │   └── error-response.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Features

1. **JWT Middleware** - Consistent token validation
2. **HTTP Logger** - Structured request/response logging
3. **Error Handler** - Unified error response format
4. **Health Check** - Service health endpoints

## Services Classification

### Production Services

These services are production-ready and should use shared middleware:

1. **Admin Shop Management APIs** (`backend/src/Admin Shop Management APIs/`)
   - Status: Production
   - Port: 3001 (configurable)
   - Health: `/health`

2. **Theme Marketplace Integration** (`backend/src/Theme Marketplace Integration/`)
   - Status: Production
   - Port: 3002 (configurable)
   - Health: `/health`

3. **User Management (Admin)** (`backend/src/User Management (Admin)/`)
   - Status: Production
   - Port: 3003 (configurable)
   - Health: `/health`

4. **Shop Analytics Dashboard** (`backend/src/Shop Analytics and Revenue Dashboard(Admin)/`)
   - Status: Production
   - Port: 3004 (configurable)
   - Health: `/health`

### Demo/Development Services

- None currently identified

## Integration Guide

### Step 1: Install Shared Middleware

```bash
cd backend/src/Admin\ Shop\ Management\ APIs
npm install @tycoon/shared-middleware
```

### Step 2: Update app.ts

**Before:**
```typescript
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
```

**After:**
```typescript
import express from 'express';
import cors from 'cors';
import {
  JwtMiddleware,
  HttpLoggerMiddleware,
  ErrorHandlerMiddleware,
  HealthCheckMiddleware,
  getJwtConfig,
  getLoggerConfig,
} from '@tycoon/shared-middleware';

const app = express();

// Configuration
const jwtConfig = getJwtConfig();
const loggerConfig = getLoggerConfig();

// Middleware
app.use(cors());
app.use(express.json());

// Logging
const httpLogger = new HttpLoggerMiddleware(loggerConfig);
app.use(httpLogger.log);

// Health check
const healthCheck = new HealthCheckMiddleware({
  serviceName: 'admin-shop-api',
  version: '1.0.0',
  checks: {
    database: async () => {
      // Add your DB health check
      return true;
    },
  },
});
app.get('/health', healthCheck.check);

// Protected routes
const jwtMiddleware = new JwtMiddleware(jwtConfig);
app.use('/api/protected', jwtMiddleware.authenticate);

// Error handler (must be last)
const errorHandler = new ErrorHandlerMiddleware();
app.use(errorHandler.handle);

export default app;
```

### Step 3: Environment Variables

Create `.env` file in each service:

```env
# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Service
SERVICE_NAME=admin-shop-api
SERVICE_PORT=3001
NODE_ENV=production
```

### Step 4: Update package.json

Add shared middleware to dependencies:

```json
{
  "dependencies": {
    "@tycoon/shared-middleware": "file:../shared-middleware",
    "express": "^4.18.2",
    "dotenv": "^16.3.1"
  }
}
```

## Health Endpoints

### Endpoint Format

```
GET /health
```

### Response Format

**Healthy:**
```json
{
  "status": "healthy",
  "service": "admin-shop-api",
  "version": "1.0.0",
  "timestamp": "2024-03-26T10:00:00Z",
  "checks": {
    "database": true,
    "redis": true
  }
}
```

**Degraded:**
```json
{
  "status": "degraded",
  "service": "admin-shop-api",
  "version": "1.0.0",
  "timestamp": "2024-03-26T10:00:00Z",
  "checks": {
    "database": true,
    "redis": false
  }
}
```

**Unhealthy:**
```json
{
  "status": "unhealthy",
  "service": "admin-shop-api",
  "error": "Database connection failed",
  "timestamp": "2024-03-26T10:00:00Z"
}
```

## Error Response Format

All services return consistent error responses:

```json
{
  "statusCode": 400,
  "message": "Bad Request",
  "error": "ValidationError",
  "timestamp": "2024-03-26T10:00:00Z",
  "path": "/api/shop/items",
  "details": {
    "field": "name",
    "message": "Name is required"
  }
}
```

## JWT Validation

### Token Format

```
Authorization: Bearer <token>
```

### Token Payload

```json
{
  "id": 123,
  "email": "user@example.com",
  "role": "admin",
  "iat": 1711000000,
  "exp": 1711086400
}
```

### Validation Flow

1. Extract token from `Authorization` header
2. Verify signature using `JWT_SECRET`
3. Check expiration
4. Attach user to request object
5. Pass to next middleware

## Request Logging

### Log Format

**JSON:**
```json
{
  "timestamp": "2024-03-26T10:00:00Z",
  "method": "POST",
  "path": "/api/shop/items",
  "statusCode": 201,
  "duration": "45ms",
  "userAgent": "Mozilla/5.0...",
  "ip": "192.168.1.1"
}
```

**Text:**
```
[2024-03-26T10:00:00Z] POST /api/shop/items - 201 (45ms)
```

### Excluded Paths

By default, these paths are not logged:
- `/health`
- `/metrics`

## Secret Configuration

### Avoiding Drift

1. **Single source of truth** - Use `.env` files
2. **No hardcoded secrets** - Always use environment variables
3. **Validation** - Check required secrets on startup
4. **Rotation** - Update secrets without redeployment

### Validation Example

```typescript
const jwtConfig = getJwtConfig(); // Throws if JWT_SECRET missing
```

## Smoke Test Script

### Location

```
backend/scripts/smoke-test.sh
```

### Usage

```bash
bash backend/scripts/smoke-test.sh
```

### Test Coverage

- [ ] Main API health check
- [ ] Admin Shop API health check
- [ ] Theme Marketplace API health check
- [ ] User Management API health check
- [ ] Analytics Dashboard API health check
- [ ] JWT validation on protected routes
- [ ] Error response format validation
- [ ] CORS headers validation

## Running Services

### Development

```bash
# Terminal 1: Main API
cd backend
npm run dev

# Terminal 2: Admin Shop API
cd backend/src/Admin\ Shop\ Management\ APIs
npm run dev

# Terminal 3: Theme Marketplace API
cd backend/src/Theme\ Marketplace\ Integration
npm run dev

# Terminal 4: User Management API
cd backend/src/User\ Management\ \(Admin\)
npm run dev

# Terminal 5: Analytics Dashboard API
cd backend/src/Shop\ Analytics\ and\ Revenue\ Dashboard\(Admin\)
npm run dev
```

### Production

```bash
# Build all services
npm run build

# Start main API
npm start

# Start services (in separate processes/containers)
cd backend/src/Admin\ Shop\ Management\ APIs && npm start
cd backend/src/Theme\ Marketplace\ Integration && npm start
cd backend/src/User\ Management\ \(Admin\) && npm start
cd backend/src/Shop\ Analytics\ and\ Revenue\ Dashboard\(Admin\) && npm start
```

## Troubleshooting

### JWT Validation Fails

1. Check `JWT_SECRET` is set in `.env`
2. Verify token format: `Bearer <token>`
3. Check token expiration
4. Validate token signature

### Health Check Returns Unhealthy

1. Check database connection
2. Check Redis connection (if applicable)
3. Review service logs
4. Check environment variables

### CORS Errors

1. Verify `CORS_ORIGIN` environment variable
2. Check allowed methods and headers
3. Test with curl: `curl -H "Origin: http://localhost:3000" http://localhost:3001/health`

## Next Steps

1. Build shared middleware package: `npm run build`
2. Integrate into each service
3. Run smoke tests
4. Deploy to staging
5. Monitor health endpoints
