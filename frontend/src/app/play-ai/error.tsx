'use client';

import { ErrorDisplay } from '@/components/ui/error-boundary';

export default function PlayAiError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#010F10] flex items-center justify-center p-4">
      <ErrorDisplay 
        error={error} 
        showTechnical={process.env.NODE_ENV === 'development'}
        onRetry={reset}
      />
    </div>
  );
}
