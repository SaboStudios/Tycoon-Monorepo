import { test, expect } from "@playwright/test";

test.describe("Critical Journeys", () => {
  test("should load the home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("TYCOON");
  });

  test("should redirect to login for protected routes", async ({ page }) => {
    // Attempt to access a protected route
    await page.goto("/play-ai");
    // Should be redirected to /login (or / if logged out in some cases)
    await expect(page).toHaveURL(/\/login/);
  });

  test("should allow logging in (mocked)", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "password");
    await page.click('button[type="submit"]');
    
    // After login, should be back on home page
    await expect(page).toHaveURL("/");
    // Navbar should show logout button now
    await expect(page.locator('button:has-text("Logout")')).toBeVisible();
  });

  test("should open the game settings", async ({ page }) => {
    // First, login
    await page.goto("/login");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "password");
    await page.click('button[type="submit"]');

    // Go to game settings
    await page.click('a:has-text("Game Settings")');
    await expect(page).toHaveURL("/game-settings");
    await expect(page.locator("h1")).toContainText(/Game Settings/i);
  });
});
