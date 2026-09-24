/**
 * Error Handling Module
 *
 * Central export for all error handling utilities
 */

export {
  ErrorCategory,
  ERROR_MESSAGES,
  categorizeError,
  sanitizeError,
  isNetworkError,
  isServerError,
  isRecoverableError,
  type SanitizedError,
} from "./types";
