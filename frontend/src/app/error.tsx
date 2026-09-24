'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Home, RefreshCw, Headphones, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useErrorReporting } from '@/hooks/useErrorReporting';
import { siteConfig } from '@/lib/metadata';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const { reportError } = useErrorReporting();

  useEffect(() => {
    // Report error (without PII)
    reportError(error, {
      component: 'GlobalError',
      action: 'server-error',
    });
  }, [error, reportError]);

  return (
    <div className="min-h-screen w-full bg-[#010F10] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Animated error icon */}
        <div className="relative">
          <div className="mx-auto w-24 h-24 rounded-full bg-[#00F0FF]/10 flex items-center justify-center animate-pulse">
            <AlertTriangle className="w-12 h-12 text-[#00F0FF]" />
          </div>
          <div className="absolute inset-0 mx-auto w-24 h-24 rounded-full bg-[#00F0FF]/20 blur-xl" />
        </div>

        {/* Message */}
        <div className="space-y-4">
          <h1 className="text-5xl font-orbitron font-bold text-[#00F0FF] tracking-wider">
            500
          </h1>
          <h2 className="text-2xl font-orbitron text-[#F0F7F7]">
            Server Error
          </h2>
          <p className="text-[#869298] text-lg max-w-md mx-auto">
            Something went wrong on our end. We're working on it.
            Please try again in a few moments.
          </p>
        </div>

        {/* Error code (for support reference) */}
        {error.digest && (
          <div className="p-3 rounded-lg bg-[#0E1415] border border-[#003B3E] inline-block">
            <p className="text-xs font-mono text-[#00F0FF]/50">
              Reference: {error.digest}
            </p>
          </div>
        )}

        {/* Visual element */}
        <div className="flex justify-center gap-4 py-8">
          <div className="w-3 h-3 rounded-full bg-[#00F0FF]/30 animate-pulse" />
          <div className="w-3 h-3 rounded-full bg-[#00F0FF]/60 animate-pulse delay-100" />
          <div className="w-3 h-3 rounded-full bg-[#00F0FF] animate-pulse delay-200" />
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={reset}
            className="bg-[#00F0FF] text-[#010F10] hover:bg-[#00F0FF]/80 font-orbitron px-8 py-6 text-lg"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Try Again
          </Button>
          <Link href="/">
            <Button
              variant="outline"
              className="border-[#003B3E] text-[#00F0FF] hover:bg-[#00F0FF]/10 font-orbitron px-8 py-6 text-lg"
            >
              <Home className="w-5 h-5 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        {/* Support link */}
        <div className="pt-8 border-t border-[#003B3E]">
          <p className="text-[#869298] text-sm mb-4">
            Issue persists? Our team is here to help.
          </p>
          <Link
            href="/support"
            className="inline-flex items-center gap-2 text-[#00F0FF] hover:underline"
          >
            <Headphones className="w-4 h-4" />
            Contact Support
          </Link>
        </div>

        {/* Site info */}
        <footer className="pt-8 text-[#869298] text-sm">
          <p>{siteConfig.name}</p>
        </footer>
      </div>
    </div>
  );
}
