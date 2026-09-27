# Shop Analytics for Admins

NestJS-based shop analytics system tracking monetization and player behavior.

## Features

- **Total Revenue**: Aggregate revenue from all transactions
- **Popular Items**: Top 10 items by purchase count with revenue data
- **Conversion Rate**: Percentage of players who made purchases
- **Retention Metrics**: Day 1, 7, and 30 retention rates

## API Endpoint

```
GET /admin/analytics/shop
```

### Response Example

```json
{
  "totalRevenue": 5000.5,
  "popularItems": [
    {
      "itemId": "1",
      "itemName": "Sword",
      "purchaseCount": 100,
      "totalRevenue": 2000
    }
  ],
  "conversionRate": 25.5,
  "retentionMetrics": {
    "day1": 80,
    "day7": 60,
    "day30": 40
  }
}
```

## Installation

```bash
npm install
```

## Running

```bash
npm run start:dev
```

## Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Database

Uses SQLite with TypeORM. Entities:

- `Transaction`: Purchase records
- `PlayerActivity`: Player engagement tracking

## Performance Optimizations

- Parallel query execution for all metrics
- Indexed database queries
- Efficient aggregation using SQL
- In-memory database for fast testing
