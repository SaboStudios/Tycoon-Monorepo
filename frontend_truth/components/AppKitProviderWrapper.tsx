// components/AppKitProviderWrapper.tsx
'use client';

import { ReactNode, useEffect } from 'react';
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { celo } from '@reown/appkit/networks';

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID || '912f9a3279905a7dd417a7bf68e04209';

// Celo only (Base support paused)
const wagmiAdapter = new WagmiAdapter({
  networks: [celo],
  projectId,
  ssr: true, // Important for Next.js
});

let isInitialized = false;

export default function AppKitProviderWrapper({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    if (!isInitialized) {
      createAppKit({
        adapters: [wagmiAdapter],
        networks: [celo],
        projectId,
        themeVariables: {
          '--w3m-z-index': 10000, // Set high z-index for Reown modal
        },
        metadata: {
          name: 'Tycoon',
          description: 'Play Monopoly onchain',
          url: 'http://localhost:3000', // Update to your deployed URL
          icons: ['https://avatars.githubusercontent.com/u/37784886'], // Replace with your logo
        },
      });
      isInitialized = true;
    }
  }, []);

  return <>{children}</>;
}