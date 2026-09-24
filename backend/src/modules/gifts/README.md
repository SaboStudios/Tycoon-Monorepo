# Gifts Module

## Overview

The Gifts module provides a secure and scalable system for players to gift in-game shop items to other users. It supports the complete gift lifecycle from creation to acceptance/rejection, with built-in expiration handling.

## Architecture

### Data Model

The `Gift` entity includes:
- **Core Fields**: sender_id, receiver_id, shop_item_id, quantity, message
- **Status Management**: status (pending, accepted, rejected, expired, cancelled)
- **Lifecycle Tracking**: expiration, accepted_at, rejected_at
- **Web3 Ready**: nft_contract_address, nft_token_id, chain, transaction_hash
- **Extensibility**: metadata JSON field for future features

### Gift Lifecycle

1. **Creation**: Sender creates gift with receiver, item, quantity, and optional message
2. **Pending**: Gift awaits receiver action (accept/reject)
3. **Response**: Receiver accepts or rejects the gift
4. **Expiration**: Gifts automatically expire after configured time (default: 7 days)
5. **Cancellation**: Sender can cancel pending gifts

### Status Flow

```
PENDING → ACCEPTED (receiver accepts)
       → REJECTED (receiver rejects)
       → EXPIRED (time expires)
       → CANCELLED (sender cancels)
```

## API Endpoints

### POST /gifts
Create a new gift
- **Auth**: Required (JWT)
- **Body**: CreateGiftDto
- **Returns**: Created gift

### GET /gifts/sent
Get gifts sent by current user
- **Auth**: Required (JWT)
- **Query**: FilterGiftsDto (status, page, limit)
- **Returns**: Paginated list of sent gifts

### GET /gifts/received
Get gifts received by current user
- **Auth**: Required (JWT)
- **Query**: FilterGiftsDto (status, page, limit)
- **Returns**: Paginated list of received gifts

### GET /gifts/:id
Get a specific gift
- **Auth**: Required (JWT)
- **Params**: id (gift ID)
- **Returns**: Gift details

### POST /gifts/:id/respond
Accept or reject a gift
- **Auth**: Required (JWT)
- **Params**: id (gift ID)
- **Body**: RespondGiftDto (action: accept/reject)
- **Returns**: Updated gift

### DELETE /gifts/:id
Cancel a pending gift
- **Auth**: Required (JWT)
- **Params**: id (gift ID)
- **Returns**: Cancelled gift

## Database Schema

### Table: gifts

| Column | Type | Description |
|--------|------|-------------|
| id | int | Primary key |
| sender_id | int | Foreign key to users |
| receiver_id | int | Foreign key to users |
| shop_item_id | int | Foreign key to shop_items |
| quantity | int | Number of items |
| message | text | Optional message |
| status | enum | Gift status |
| expiration | timestamp | Expiration time |
| accepted_at | timestamp | Acceptance time |
| rejected_at | timestamp | Rejection time |
| nft_contract_address | varchar | NFT contract (Web3) |
| nft_token_id | varchar | NFT token ID (Web3) |
| chain | varchar | Blockchain name (Web3) |
| transaction_hash | varchar | Transaction hash (Web3) |
| metadata | json | Additional data |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

### Indexes

- `IDX_GIFTS_SENDER_STATUS`: (sender_id, status) - Query sent gifts
- `IDX_GIFTS_RECEIVER_STATUS`: (receiver_id, status) - Query received gifts
- `IDX_GIFTS_STATUS_EXPIRATION`: (status, expiration) - Expire old gifts
- `IDX_GIFTS_CREATED_AT`: (created_at) - Sort by date

### Foreign Keys

- `sender_id` → `users.id` (CASCADE on delete)
- `receiver_id` → `users.id` (CASCADE on delete)
- `shop_item_id` → `shop_items.id` (RESTRICT on delete)

## Security Features

1. **Authentication**: All endpoints require JWT authentication
2. **Authorization**: Users can only access their own gifts (sent or received)
3. **Validation**: 
   - Cannot gift to yourself
   - Shop item must be active
   - Users must exist
4. **Transaction Safety**: Uses database transactions for state changes

## Scalability Features

### Database Optimization
- Composite indexes for common query patterns
- Efficient pagination support
- Foreign key constraints for data integrity

### Event-Driven Ready
The architecture supports future event-driven patterns:
- Gift created events
- Gift accepted/rejected events
- Gift expired events
- Integration with notification systems

### Web3 Integration Ready
Fields prepared for NFT and cross-chain gifting:
- `nft_contract_address`: Smart contract address
- `nft_token_id`: Token identifier
- `chain`: Blockchain network (BASE, Ethereum, etc.)
- `transaction_hash`: On-chain transaction reference
- `metadata`: Flexible JSON for blockchain-specific data

## Future Enhancements

### Phase 1: Inventory Integration
- Add items to user inventory on acceptance
- Track item ownership
- Support item usage/consumption

### Phase 2: NFT Support
- Mint NFTs for special items
- Transfer NFTs on gift acceptance
- Verify on-chain ownership

### Phase 3: Cross-Chain Gifting
- Support multiple blockchains
- Bridge assets between chains
- Handle cross-chain transactions

### Phase 4: Event System
- Emit events for gift lifecycle
- Integrate with notification service
- Support webhooks for external systems

### Phase 5: Advanced Features
- Gift bundles (multiple items)
- Scheduled gifts (send at specific time)
- Gift templates
- Gift history analytics

## Testing

The module includes comprehensive unit tests:
- `gifts.service.spec.ts`: Service layer tests
- `gifts.controller.spec.ts`: Controller layer tests

Run tests:
```bash
npm test -- gifts
```

## Maintenance

### Expiring Old Gifts

The service includes an `expireOldGifts()` method that should be called periodically (e.g., via cron job):

```typescript
// Example: Run daily at midnight
@Cron('0 0 * * *')
async handleExpiredGifts() {
  const expired = await this.giftsService.expireOldGifts();
  this.logger.log(`Expired ${expired} old gifts`);
}
```

## Dependencies

- `@nestjs/typeorm`: Database ORM
- `typeorm`: Database operations
- `class-validator`: DTO validation
- `class-transformer`: DTO transformation
- ShopModule: Shop item validation
- UsersModule: User validation
