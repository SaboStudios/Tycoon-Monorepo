'use client';

import type { CSSProperties } from 'react';
import { Component, type ReactNode } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useTheme } from '@/components/providers/theme-provider';

interface ToastErrorBoundaryProps {
  children: ReactNode;
}

interface ToastErrorBoundaryState {
  hasError: boolean;
}

class ToastErrorBoundary extends Component<
  ToastErrorBoundaryProps,
  ToastErrorBoundaryState
> {
  constructor(props: ToastErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('ToastProvider error:', error);
    }
  }

  render() {
    if (this.state.hasError) {
      // Render a fallback that doesn't depend on ToastContainer
      return (
        <div
          id="toast-announcements"
          role="region"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />
      );
    }

    return this.props.children;
  }
}

function ToastProviderContent() {
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

export function ToastProvider() {
  return (
    <ToastErrorBoundary>
      <ToastProviderContent />
    </ToastErrorBoundary>
  );
}
