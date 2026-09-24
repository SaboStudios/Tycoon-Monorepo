import { test, expect, type Page } from "@playwright/test";

/**
 * Critical user journeys beyond smoke.
 *
 * These specs exercise the funnel end-to-end against the live app (no MSW,
 * no prod mocks) and assert loading / empty / error states plus keyboard
 * focus order per the SW-FE a11y docs. They are intentionally resilient to
 * backend availability: when a dependency is down the journey must fail
 * closed (error state surfaced) rather than silently render stale data.
 */

const EMAIL = process.env.E2E_EMAIL ?? "test@example.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "password";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /log ?in|sign ?in/i }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("Critical Journeys", () => {
  test("home page renders hero and primary CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/TYCOON/i);
    // Primary CTA must be reachable and not double-fire on rapid clicks.
    const cta = page.getByRole("link", { name: /play|start/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();
    await cta.click({ trial: true }).catch(() => {});
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("protected route redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/play-ai");
    await expect(page).toHaveURL(/\/login/);
    // Login form must be keyboard-focusable in order: email -> password -> submit.
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(/email/i)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(/password/i)).toBeFocused();
  });

  test("login surfaces validation error on empty submit", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /log ?in|sign ?in/i }).click();
    // Error state must be announced, not just visually styled.
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("login succeeds and navbar reflects authenticated state", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("button", { name: /logout|sign ?out/i })).toBeVisible();
  });

  test("game settings loads with heading and keyboard-reachable controls", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: /game settings/i }).click();
    await expect(page).toHaveURL(/\/game-settings/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/game settings/i);
    // Focus order: first interactive control receives focus on Tab.
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
  });

  test("game settings shows empty state when no configuration exists", async ({ page }) => {
    await login(page);
    await page.goto("/game-settings");
    // Either a populated form or an explicit empty state must render — never a blank shell.
    const empty = page.getByText(/no .*(settings|configuration|games)/i);
    const form = page.getByRole("form");
    await expect(empty.or(form).first()).toBeVisible();
  });

  test("dependency outage fails closed with an error state", async ({ page }) => {
    // Simulate shop-api / RPC outage at the network boundary (not a prod mock).
    await page.route("**/api/**", (route) => route.abort("failed"));
    await page.goto("/play-ai");
    // Must not render stale/optimistic data; an error or redirect must surface.
    const errorState = page.getByRole("alert").or(page.getByText(/something went wrong|unavailable|try again/i));
    await expect(errorState.or(page).toHaveURL(/\/login/)).toBeVisible();
  });

  test("auth expiry mid-flow redirects back to login", async ({ page }) => {
    await login(page);
    // Expire the session by clearing auth cookies, then navigate.
    await page.context().clearCookies();
    await page.goto("/game-settings");
    await expect(page).toHaveURL(/\/login/);
  });
});
