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
        exclude: ['e2e/**', 'node_modules/**', 'dist/**', '.next/**'],
        server: {
            deps: {
                // Allow msw/node to run in the vitest Node environment
                inline: ['msw'],
            },
        },
        // Coverage configuration (used when running `vitest run --coverage`).
        // Provider: @vitest/coverage-v8 (installed as devDependency).
        // Global thresholds are moderate to avoid flakiness; per-path thresholds
        // below are stricter to catch regressions on high-risk shop and auth code.
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'json-summary'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'src/**/*.stories.{ts,tsx}',
                'src/test/**',
                'src/mocks/**',
                'e2e/**',
            ],
            thresholds: {
                // Global safety net — don't drop below these.
                lines: 60,
                functions: 60,
                branches: 55,
                statements: 60,
                // Critical paths: shop and auth client-side modules.
                'src/lib/shop/**': {
                    lines: 70,
                    functions: 70,
                    branches: 65,
                    statements: 70,
                },
                'src/lib/auth/**': {
                    lines: 70,
                    functions: 70,
                    branches: 65,
                    statements: 70,
                },
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
