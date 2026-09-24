/**
 * Error Types and Utilities
 * 
 * Defines error types and helper functions for consistent error handling
 * across the Tycoon application.
 */

/**
 * Error categories for user-friendly messaging
 */
export enum ErrorCategory {
  /** Network-related errors (offline, timeout, server unreachable) */
  NETWORK = 'network',
  /** Authentication/authorization errors */
  AUTH = 'auth',
  /** Client-side validation errors */
  VALIDATION = 'validation',
  /** Server errors (5xx) */
  SERVER = 'server',
  /** Not found errors (404) */
  NOT_FOUND = 'not_found',
  /** Rate limiting errors */
  RATE_LIMIT = 'rate_limit',
  /** Unknown/unexpected errors */
  UNKNOWN = 'unknown',
}

/**
 * Sanitized error object safe for client-side display
 * Never includes PII, tokens, or sensitive data
 */
export interface SanitizedError {
  /** Error category for messaging */
  category: ErrorCategory;
  /** User-friendly message */
  userMessage: string;
  /** Technical message (sanitized, no secrets) */
  technicalMessage?: string;
  /** Error code for support reference */
  errorCode?: string;
  /** Whether the error is recoverable */
  recoverable: boolean;
  /** Suggested action for user */
  suggestedAction?: string;
  /** Support link if applicable */
  supportLink?: string;
}

/**
 * Error messages by category
 * Generic failure vs network failure copy
 */
export const ERROR_MESSAGES: Record<ErrorCategory, {
  title: string;
  message: string;
  action: string;
  supportLink: string;
}> = {
  [ErrorCategory.NETWORK]: {
    title: 'Connection Issue',
    message: 'We couldn\'t reach our servers. Please check your internet connection and try again.',
    action: 'Check Connection',
    supportLink: '/support/network-issues',
  },
  [ErrorCategory.AUTH]: {
    title: 'Authentication Required',
    message: 'Your session has expired. Please sign in again to continue.',
    action: 'Sign In',
    supportLink: '/support/account-access',
  },
  [ErrorCategory.VALIDATION]: {
    title: 'Invalid Input',
    message: 'Some information doesn\'t look quite right. Please review and try again.',
    action: 'Review Input',
    supportLink: '/support/form-help',
  },
  [ErrorCategory.SERVER]: {
    title: 'Server Error',
    message: 'Something went wrong on our end. We\'re working on it. Please try again in a few moments.',
    action: 'Try Again',
    supportLink: '/support/server-error',
  },
  [ErrorCategory.NOT_FOUND]: {
    title: 'Page Not Found',
    message: 'The page you\'re looking for doesn\'t exist or has been moved.',
    action: 'Go Home',
    supportLink: '/support/missing-page',
  },
  [ErrorCategory.RATE_LIMIT]: {
    title: 'Too Many Requests',
    message: 'You\'ve made too many requests. Please wait a moment and try again.',
    action: 'Wait & Retry',
    supportLink: '/support/rate-limit',
  },
  [ErrorCategory.UNKNOWN]: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Don\'t worry, we\'ve been notified and are looking into it.',
    action: 'Try Again',
    supportLink: '/support/general-help',
  },
};

/**
 * Categorize an error based on status code or error type
 * @param error - The error to categorize
 * @returns The error category
 */
export function categorizeError(error: unknown): ErrorCategory {
  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return ErrorCategory.NETWORK;
    }
    if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
      return ErrorCategory.AUTH;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }
  }

  // Handle Response objects (from fetch)
  if (error instanceof Response) {
    if (error.status === 404) return ErrorCategory.NOT_FOUND;
    if (error.status === 401 || error.status === 403) return ErrorCategory.AUTH;
    if (error.status === 429) return ErrorCategory.RATE_LIMIT;
    if (error.status >= 500) return ErrorCategory.SERVER;
  }

  // Handle objects with status property
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    if (status === 404) return ErrorCategory.NOT_FOUND;
    if (status === 401 || status === 403) return ErrorCategory.AUTH;
    if (status === 429) return ErrorCategory.RATE_LIMIT;
    if (status >= 500) return ErrorCategory.SERVER;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Sanitize an error for client-side display
 * IMPORTANT: Never includes PII, tokens, or sensitive data
 * @param error - The error to sanitize
 * @returns Sanitized error safe for display
 */
export function sanitizeError(error: unknown): SanitizedError {
  const category = categorizeError(error);
  const messages = ERROR_MESSAGES[category];

  // Extract safe technical details
  let technicalMessage: string | undefined;
  let errorCode: string | undefined;

  if (error instanceof Error) {
    // Only include safe technical details
    technicalMessage = error.name;
    errorCode = generateErrorCode(category);
  } else if (error instanceof Response) {
    technicalMessage = `HTTP ${error.status}`;
    errorCode = generateErrorCode(category);
  } else if (error && typeof error === 'object' && 'status' in error) {
    technicalMessage = `HTTP ${(error as { status: number }).status}`;
    errorCode = generateErrorCode(category);
  }

  return {
    category,
    userMessage: messages.message,
    technicalMessage,
    errorCode,
    recoverable: category !== ErrorCategory.NOT_FOUND,
    suggestedAction: messages.action,
    supportLink: messages.supportLink,
  };
}

/**
 * Generate a unique error code for support reference
 * Format: TYC-{CATEGORY}-{TIMESTAMP}
 */
function generateErrorCode(category: ErrorCategory): string {
  const categoryCode = category.substring(0, 4).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `TYC-${categoryCode}-${timestamp}`;
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  return categorizeError(error) === ErrorCategory.NETWORK;
}

/**
 * Check if an error is a server error
 */
export function isServerError(error: unknown): boolean {
  return categorizeError(error) === ErrorCategory.SERVER;
}

/**
 * Check if an error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  const category = categorizeError(error);
  return category !== ErrorCategory.NOT_FOUND;
}
