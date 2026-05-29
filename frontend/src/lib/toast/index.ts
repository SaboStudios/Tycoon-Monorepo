/**
 * Toast Notification Module
 *
 * Provides a centralized toast notification system with deduplication,
 * state management, and graceful error handling.
 *
 * @example
 * ```ts
 * import { toastManager } from '@/lib/toast';
 *
 * toastManager.success('Operation completed');
 * toastManager.error('Something went wrong');
 * ```
 */

export { toastManager } from "./toast-manager";
export type { ToastType, ToastConfig } from "./toast-manager";
export {
  API_ERROR_TOAST_MESSAGES,
  getApiErrorMessage,
  toastApiError,
} from "./api-error-map";
