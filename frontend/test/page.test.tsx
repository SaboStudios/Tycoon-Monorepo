import { expect, test, describe, vi } from "vitest"

// This test verifies the home page client component exists
// The actual page.tsx is a redirect wrapper, the real home is at (home)/page.tsx
test("HomeClient component exists", () => {
  // Verify the HomeClient component file exists
  const fs = require("fs");
  const path = require("path");

  const homeClientPath = path.join(__dirname, "../src/clients/HomeClient.tsx");
  expect(fs.existsSync(homeClientPath)).toBe(true);
});
