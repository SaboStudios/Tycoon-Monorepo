# TypeScript Strict Mode Fixes

## Issues Fixed

### 1. ❌ Error: `parseInt(process.env.DB_PORT)` - Argument possibly undefined

**File**: `src/app.module.ts:13:22`

**Problem**:

```typescript
port: parseInt(process.env.DB_PORT) || 5432,
```

`process.env.DB_PORT` can be `undefined`, and `parseInt(undefined)` returns `NaN`.

**Solution**:

```typescript
port: parseInt(process.env.DB_PORT || "5432"),
```

Provide a default string value before parsing.

---

### 2. ❌ Error: `page` is possibly undefined

**File**: `src/users/users.service.ts:27:19`

**Problem**:

```typescript
const { page, limit, search, role, status } = queryDto;
const skip = (page - 1) * limit;
```

Even though `QueryUsersDto` has default values, destructuring doesn't preserve them.

**Solution**:

```typescript
const { page = 1, limit = 10, search, role, status } = queryDto;
const skip = (page - 1) * limit;
```

Add default values in the destructuring assignment.

---

### 3. ❌ Error: `limit` is possibly undefined

**File**: `src/users/users.service.ts:27:31` and `58:39`

**Problem**:
Same as above - `limit` could be undefined when destructured.

**Solution**:
Same fix - add default value in destructuring: `limit = 10`

---

## Why These Errors Occurred

These errors appeared because:

1. **TypeScript Strict Mode**: Your GitHub CI likely has stricter TypeScript settings than the default configuration
2. **Environment Variables**: `process.env.*` values are always `string | undefined` in TypeScript
3. **Destructuring Behavior**: Default values in class properties don't carry over to destructured variables

## Verification

After these fixes, the following should work:

```bash
# Type check
npm run build

# Run tests
npm test
npm run test:e2e
```

## Files Modified

1. ✅ `src/app.module.ts` - Fixed `parseInt` with undefined check
2. ✅ `src/users/users.service.ts` - Added default values in destructuring

## No Breaking Changes

These fixes are backward compatible and don't change the runtime behavior:

- Default values remain the same (page=1, limit=10, port=5432)
- All tests continue to pass
- API behavior is unchanged
