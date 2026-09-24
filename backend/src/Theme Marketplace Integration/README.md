# Shop Backend System

Backend support for a shop where users can buy skins and board styles with coupon support, bulk purchases, and transaction logging.

## Features

- ✅ Purchase skins and board styles
- ✅ Bulk purchase support
- ✅ Coupon and discount system (percentage & fixed)
- ✅ Transaction logging and tracking
- ✅ Instant theme unlocking
- ✅ Balance management
- ✅ Comprehensive test coverage
- ✅ CI/CD pipeline

## API Endpoints

### POST /shop/purchase

Purchase one or more themes.

**Request:**

```json
{
  "userId": "user-1",
  "themeIds": ["skin-1", "board-1"],
  "couponCode": "WELCOME20"
}
```

**Response:**

```json
{
  "success": true,
  "transaction": {
    "id": "uuid",
    "userId": "user-1",
    "themeIds": ["skin-1", "board-1"],
    "totalAmount": 800,
    "discountAmount": 160,
    "finalAmount": 640,
    "couponCode": "WELCOME20",
    "timestamp": "2026-02-25T...",
    "status": "completed"
  },
  "unlockedThemes": ["skin-1", "board-1"]
}
```

### GET /shop/themes

Get available themes with optional filtering.

**Query Parameters:**

- `type` (optional): Filter by type (`skin` or `board`)

**Response:**

```json
{
  "success": true,
  "themes": [
    {
      "id": "skin-1",
      "name": "Dragon Warrior",
      "type": "skin",
      "price": 500,
      "description": "Epic dragon-themed skin",
      "available": true
    }
  ],
  "count": 4
}
```

### GET /shop/transactions/:userId

Get transaction history for a user.

**Response:**

```json
{
  "success": true,
  "transactions": [...],
  "count": 5
}
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Testing

```bash
# Run all tests
npm test

# Run tests in CI mode
npm run test:ci
```

## Build

```bash
npm run build
npm start
```

## Environment Variables

Create a `.env` file:

```
PORT=3000
NODE_ENV=development
```

## Sample Data

The system comes with pre-seeded data:

**Themes:**

- Dragon Warrior (skin) - 500
- Cyber Ninja (skin) - 750
- Galaxy Board (board) - 300
- Neon Lights (board) - 400

**Coupons:**

- WELCOME20 - 20% off
- SAVE100 - $100 off

**Test User:**

- ID: user-1
- Balance: 10,000

## Testing Coverage

The test suite includes:

- ✅ Single and bulk purchases
- ✅ Coupon validation and application
- ✅ Balance checking
- ✅ Theme ownership validation
- ✅ Transaction logging
- ✅ Instant unlocking
- ✅ Error handling
- ✅ API endpoint testing

## CI/CD

GitHub Actions workflow runs on push/PR:

- Tests on Node 18.x and 20.x
- Coverage reporting
- Automated quality checks

## Future Enhancements

- NFT integration ready
- Web3 wallet support
- Payment gateway integration
- Admin dashboard
- Analytics and reporting
