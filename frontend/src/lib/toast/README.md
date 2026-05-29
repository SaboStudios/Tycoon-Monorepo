# Toast Notification Library

A centralized toast notification system with deduplication, state management, and graceful error handling.

## Overview

The toast library provides a singleton `ToastManager` that wraps `react-toastify` with additional features:

- **Deduplication**: Prevents showing identical toasts within a 3-second window
- **State Management**: Tracks active toasts and manages cleanup
- **Error Handling**: Gracefully handles initialization and runtime errors
- **Type Safety**: Full TypeScript support with strict exports

## Usage

### Basic Usage

```typescript
import { toastManager } from '@/lib/toast';

// Show success toast
toastManager.success('Operation completed successfully');

// Show error toast
toastManager.error('Something went wrong');

// Show info toast
toastManager.info('Here is some information');

// Show warning toast
toastManager.warning('Please be careful');
```

### Advanced Usage

```typescript
import { toastManager } from '@/lib/toast';

// Custom options
toastManager.success('Custom message', {
  autoClose: 10000, // 10 seconds
  position: 'top-right',
});

// Using show() directly
toastManager.show({
  type: 'error',
  message: 'Error occurred',
  autoClose: false, // Don't auto-close
});

// Clear all toasts
toastManager.clear();
```

## API Reference

### `toastManager.show(config: ToastConfig): void`

Show a toast with the given configuration.

**Parameters:**
- `config.type`: `'success' | 'error' | 'info' | 'warning'` - Toast type
- `config.message`: `string` - Toast message
- `config.autoClose`: `number | false` (optional) - Auto-close timeout in ms (default: 5000)
- Other `ToastOptions` from react-toastify

**Behavior:**
- Deduplicates identical toasts within 3 seconds
- Validates config and logs warnings for invalid inputs
- Handles errors gracefully without throwing

### Convenience Methods

- `toastManager.success(message: string, options?: ToastOptions): void`
- `toastManager.error(message: string, options?: ToastOptions): void`
- `toastManager.info(message: string, options?: ToastOptions): void`
- `toastManager.warning(message: string, options?: ToastOptions): void`

### `toastManager.clear(): void`

Dismiss all active toasts.

### Internal Methods (for testing)

- `toastManager.resetQueue(): void` - Clear the deduplication queue
- `toastManager.getQueueSize(): number` - Get current queue size

## Deduplication

The toast manager prevents duplicate toasts from appearing in rapid succession:

```typescript
toastManager.success('Loading...');
toastManager.success('Loading...'); // Ignored (within 3s window)

// After 3 seconds:
toastManager.success('Loading...'); // Shown
```

Different toast types with the same message are not deduplicated:

```typescript
toastManager.success('Message');
toastManager.error('Message'); // Both shown
```

## Error Handling

The toast manager handles errors gracefully:

- **Invalid config**: Logs warning, doesn't show toast
- **Toast system errors**: Logs error, doesn't throw
- **Disconnected state**: Validates initialization before showing

This ensures the toast system never breaks the application.

## State Management

The toast manager maintains internal state for:

- **Deduplication queue**: Tracks recently shown toasts
- **Initialization state**: Validates react-toastify availability

Queue entries are automatically cleaned up after the deduplication timeout.

## Testing

The toast manager is fully tested with unit tests covering:

- All toast types (success, error, info, warning)
- Deduplication behavior
- Custom options
- Error handling
- State management
- Queue cleanup

Run tests with:

```bash
pnpm test src/lib/toast/toast-manager.test.ts
```

## Exports

The library uses strict exports via `index.ts`:

```typescript
export { toastManager } from "./toast-manager";
export type { ToastType, ToastConfig } from "./toast-manager";
export {
  API_ERROR_TOAST_MESSAGES,
  getApiErrorMessage,
  toastApiError,
} from "./api-error-map";
```

This ensures only the public API is exposed and prevents accidental internal usage.

## Related Files

- `toast-manager.ts` - Core implementation
- `toast-manager.test.ts` - Unit tests
- `index.ts` - Public exports
