# Admin Dashboard Analytics - Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT REQUEST                          │
│                  (Admin User with JWT Token)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NESTJS MIDDLEWARE LAYER                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ ThrottlerGuard│→│ JwtAuthGuard │→│   AdminGuard         │  │
│  │ (Rate Limit) │  │ (Auth Check) │  │ (is_admin: true)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              AdminAnalyticsController                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  GET /admin/analytics/dashboard                          │  │
│  │  GET /admin/analytics/users/total                        │  │
│  │  GET /admin/analytics/users/active                       │  │
│  │  GET /admin/analytics/games/total                        │  │
│  │  GET /admin/analytics/games/players/total                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              AdminAnalyticsService                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  getDashboardAnalytics()                                 │  │
│  │    ├─ getTotalUsers()                                    │  │
│  │    ├─ getActiveUsers()                                   │  │
│  │    ├─ getTotalGames()                                    │  │
│  │    └─ getTotalGamePlayers()                              │  │
│  │                                                           │  │
│  │  Parallel Execution with Promise.all()                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TypeORM Repositories                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   UserRepo   │  │   GameRepo   │  │  GamePlayerRepo      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼──────────────────┼─────────────────────┼──────────────┘
          │                  │                     │
          ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ users table  │  │ games table  │  │ game_players table   │  │
│  │              │  │              │  │                      │  │
│  │ COUNT(*)     │  │ COUNT(*)     │  │ COUNT(*)             │  │
│  │ WHERE        │  │              │  │                      │  │
│  │ updated_at   │  │              │  │                      │  │
│  │ > 30 days    │  │              │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │                  │                     │
          └──────────────────┴─────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      JSON RESPONSE                              │
│  {                                                              │
│    "totalUsers": 1250,                                          │
│    "activeUsers": 450,                                          │
│    "totalGames": 3200,                                          │
│    "totalGamePlayers": 8500                                     │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Request Flow

1. **Client** sends GET request with JWT token
2. **ThrottlerGuard** checks rate limits
3. **JwtAuthGuard** validates JWT token and extracts user
4. **AdminGuard** verifies user has `is_admin: true`
5. **Controller** receives request and calls service method
6. **Service** executes database queries in parallel
7. **Repositories** perform optimized COUNT queries
8. **Database** returns aggregated counts
9. **Service** combines results into DTO
10. **Controller** returns JSON response

## Security Layers

```
┌─────────────────────────────────────────┐
│         Request with JWT Token          │
└────────────────┬────────────────────────┘
                 │
                 ▼
         ┌───────────────┐
         │ Rate Limiting │ ← Prevents abuse
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │ Authentication│ ← Valid JWT?
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │ Authorization │ ← is_admin: true?
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │ Access Granted│
         └───────────────┘
```

## Data Flow for Dashboard Endpoint

```
GET /admin/analytics/dashboard
         │
         ▼
┌────────────────────────┐
│ getDashboardAnalytics()│
└───────────┬────────────┘
            │
            ├─────────────────────────────────┐
            │                                 │
            ▼                                 ▼
    ┌──────────────┐                 ┌──────────────┐
    │ getTotalUsers│                 │ getActiveUsers│
    │              │                 │               │
    │ COUNT(*)     │                 │ COUNT(*)      │
    │ FROM users   │                 │ FROM users    │
    │              │                 │ WHERE         │
    │              │                 │ updated_at >  │
    │              │                 │ 30 days ago   │
    └──────┬───────┘                 └──────┬────────┘
           │                                │
           │         ┌──────────────┐       │
           │         │ getTotalGames│       │
           │         │              │       │
           │         │ COUNT(*)     │       │
           │         │ FROM games   │       │
           │         └──────┬───────┘       │
           │                │               │
           │    ┌───────────────────────┐   │
           │    │ getTotalGamePlayers   │   │
           │    │                       │   │
           │    │ COUNT(*)              │   │
           │    │ FROM game_players     │   │
           │    └──────┬────────────────┘   │
           │           │                    │
           └───────────┴────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │ Promise.all()  │
              │ (Parallel)     │
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐
              │ Combine Results│
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐
              │ Return DTO     │
              └────────────────┘
```

## Module Dependencies

```
┌──────────────────────────┐
│  AdminAnalyticsModule    │
└────────────┬─────────────┘
             │
             ├─────────────────────────┐
             │                         │
             ▼                         ▼
    ┌────────────────┐       ┌────────────────┐
    │  TypeOrmModule │       │   AuthModule   │
    │                │       │                │
    │  - User        │       │  - JwtAuthGuard│
    │  - Game        │       │  - AdminGuard  │
    │  - GamePlayer  │       │                │
    └────────────────┘       └────────────────┘
```
