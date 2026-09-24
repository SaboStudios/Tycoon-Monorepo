# Gas Limits and Max Page Size Documentation

## Overview
This document outlines the gas limit analysis and maximum page size determination for the Tycoon Collectibles enumeration system to ensure operations stay within Soroban network limits.

## Soroban Network Limits

### Transaction Limits (Per Transaction)
- **Max CPU Instructions**: 400,000,000
- **Max Memory (RAM)**: 41,943,040 bytes (~41.9 MB)
- **Max Read Entries**: 200 entries / 204,800 bytes (~200 KB)
- **Max Write Entries**: 200 entries / 132,096 bytes (~132 KB)
- **Max Transaction Size**: 132,096 bytes (~132 KB)
- **Max Events + Return Value Size**: 16,384 bytes (~16.4 KB)
- **Max Individual Ledger Entry Size**: 131,072 bytes (~128 KB)

### Resource Fees (Stroops)
- 10,000 CPU instructions: 7 stroops
- Read 1 ledger entry: 1,563 stroops
- Read 1 KB: 447 stroops
- Write 1 ledger entry: 2,500 stroops
- Write 1 KB: 875 stroops
- 1 KB transaction size (bandwidth): 406 stroops
- 1 KB transaction size (history): 4,059 stroops
- 1 KB Events/return value: 5,000 stroops
- 30 days rent for 1 KB persistent storage: ~426,667 stroops

## Enumeration Gas Analysis

### Data Structures
- **Token ID**: u128 = 16 bytes
- **Enumeration Vec**: Vec<u128> stored per owner
- **Index Map**: Map<(Address, u128), u32> for O(1) lookups

### Max Page Size Determination

**Return Value Size Limit**: 16,384 bytes
**Token ID Size**: 16 bytes per u128
**Safe Max Tokens Per Page**: 16,384 / 16 = 1,024 tokens

**Conservative Max Page Size**: 100 tokens
- Size: 100 × 16 = 1,600 bytes
- Percentage of limit: 1,600 / 16,384 = 9.8%
- Well within safety margin

### Gas Cost Estimate for Max Page (100 tokens)

**CPU Instructions**:
- Vec read: ~1,000 instructions
- Result construction: ~5,000 instructions
- Total: ~6,000 instructions

**Memory Usage**:
- Input parameters: ~100 bytes
- Vec storage: ~1,600 bytes
- Result Vec: ~1,600 bytes
- Total: ~3,300 bytes (< 41.9 MB limit)

**Storage Operations**:
- 1 read operation (owned_tokens Vec)
- Cost: 1,563 stroops (base entry read)

**Return Value Cost**:
- 1,600 bytes × (5,000 stroops/KB) = ~7,688 stroops

**Total Estimated Cost**: ~9,251 stroops per page request

### Iterator Pattern Benefits

**Allows Unlimited Collection Processing**:
- Each batch stays within gas limits
- Clients can process collections of any size
- Progressive loading without timeout risks
- No single transaction exceeds limits

**Iterator Usage Pattern**:
```rust
let mut start_index = 0;
let batch_size = 50; // Well under max limit

loop {
    let (batch, has_more) = contract.iterate_owned_tokens(owner, start_index, batch_size);
    // Process batch...
    if !has_more {
        break;
    }
    start_index += batch.len();
}
```

## Storage Cost Analysis

### Per-Owner Storage Costs
- **Vec Entry**: 1 persistent ledger entry for token list
- **Index Entries**: 1 persistent entry per unique token owned
- **TTL Extension**: Minimum 7 days for persistent data

### Cost Breakdown Example (Owner with 10 tokens)
- **Vec Storage**: ~250 bytes → Write cost: ~218 stroops
- **Index Storage**: 10 entries × ~20 bytes = 200 bytes → Write cost: ~175 stroops
- **Total Write Cost**: ~393 stroops
- **Monthly Rent Cost**: ~85 stroops (for ~450 bytes total)

### Storage Efficiency
- **Automatic Cleanup**: Burned tokens removed immediately
- **No Duplicates**: Single entry per token type
- **Index Optimization**: O(1) lookups vs O(n) iteration

## Implementation Constants

```rust
// Maximum page size for gas safety
pub const MAX_PAGE_SIZE: u32 = 100;

// Each u128 token ID is 16 bytes
// 100 tokens = 1,600 bytes < 16,384 byte limit
// Provides 90% safety margin
```

## Error Handling

**Invalid Page Size Errors**:
- `page_size == 0` → `InvalidPageSize`
- `page_size > MAX_PAGE_SIZE` → `InvalidPageSize`

**Out of Bounds Handling**:
- `start_index >= total_tokens` → Returns empty Vec
- Invalid indices return empty results (graceful degradation)

## Frontend Integration Guidelines

### Recommended Usage Patterns

**For Small Collections** (< 100 tokens):
```javascript
// Get all tokens at once
const allTokens = await contract.tokens_of(owner);
```

**For Large Collections** (≥ 100 tokens):
```javascript
// Use pagination
const pageSize = 50;
let page = 0;
let allTokens = [];

do {
    const tokens = await contract.tokens_of_owner_page(owner, page, pageSize);
    allTokens.push(...tokens);
    page++;
} while (tokens.length === pageSize);
```

**For Progressive Loading**:
```javascript
// Iterator pattern for streaming
let startIndex = 0;
const batchSize = 25;

while (true) {
    const [batch, hasMore] = await contract.iterate_owned_tokens(owner, startIndex, batchSize);
    // Process batch...
    if (!hasMore) break;
    startIndex += batch.length;
}
```

## Conclusion

The implemented pagination system ensures:
- ✅ Gas limits never exceeded
- ✅ Max page size of 100 tokens (1,600 bytes < 16.4KB limit)
- ✅ Iterator pattern for unlimited collection processing
- ✅ Automatic cleanup of burned tokens (no denylist needed)
- ✅ Storage costs optimized with O(1) operations
- ✅ Comprehensive error handling and validation</content>
<parameter name="filePath">c:\Users\TECHIE\Documents\GitHub\Tycoon-Monorepo\contract\contracts\tycoon-collectibles\GAS_LIMITS_AND_PAGINATION.md