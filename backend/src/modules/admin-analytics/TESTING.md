# Admin Analytics API Testing Guide

## Prerequisites

1. Start the backend server
2. Obtain an admin JWT token (user with `is_admin: true`)

## Authentication

All requests require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your-admin-jwt-token>
```

## cURL Examples

### 1. Get Dashboard Analytics (All Metrics)
```bash
curl -X GET http://localhost:3000/admin/analytics/dashboard \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "totalUsers": 1250,
  "activeUsers": 450,
  "totalGames": 3200,
  "totalGamePlayers": 8500
}
```

### 2. Get Total Users
```bash
curl -X GET http://localhost:3000/admin/analytics/users/total \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "totalUsers": 1250
}
```

### 3. Get Active Users
```bash
curl -X GET http://localhost:3000/admin/analytics/users/active \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "activeUsers": 450
}
```

### 4. Get Total Games
```bash
curl -X GET http://localhost:3000/admin/analytics/games/total \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "totalGames": 3200
}
```

### 5. Get Total Game Players
```bash
curl -X GET http://localhost:3000/admin/analytics/games/players/total \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "totalGamePlayers": 8500
}
```

## Error Responses

### 401 Unauthorized (No Token)
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden (Not Admin)
```json
{
  "statusCode": 403,
  "message": "Access denied. Admin role required."
}
```

## Postman Collection

Import this JSON into Postman:

```json
{
  "info": {
    "name": "Admin Analytics API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Dashboard Analytics",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{adminToken}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/admin/analytics/dashboard",
          "host": ["{{baseUrl}}"],
          "path": ["admin", "analytics", "dashboard"]
        }
      }
    },
    {
      "name": "Total Users",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{adminToken}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/admin/analytics/users/total",
          "host": ["{{baseUrl}}"],
          "path": ["admin", "analytics", "users", "total"]
        }
      }
    },
    {
      "name": "Active Users",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{adminToken}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/admin/analytics/users/active",
          "host": ["{{baseUrl}}"],
          "path": ["admin", "analytics", "users", "active"]
        }
      }
    },
    {
      "name": "Total Games",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{adminToken}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/admin/analytics/games/total",
          "host": ["{{baseUrl}}"],
          "path": ["admin", "analytics", "games", "total"]
        }
      }
    },
    {
      "name": "Total Game Players",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{adminToken}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/admin/analytics/games/players/total",
          "host": ["{{baseUrl}}"],
          "path": ["admin", "analytics", "games", "players", "total"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "adminToken",
      "value": "your-admin-jwt-token-here"
    }
  ]
}
```

## Testing with JavaScript/TypeScript

```typescript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';
const ADMIN_TOKEN = 'your-admin-jwt-token';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Authorization: `Bearer ${ADMIN_TOKEN}`,
  },
});

// Get all dashboard metrics
async function getDashboardAnalytics() {
  const response = await api.get('/admin/analytics/dashboard');
  console.log('Dashboard Analytics:', response.data);
  return response.data;
}

// Get individual metrics
async function getTotalUsers() {
  const response = await api.get('/admin/analytics/users/total');
  console.log('Total Users:', response.data);
  return response.data;
}

async function getActiveUsers() {
  const response = await api.get('/admin/analytics/users/active');
  console.log('Active Users:', response.data);
  return response.data;
}

async function getTotalGames() {
  const response = await api.get('/admin/analytics/games/total');
  console.log('Total Games:', response.data);
  return response.data;
}

async function getTotalGamePlayers() {
  const response = await api.get('/admin/analytics/games/players/total');
  console.log('Total Game Players:', response.data);
  return response.data;
}

// Run all tests
async function runTests() {
  try {
    await getDashboardAnalytics();
    await getTotalUsers();
    await getActiveUsers();
    await getTotalGames();
    await getTotalGamePlayers();
    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

runTests();
```

## How to Get Admin Token

1. Login as admin user:
```bash
curl -X POST http://localhost:3000/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password"
  }'
```

2. Extract the `access_token` from the response
3. Use it in the Authorization header for analytics endpoints
