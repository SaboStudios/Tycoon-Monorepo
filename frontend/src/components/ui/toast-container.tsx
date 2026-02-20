'use client';

import { ToastContainer as ReactToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export function ToastContainer() {
  return (
    <ReactToastContainer
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
      style={{
        '--toastify-color-dark': '#0E1415',
        '--toastify-color-light': '#0E1415',
        '--toastify-color-info': '#00F0FF',
        '--toastify-color-success': '#00F0FF',
        '--toastify-color-warning': '#00F0FF',
        '--toastify-color-error': '#00F0FF',
        '--toastify-color-transparent': 'rgba(0, 240, 255, 0.1)',
      } as React.CSSProperties}
      toastStyle={{
        backgroundColor: '#0E1415',
        color: '#00F0FF',
        border: '1px solid #003B3E',
        borderRadius: '0.5rem',
      }}
    />
  );
}
