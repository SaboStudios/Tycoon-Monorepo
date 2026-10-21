import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    {
      name: "landing-page-dynamic-test-modules",
      enforce: "pre",
      resolveId(source, importer) {
        if (!importer?.endsWith("/app/page.tsx")) return null;
        if (source === "../components/WalletConnectButton") return "\0mock-wallet-button";
        if (source === "../components/GameBoardPreview") return "\0mock-game-board-preview";
        return null;
      },
      load(id) {
        if (id === "\0mock-wallet-button" || id === "\0mock-game-board-preview") {
          return "export default function MockDynamicComponent() { return null; }";
        }
        return null;
      },
    },
    react(),
  ],
  resolve: {
    alias: [
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "test/**/*.test.{ts,tsx}",
      "src/**/*.test.{ts,tsx}",
      "src/**/*.spec.{ts,tsx}",
      "app/**/*.spec.{ts,tsx}",
    ],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
  },
});
