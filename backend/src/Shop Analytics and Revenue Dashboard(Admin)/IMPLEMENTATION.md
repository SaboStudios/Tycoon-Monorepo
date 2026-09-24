# Shop Analytics Implementation

## Completed Features

### 1. Total Revenue ✓

- Aggregates all transaction amounts
- Returns decimal precision for accurate financial data
- Handles empty data gracefully (returns 0)

### 2. Popular Items ✓

- Top 10 items ranked by purchase count
- Includes item ID, name, purchase count, and total revenue per item
- Optimized SQL query with grouping and ordering

### 3. Conversion Rate ✓

- Calculates percentage of players who made purchases
- Formula: (players with purchases / total active players) × 100
- Returns 0 when no players exist

### 4. Retention Metrics ✓

- Day 1, Day 7, and Day 30 retention rates
- Tracks players who return after initial activity
- Percentage-based metrics for dashboard display

## API Endpoint

```
GET /admin/analytics/shop
```

## Test Results

✓ All unit tests passing (5 tests)
✓ All E2E tests passing (4 tests)
✓ Build successful
✓ CI-ready with GitHub Actions workflow

## Performance Optimizations

1. **Parallel Execution**: All metrics calculated simultaneously using Promise.all
2. **Database Indexing**: Queries optimized with proper grouping and aggregation
3. **Efficient Queries**: Uses SQL aggregation functions (SUM, COUNT) at database level
4. **In-Memory Testing**: SQLite in-memory database for fast test execution

## Database Schema

### Transaction Entity

- id: Primary key
- playerId: Player identifier
- itemId: Item identifier
- itemName: Item display name
- amount: Purchase amount (decimal)
- createdAt: Transaction timestamp

### PlayerActivity Entity

- id: Primary key
- playerId: Player identifier
- action: Activity type
- createdAt: Activity timestamp

## Running the Application

```bash
# Install dependencies
npm install

# Run tests
npm test
npm run test:e2e

# Build
npm run build

# Start server
npm run start:dev
```

## CI/CD

GitHub Actions workflow included at `.github/workflows/ci.yml`:

- Runs on push/PR to main branch
- Executes unit tests
- Executes E2E tests
- Builds the application
