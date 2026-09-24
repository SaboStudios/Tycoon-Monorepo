# Admin Dashboard Analytics Module

This module provides key business metrics for the admin dashboard.

## Features

### Endpoints

All endpoints require authentication (`JwtAuthGuard`) and admin privileges (`AdminGuard`).

#### 1. Dashboard Overview
```
GET /admin/analytics/dashboard
```
Returns all metrics in a single response:
```json
{
  "totalUsers": 1250,
  "activeUsers": 450,
  "totalGames": 3200,
  "totalGamePlayers": 8500
}
```

#### 2. Total Users
```
GET /admin/analytics/users/total
```
Returns the total number of registered users:
```json
{
  "totalUsers": 1250
}
```

#### 3. Active Users
```
GET /admin/analytics/users/active
```
Returns the number of users active in the last 30 days (based on `updated_at` timestamp):
```json
{
  "activeUsers": 450
}
```

#### 4. Total Games
```
GET /admin/analytics/games/total
```
Returns the total number of games created:
```json
{
  "totalGames": 3200
}
```

#### 5. Total Game Players
```
GET /admin/analytics/games/players/total
```
Returns the total number of game player records (player participation across all games):
```json
{
  "totalGamePlayers": 8500
}
```

## Security

- All endpoints are protected by `JwtAuthGuard` - requires valid JWT token
- All endpoints are protected by `AdminGuard` - requires `is_admin: true` in user record
- Non-admin users will receive a `403 Forbidden` response

## Usage Example

```typescript
// With axios
const response = await axios.get('/admin/analytics/dashboard', {
  headers: {
    Authorization: `Bearer ${adminToken}`
  }
});

console.log(response.data);
// {
//   totalUsers: 1250,
//   activeUsers: 450,
//   totalGames: 3200,
//   totalGamePlayers: 8500
// }
```

## Implementation Details

### Active Users Definition
Active users are defined as users whose `updated_at` timestamp is within the last 30 days. This captures users who have:
- Logged in
- Updated their profile
- Participated in games
- Made any account changes

### Performance
All metrics are calculated using optimized database queries:
- `totalUsers`: Simple count query on users table
- `activeUsers`: Count with date filter on indexed `updated_at` column
- `totalGames`: Simple count query on games table
- `totalGamePlayers`: Simple count query on game_players table

All queries run in parallel for the dashboard endpoint to minimize response time.

## Module Structure

```
admin-analytics/
├── admin-analytics.module.ts       # Module definition
├── admin-analytics.controller.ts   # API endpoints
├── admin-analytics.service.ts      # Business logic
├── dto/
│   └── dashboard-analytics.dto.ts  # Response DTO
├── index.ts                        # Module exports
└── README.md                       # This file
```

## Integration

The module is registered in `app.module.ts`:

```typescript
import { AdminAnalyticsModule } from './modules/admin-analytics/admin-analytics.module';

@Module({
  imports: [
    // ... other modules
    AdminAnalyticsModule,
  ],
})
export class AppModule {}
```
