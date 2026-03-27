'use client';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export function ToastProvider() {
  return (
    <>
      <ToastContainer
        theme="dark"
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
          '--toastify-color-light': '#00F0FF',
          '--toastify-text-color-dark': '#00F0FF',
        } as React.CSSProperties}
        toastStyle={{
          backgroundColor: '#0E1415',
          color: '#00F0FF',
          border: '1px solid #003B3E',
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
