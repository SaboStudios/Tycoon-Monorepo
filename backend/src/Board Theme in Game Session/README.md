# Board Theme Selection Feature

## Overview

Allows game hosts to select board themes before starting a multiplayer match.

## Implementation

### 1. Database Migration

Run the migration to add `board_style_id` to the games table:

```sql
-- See migrations/add_board_style_to_games.sql
```

### 2. API Endpoints

#### Create Game with Theme

```
POST /games
Authorization: Bearer <token>
Body: {
  "board_style_id": 5  // optional
}
```

#### Update Game Theme (Host Only)

```
PATCH /games/:gameId/theme
Authorization: Bearer <token>
Body: {
  "board_style_id": 5
}
```

### 3. WebSocket Events

When theme is updated, all players receive:

```json
{
  "type": "THEME_UPDATED",
  "payload": {
    "board_style_id": 5,
    "theme": {
      "id": 5,
      "name": "Ocean Blue",
      "is_premium": true
    }
  }
}
```

## Acceptance Criteria ✅

- ✅ `board_style_id` added to games table
- ✅ Premium ownership validated before theme selection
- ✅ Theme changes broadcast to all players via WebSocket
- ✅ All players see the selected theme

## Key Features

1. **Premium Validation**: Checks `user_board_styles` table to verify ownership
2. **Host Authorization**: Only game host can change theme
3. **Real-time Broadcasting**: All players notified instantly via WebSocket
4. **Nullable Column**: Games can have no theme (default board)

## Database Schema Requirements

Assumes these tables exist:

- `games` - game records
- `board_styles` - available themes
- `user_board_styles` - premium theme ownership
- `users` - user accounts
