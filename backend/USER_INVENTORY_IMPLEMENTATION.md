# User Inventory System - Implementation

## Overview
Implemented a comprehensive user inventory system that tracks purchased items and allows users to apply them in-game.

## Features Implemented

### 1. User Inventory Table ✅
Created `user_inventory` table with:
- `id` - Primary key
- `user_id` - Foreign key to users table
- `shop_item_id` - Foreign key to shop_items table
- `quantity` - Number of items owned
- `expires_at` - Optional expiration timestamp
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

### 2. Indexing for Performance ✅
- **Unique index** on `(user_id, shop_item_id)` - Prevents duplicate entries
- **Index** on `user_id` - Fast user inventory lookups
- **Index** on `shop_item_id` - Fast item queries
- **Index** on `expires_at` - Efficient expiration queries

### 3. Foreign Keys ✅
- `user_id` → `users.id` (CASCADE on delete)
- `shop_item_id` → `shop_items.id` (CASCADE on delete)

### 4. Inventory Service ✅
Provides methods for:
- `addItem()` - Add items to inventory (increments if exists)
- `getUserInventory()` - Get all user items
- `getActiveInventory()` - Get non-expired items only
- `useItem()` - Consume items (decrements quantity)
- `hasItem()` - Check if user owns an item
- `getItemQuantity()` - Get quantity of specific item
- `cleanupExpiredItems()` - Remove expired items

### 5. Purchase Integration ✅
- Automatically adds purchased items to inventory
- Integrated with existing purchase flow
- Transaction-safe (rollback on failure)

### 6. Gift Integration ✅
- Adds items to inventory when gifts are accepted
- Removed TODO comment
- Fully functional gift-to-inventory flow

### 7. API Endpoints ✅
- `GET /shop/inventory` - Get user's full inventory
- `GET /shop/inventory/active` - Get active (non-expired) items

## Database Schema

```sql
CREATE TABLE user_inventory (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  shop_item_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY IDX_user_inventory_user_item (user_id, shop_item_id),
  KEY IDX_user_inventory_user_id (user_id),
  KEY IDX_user_inventory_shop_item_id (shop_item_id),
  KEY IDX_user_inventory_expires_at (expires_at),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_item_id) REFERENCES shop_items(id) ON DELETE CASCADE
);
```

## Usage Examples

### Add Item to Inventory
```typescript
await inventoryService.addItem(userId, shopItemId, quantity, expiresAt);
```

### Get User Inventory
```typescript
const inventory = await inventoryService.getUserInventory(userId);
```

### Get Active Items Only
```typescript
const activeItems = await inventoryService.getActiveInventory(userId);
```

### Use/Consume Item
```typescript
await inventoryService.useItem(userId, shopItemId, quantity);
```

### Check Item Ownership
```typescript
const hasItem = await inventoryService.hasItem(userId, shopItemId);
```

## API Examples

### Get User Inventory
```bash
curl -X GET "http://localhost:3000/shop/inventory" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
[
  {
    "id": 1,
    "user_id": 123,
    "shop_item_id": 10,
    "quantity": 5,
    "expires_at": null,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z",
    "shop_item": {
      "id": 10,
      "name": "Power Boost",
      "description": "Increases power by 50%",
      "type": "boost",
      "price": "9.99",
      "currency": "USD"
    }
  }
]
```

### Get Active Inventory
```bash
curl -X GET "http://localhost:3000/shop/inventory/active" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Scalability Features

### 1. Efficient Indexing
- Composite unique index prevents duplicates
- Individual indexes optimize common queries
- Expiration index enables fast cleanup

### 2. Quantity Aggregation
- Single row per user-item combination
- Quantity field instead of multiple rows
- Reduces storage and improves query performance

### 3. Eager Loading
- Shop item details loaded with inventory
- Reduces N+1 query problems
- Single query for full inventory data

### 4. Expiration Management
- Optional expiration support
- Bulk cleanup method for expired items
- Can be scheduled as cron job

### 5. Transaction Safety
- Purchase and inventory update in same transaction
- Rollback on failure ensures consistency
- No orphaned purchases or missing inventory

## Performance Considerations

### Query Optimization
```typescript
// Fast user lookup (uses user_id index)
SELECT * FROM user_inventory WHERE user_id = ?;

// Fast item check (uses composite index)
SELECT * FROM user_inventory WHERE user_id = ? AND shop_item_id = ?;

// Fast expiration cleanup (uses expires_at index)
DELETE FROM user_inventory WHERE expires_at < NOW();
```

### Large-Scale Support
- Indexes support millions of inventory records
- Efficient pagination for large inventories
- Minimal joins (only shop_item eager loaded)
- Cascading deletes prevent orphaned records

## Testing

Comprehensive test coverage:
- ✅ Add new items
- ✅ Increment existing items
- ✅ Use/consume items
- ✅ Remove items when quantity reaches zero
- ✅ Check item ownership
- ✅ Handle expired items
- ✅ Error handling (not found, insufficient quantity, expired)

Run tests:
```bash
npm test -- inventory.service.spec.ts
```

## Files Created

1. `src/modules/shop/entities/user-inventory.entity.ts` - Entity definition
2. `src/database/migrations/1740440000000-CreateUserInventoryTable.ts` - Migration
3. `src/modules/shop/inventory.service.ts` - Service implementation
4. `src/modules/shop/inventory.service.spec.ts` - Tests

## Files Modified

1. `src/modules/shop/shop.module.ts` - Added inventory to module
2. `src/modules/shop/purchase.service.ts` - Integrated inventory on purchase
3. `src/modules/shop/shop.controller.ts` - Added inventory endpoints
4. `src/modules/gifts/gifts.service.ts` - Added inventory on gift acceptance

## Deployment

### 1. Run Migration
```bash
cd backend
npm run migration:run
```

### 2. Restart Application
```bash
npm run start:prod
```

### 3. Verify
```bash
# Purchase an item
curl -X POST "http://localhost:3000/shop/purchase" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shop_item_id": 1, "quantity": 2}'

# Check inventory
curl -X GET "http://localhost:3000/shop/inventory" \
  -H "Authorization: Bearer $TOKEN"
```

## Acceptance Criteria

✅ **Users can store multiple items**
- Quantity field supports any number
- Unique constraint per user-item combination
- Efficient storage and retrieval

✅ **Supports large-scale gameplay**
- Optimized indexes for fast queries
- Efficient data structure (quantity aggregation)
- Transaction-safe operations
- Scalable to millions of records

## Future Enhancements

1. Item stacking limits
2. Inventory slots/capacity
3. Item trading between users
4. Bulk item operations
5. Inventory history/audit log
6. Item categories/filtering
7. Scheduled expiration cleanup job
