import { test, expect } from "@playwright/test";

/**
 * Smoke path: home -> join room -> strict validation error states.
 *
 * Simulates an authenticated visitor (join-room requires an access token
 * before it will call the API) exercising the strict validation error
 * states of the Join room funnel:
 *   - client-side invalid code (never hits the API)
 *   - API 404 (room not found)
 *   - API 500 (server error, distinct from empty/not-found)
 *   - wallet reject / auth expiry mid-flow
 *   - double CTA clicks (idempotency)
 *
 * Each case asserts the form surfaces an inline, announced error instead of
 * navigating to the game-waiting screen.
 */

const AUTH_COOKIE = {
  name: "auth-token",
  value: "smoke-test-token",
  url: "http://localhost:3000",
};

async function seedAuthenticatedVisitor(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("access_token", "smoke-test-token");
  });
  await page.context().addCookies([AUTH_COOKIE]);
}

async function gotoJoinRoom(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("TYCOON");
  await page.getByRole("button", { name: /join room/i }).click();
  await expect(page).toHaveURL(/\/join-room/);
  const roomCodeInput = page.locator("#room-code");
  await expect(roomCodeInput).toBeVisible();
  return roomCodeInput;
}

test.describe("Smoke: home -> join-room -> strict validation error states", () => {
  test("navigates from home into join-room and surfaces an error for an invalid code", async ({
    page,
  }) => {
    await seedAuthenticatedVisitor(page);

    // Stub the join endpoint to behave like an invalid/non-existent room code.
    await page.route("**/api/v1/games/*/join", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          statusCode: 404,
          message: "Room not found",
        }),
      });
    });

    const roomCodeInput = await gotoJoinRoom(page);

    // Syntactically valid (6 alphanumeric chars) so the submit button
    // enables, but the stubbed backend reports it as not found.
    await roomCodeInput.fill("ABC123");
    await page.getByRole("button", { name: /^join$/i }).click();

    await expect(page.locator("#room-code, [data-testid='form-error-banner']")).toBeVisible();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("rejects a malformed room code client-side without calling the API", async ({
    page,
  }) => {
    await seedAuthenticatedVisitor(page);

    let apiCalls = 0;
    await page.route("**/api/v1/games/*/join", async (route) => {
      apiCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    const roomCodeInput = await gotoJoinRoom(page);

    // Adversarial input: too short / illegal characters.
    await roomCodeInput.fill("ab!");
    await page.getByRole("button", { name: /^join$/i }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/join-room/);
    expect(apiCalls).toBe(0);
  });

  test("maps API 500 distinctly from an empty/not-found response", async ({ page }) => {
    await seedAuthenticatedVisitor(page);

    await page.route("**/api/v1/games/*/join", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          statusCode: 500,
          message: "Internal server error",
        }),
      });
    });

    const roomCodeInput = await gotoJoinRoom(page);
    await roomCodeInput.fill("ABC123");
    await page.getByRole("button", { name: /^join$/i }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    // Server error copy must not be conflated with "room not found".
    await expect(alert).not.toContainText(/not found/i);
    await expect(page).toHaveURL(/\/join-room/);
  });

  test("surfaces a wallet-reject error and stays on the join form", async ({ page }) => {
    await seedAuthenticatedVisitor(page);

    await page.route("**/api/v1/games/*/join", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          statusCode: 403,
          message: "Wallet signature rejected",
        }),
      });
    });

    const roomCodeInput = await gotoJoinRoom(page);
    await roomCodeInput.fill("ABC123");
    await page.getByRole("button", { name: /^join$/i }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/join-room/);
  });

  test("handles auth expiry mid-flow by failing closed", async ({ page }) => {
    await seedAuthenticatedVisitor(page);

    await page.route("**/api/v1/games/*/join", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          statusCode: 401,
          message: "Unauthorized",
        }),
      });
    });

    const roomCodeInput = await gotoJoinRoom(page);
    await roomCodeInput.fill("ABC123");
    await page.getByRole("button", { name: /^join$/i }).click();

    // Fail-closed: no navigation into the game, an error is announced.
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).not.toHaveURL(/\/game/);
  });

  test("double CTA clicks do not fire duplicate join requests", async ({ page }) => {
    await seedAuthenticatedVisitor(page);

    let apiCalls = 0;
    await page.route("**/api/v1/games/*/join", async (route) => {
      apiCalls += 1;
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ statusCode: 404, message: "Room not found" }),
      });
    });

    const roomCodeInput = await gotoJoinRoom(page);
    await roomCodeInput.fill("ABC123");

    const joinButton = page.getByRole("button", { name: /^join$/i });
    await joinButton.click();
    await joinButton.click({ force: true }).catch(() => undefined);

    await expect(page.getByRole("alert")).toBeVisible();
    expect(apiCalls).toBeLessThanOrEqual(1);
  });
});
