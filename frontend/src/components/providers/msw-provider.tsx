'use client';

import { useEffect } from 'react';
import { worker } from '@/mocks/browser';

export function MSWProvider() {
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      worker.start({
        onUnhandledRequest: 'bypass',
      });
    }

    return () => {
      worker.stop();
    };
  }, []);

  return null;
}
