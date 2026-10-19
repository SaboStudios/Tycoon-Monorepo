import { test, expect, type Request } from "@playwright/test";

/**
 * #1761 — Analytics consent critical path.
 *
 * Hermetic: asserts on first-party behaviour and on outgoing requests; no
 * provider script is loaded, so nothing is mocked in the app bundle.
 */

const CONSENT_KEY = "tycoon.telemetry.consent";
const ANALYTICS_HOSTS = /plausible\.io|google-analytics\.com|googletagmanager\.com|posthog\.com/i;

test.describe("Analytics consent (#1761)", () => {
  test("no analytics request leaves the browser before consent", async ({ page }) => {
    const analyticsRequests: string[] = [];
    page.on("request", (request: Request) => {
      if (ANALYTICS_HOSTS.test(request.url())) {
        analyticsRequests.push(request.url());
      }
    });

    await page.goto("/");
    await page.goto("/shop");
    await page.waitForLoadState("networkidle");

    expect(analyticsRequests).toEqual([]);
    expect(await page.evaluate((key) => window.localStorage.getItem(key), CONSENT_KEY)).toBeNull();
  });

  test("banner (when analytics is configured) is keyboard operable and dismisses once", async ({
    page,
  }) => {
    await page.goto("/");
    const banner = page.getByTestId("analytics-consent-banner");
    test.skip(
      !(await banner.isVisible()),
      "Analytics is not configured in this build (NEXT_PUBLIC_ENABLE_ANALYTICS!=true).",
    );

    await expect(banner).toHaveAttribute("role", "region");
    const decline = banner.getByRole("button", { name: "Decline" });
    const accept = banner.getByRole("button", { name: "Accept analytics" });

    await decline.focus();
    await page.keyboard.press("Tab");
    await expect(accept).toBeFocused();

    // Double activation must not error or re-show the banner.
    await accept.dblclick();
    await expect(banner).toBeHidden();
    expect(await page.evaluate((key) => window.localStorage.getItem(key), CONSENT_KEY)).toBe(
      "granted",
    );

    await page.reload();
    await expect(page.getByTestId("analytics-consent-banner")).toBeHidden();
  });

  test("privacy page lets a player grant, withdraw and reset consent", async ({ page }) => {
    await page.goto("/privacy-policy");
    const settings = page.getByTestId("analytics-consent-settings");
    await expect(settings.getByRole("status")).toContainText(/not chosen yet/i);

    await settings.getByRole("button", { name: "Allow analytics" }).click();
    await expect(settings.getByRole("status")).toContainText(/analytics are on/i);

    await settings.getByRole("button", { name: "Turn off analytics" }).click();
    await expect(settings.getByRole("status")).toContainText(/nothing is sent/i);
    expect(await page.evaluate((key) => window.localStorage.getItem(key), CONSENT_KEY)).toBe(
      "denied",
    );

    await settings.getByRole("button", { name: "Reset my choice" }).click();
    expect(await page.evaluate((key) => window.localStorage.getItem(key), CONSENT_KEY)).toBeNull();
  });
});
