/**
 * Error Handling Module
 *
 * Central export for all error handling utilities
 */

export { ErrorCategory } from "./api-error-map";
export {
  API_ERROR_CATEGORY,
  getApiErrorCategory,
  getApiErrorCategoryFromUnknown,
  getHttpStatusErrorCategory,
} from "./api-error-map";
export {
  ERROR_MESSAGES,
  categorizeError,
  sanitizeError,
  isNetworkError,
  isServerError,
  isRecoverableError,
  type SanitizedError,
} from "./types";
