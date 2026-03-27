/**
 * Error Boundary Component
 * 
 * Catches React errors and displays a user-friendly error message
 * with recovery options.
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { sanitizeError, ERROR_MESSAGES, ErrorCategory } from '@/lib/errors/types';
import { useErrorReporting } from '@/hooks/useErrorReporting';
import { AlertCircle, RefreshCw, Home, Headphones } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional callback when error is caught */
  onError?: (error: Error) => void;
  /** Whether to show technical details (default: false in production) */
  showTechnical?: boolean;
}

export function ErrorBoundary({ children, onError, showTechnical = false }: ErrorBoundaryProps) {
  const [error, setError] = useState<Error | null>(null);
  const { reportError } = useErrorReporting();

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      const errorObj = event.error || new Error(event.message);
      setError(errorObj);
      reportError(errorObj, { component: 'ErrorBoundary', action: 'global-error' });
      onError?.(errorObj);
    };

    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      const errorObj = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
      setError(errorObj);
      reportError(errorObj, { component: 'ErrorBoundary', action: 'unhandled-rejection' });
      onError?.(errorObj);
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);

    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
    };
  }, [onError, reportError]);

  if (error) {
    return (
      <ErrorDisplay 
        error={error} 
        showTechnical={showTechnical || process.env.NODE_ENV === 'development'}
        onRetry={() => setError(null)}
      />
    );
  }

  return children;
}

interface ErrorDisplayProps {
  error: Error;
  showTechnical?: boolean;
  onRetry?: () => void;
}

/**
 * Display error with user-friendly messaging
 */
export function ErrorDisplay({ error, showTechnical, onRetry }: ErrorDisplayProps) {
  const sanitized = sanitizeError(error);
  const messages = ERROR_MESSAGES[sanitized.category];

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4 bg-[#010F10]">
      <Card className="max-w-md w-full bg-[#0A1A1B]/80 border-[#003B3E] text-[#F0F7F7]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-[#00F0FF]/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-[#00F0FF]" />
          </div>
          <CardTitle className="text-2xl font-orbitron text-[#00F0FF]">
            {messages.title}
          </CardTitle>
          <CardDescription className="text-[#869298] text-base">
            {sanitized.userMessage}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Technical details (only in development or when explicitly shown) */}
          {showTechnical && sanitized.technicalMessage && (
            <div className="p-3 rounded-lg bg-[#0E1415] border border-[#003B3E]">
              <p className="text-xs font-mono text-[#00F0FF]/70">
                Error: {sanitized.technicalMessage}
              </p>
              {sanitized.errorCode && (
                <p className="text-xs font-mono text-[#00F0FF]/50 mt-1">
                  Code: {sanitized.errorCode}
                </p>
              )}
            </div>
          )}

          {/* Error code for support (always show in production) */}
          {!showTechnical && sanitized.errorCode && (
            <p className="text-xs text-center text-[#869298]">
              Reference: {sanitized.errorCode}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {/* Primary action */}
          {sanitized.recoverable && onRetry && (
            <Button
              onClick={onRetry}
              className="w-full bg-[#00F0FF] text-[#010F10] hover:bg-[#00F0FF]/80 font-orbitron"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {messages.action}
            </Button>
          )}

          {/* Navigation actions */}
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              onClick={() => window.location.href = '/'}
              className="flex-1 border-[#003B3E] text-[#00F0FF] hover:bg-[#00F0FF]/10"
            >
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(sanitized.supportLink, '_blank')}
              className="flex-1 border-[#003B3E] text-[#00F0FF] hover:bg-[#00F0FF]/10"
            >
              <Headphones className="w-4 h-4 mr-2" />
              Support
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Get error message for different error types
 */
export function getErrorMessage(error: unknown): {
  title: string;
  message: string;
  action: string;
} {
  const sanitized = sanitizeError(error);
  const messages = ERROR_MESSAGES[sanitized.category];
  return messages;
}
