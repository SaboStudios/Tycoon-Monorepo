'use client';

import type { CSSProperties } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useTheme } from '@/components/providers/theme-provider';

export function ToastProvider() {
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';

  return (
    <>
      <ToastContainer
        theme={resolvedTheme}
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        limit={3}
        style={{
          '--toastify-color-dark': '#0E1415',
          '--toastify-color-light': '#FFFFFF',
          '--toastify-text-color-dark': '#F0F7F7',
          '--toastify-text-color-light': '#12262A',
        } as CSSProperties}
        toastStyle={{
          backgroundColor: isDarkTheme ? '#0E1415' : '#FFFFFF',
          color: isDarkTheme ? '#F0F7F7' : '#12262A',
          border: `1px solid ${isDarkTheme ? '#003B3E' : '#C6DDE0'}`,
          borderRadius: '0.375rem',
        }}
      />
      {/* Live region for screen reader announcements */}
      <div
        id="toast-announcements"
        role="region"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  );
}
