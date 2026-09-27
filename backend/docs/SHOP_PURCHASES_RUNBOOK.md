# Operational Runbook: Shop & Purchases

## Overview
This runbook covers the operational procedures for managing the Tycoon Shop and Purchases module, including troubleshooting failed transactions, managing coupons, and auditing financial activity.

## Authoritative Purchase Path

The backend `ShopModule` is currently the only path connected to the authoritative
`shop_items`, coupon, purchase, and user-inventory tables. It calculates prices
from catalog data and must remain the storefront write path. The standalone
`shop-api` currently stores purchase records using a client-provided amount and
has no catalog or stock model; do not route storefront purchases to it until a
catalog-backed integration and migration are deployed. This boundary must be
revisited before any shop-api cutover.

Backend owned-item inventory consumption must use an atomic conditional update;
do not implement stock reservations against `user_inventory`, which represents
items already owned by a player rather than sellable catalog stock.

## Rollback Notes

For purchase or catalog regressions, disable the affected storefront write route
at the API gateway and keep the backend catalog path as the only enabled writer.
Do not switch traffic to `shop-api` as a rollback target until it can read the
same authoritative catalog and enforce its inventory constraints.

## Common Issues & Troubleshooting

### 1. Failed Purchases
If a user reports a failed purchase but claims they were charged (or vice versa):
1.  **Check Audit Logs**:
    ```sql
    SELECT * FROM audit_trails 
    WHERE action = 'PURCHASE_CREATED' 
    AND user_id = <USER_ID> 
    ORDER BY created_at DESC;
    ```
2.  **Verify Ledger**: Check the `ledger_reconciliation` module/logs to see if the transaction was recorded in the internal ledger.
3.  **Inventory Check**: Verify if the item exists in the user's inventory:
    ```sql
    SELECT * FROM user_inventories 
    WHERE user_id = <USER_ID> 
    AND shop_item_id = <ITEM_ID>;
    ```

### 2. Invalid Coupon Errors
If coupons are not working as expected:
-   **Expiry**: Check `valid_until` in the `coupons` table.
-   **Usage Limit**: Check if `usage_count` has reached `max_usages`.
-   **Scope**: Ensure the coupon is valid for the specific `shop_item_id`.

### 3. Inventory Out of Sync
If a user cannot see their purchased items:
-   The cache might be stale. Invalidate the shop cache for the user:
    -   Redis Key: `shop:inventory:<USER_ID>`
    -   Action: `DEL shop:inventory:<USER_ID>`

## Operational Procedures

### Deactivating a Malfunctioning Shop Item
If an item is causing issues (e.g., incorrect pricing), deactivate it immediately:
```sql
UPDATE shop_items SET active = false WHERE id = <ITEM_ID>;
```
This is preferred over deletion to preserve historical purchase records.

### Refunding a Purchase
Currently, refunds are handled manually by:
1.  Removing the item from `user_inventories`.
2.  Crediting the user's balance (if applicable).
3.  Logging the action in `audit_trails` with a reason.

## Monitoring & Metrics
-   **Metric**: `tycoon_purchases_total` - Track successful vs failed purchases.
-   **Metric**: `tycoon_coupon_usage_total` - Monitor marketing campaign effectiveness.

## Support Contacts
-   Backend Team: #team-backend
-   Finance/Operations: #ops-billing
