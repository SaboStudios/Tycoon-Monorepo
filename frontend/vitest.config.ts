/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        css: true,
        exclude: ['**/node_modules/**', '**/e2e/**', '**/.{idea,git,cache,output,temp}/**'],
        coverage: {
            provider: 'v8',
            include: [
                'src/lib/near/**',
                'src/components/wallet/**',
                'src/components/providers/near-wallet-provider.tsx',
            ],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 75,
                statements: 80,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
