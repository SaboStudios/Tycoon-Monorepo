import { test, expect } from "@playwright/test";

/**
 * Smoke path: home -> join room -> invalid code.
 *
 * Simulates an authenticated visitor (join-room requires an access token
 * before it will call the API) submitting a syntactically valid but
 * non-existent room code, and asserts the form surfaces an inline error
 * instead of navigating to the game-waiting screen.
 */
test.describe("Smoke: home -> join-room -> invalid code", () => {
  test("navigates from home into join-room and surfaces an error for an invalid code", async ({
    page,
  }) => {
    // Seed an access token so JoinRoomForm attempts the API call rather than
    // short-circuiting to the "unauthorized" state.
    await page.addInitScript(() => {
      window.localStorage.setItem("access_token", "smoke-test-token");
    });

    // The `/join-room` route is auth-gated in middleware.ts (redirects to
    // /login when the `auth-token` cookie is absent). Seed the cookie so the
    // authenticated-visitor path under test is actually exercised.
    await page.context().addCookies([
      {
        name: "auth-token",
        value: "smoke-test-token",
        url: "http://localhost:3000",
      },
    ]);

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

    await page.goto("/");
    await expect(page.locator("h1")).toContainText("TYCOON");

    await page.getByRole("button", { name: /join room/i }).click();
    await expect(page).toHaveURL(/\/join-room/);

    const roomCodeInput = page.locator("#room-code");
    await expect(roomCodeInput).toBeVisible();

    // Syntactically valid (6 alphanumeric chars) so the submit button
    // enables, but the stubbed backend reports it as not found.
    await roomCodeInput.fill("ABC123");
    await page.getByRole("button", { name: /^join$/i }).click();

    await expect(page.locator("#room-code, [data-testid='form-error-banner']")).toBeVisible();
    await expect(page.getByRole("alert")).toBeVisible();
  });
});
