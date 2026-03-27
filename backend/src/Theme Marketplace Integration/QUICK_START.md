# Quick Start Guide

## Installation & Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

## Running the Application

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm run build
npm start
```

Server runs on `http://localhost:3000`

## Running Tests

```bash
# Run all tests with coverage
npm test

# Run tests in CI mode
npm run test:ci
```

## API Usage Examples

### 1. Get Available Themes

```bash
# Get all themes
curl http://localhost:3000/shop/themes

# Get only skins
curl http://localhost:3000/shop/themes?type=skin

# Get only boards
curl http://localhost:3000/shop/themes?type=board
```

### 2. Purchase Single Theme

```bash
curl -X POST http://localhost:3000/shop/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-1",
    "themeIds": ["skin-1"]
  }'
```

### 3. Bulk Purchase (Multiple Themes)

```bash
curl -X POST http://localhost:3000/shop/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-1",
    "themeIds": ["skin-1", "board-1", "board-2"]
  }'
```

### 4. Purchase with Coupon

```bash
# 20% discount
curl -X POST http://localhost:3000/shop/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-1",
    "themeIds": ["skin-2"],
    "couponCode": "WELCOME20"
  }'

# $100 fixed discount
curl -X POST http://localhost:3000/shop/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-1",
    "themeIds": ["skin-2"],
    "couponCode": "SAVE100"
  }'
```

### 5. Get Transaction History

```bash
curl http://localhost:3000/shop/transactions/user-1
```

### 6. Health Check

```bash
curl http://localhost:3000/health
```

## Sample Data

### Pre-seeded Themes

| ID      | Name           | Type  | Price |
| ------- | -------------- | ----- | ----- |
| skin-1  | Dragon Warrior | skin  | 500   |
| skin-2  | Cyber Ninja    | skin  | 750   |
| board-1 | Galaxy Board   | board | 300   |
| board-2 | Neon Lights    | board | 400   |

### Pre-seeded Coupons

| Code      | Type       | Value | Expires    |
| --------- | ---------- | ----- | ---------- |
| WELCOME20 | percentage | 20%   | 2026-12-31 |
| SAVE100   | fixed      | $100  | 2026-12-31 |

### Test User

- **ID**: user-1
- **Username**: testuser
- **Balance**: 10,000
- **Owned Themes**: [] (empty initially)

## Expected Responses

### Successful Purchase

```json
{
  "success": true,
  "transaction": {
    "id": "uuid-here",
    "userId": "user-1",
    "themeIds": ["skin-1"],
    "totalAmount": 500,
    "discountAmount": 0,
    "finalAmount": 500,
    "timestamp": "2026-02-25T...",
    "status": "completed"
  },
  "unlockedThemes": ["skin-1"]
}
```

### Error Response

```json
{
  "error": "Insufficient balance"
}
```

## Common Error Messages

- `User not found` - Invalid userId
- `One or more themes not found` - Invalid themeId
- `No themes selected` - Empty themeIds array
- `You already own some of these themes` - Duplicate purchase
- `Insufficient balance` - Not enough funds
- `Invalid coupon code` - Coupon doesn't exist
- `Coupon has expired` - Past expiration date
- `Coupon usage limit reached` - Max uses exceeded
- `Coupon is not active` - Coupon disabled

## Testing the API

Use the provided test script:

```bash
# Make it executable (Linux/Mac)
chmod +x test-api.sh

# Run it (requires server to be running)
./test-api.sh
```

Or use tools like:

- **Postman**: Import the endpoints
- **curl**: Use examples above
- **HTTPie**: `http POST localhost:3000/shop/purchase userId=user-1 themeIds:='["skin-1"]'`

## Troubleshooting

### Port Already in Use

Change the port in `.env`:

```
PORT=3001
```

### Tests Failing

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm test
```

### TypeScript Errors

```bash
# Rebuild
npm run build
```

## Next Steps

1. Replace in-memory database with real database
2. Add authentication middleware
3. Integrate payment gateway
4. Deploy to production
5. Add monitoring and logging

## Support

For issues or questions, check:

- README.md - Full documentation
- IMPLEMENTATION.md - Feature details
- TESTING_REPORT.md - Test coverage
