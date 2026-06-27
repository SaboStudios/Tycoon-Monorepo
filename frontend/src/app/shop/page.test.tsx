import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ShopPage, { isPurchasablePreviewItem } from "./page";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("@/lib/analytics", () => ({ track }));

describe("ShopPage", () => {
  beforeEach(() => {
    track.mockReset();
  });

  test("provides labelled route landmarks and a polite tracking status", () => {
    const { container } = render(<ShopPage />);

    expect(
      container.querySelector('main[aria-labelledby="shop-page-title"]'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Analytics Taxonomy Staging Route",
      }),
    ).toHaveAttribute("id", "shop-page-title");

    const status = container.querySelector("#shop-status-announcer");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
  });

  test("puts the skip link before each purchase control", () => {
    render(<ShopPage />);

    const skipLink = screen.getByRole("link", { name: "Skip to shop items" });
    const starterPurchase = screen.getByRole("button", {
      name: "Track purchase for Starter Pack",
    });
    const founderPurchase = screen.getByRole("button", {
      name: "Track purchase for Founder Badge",
    });
    const focusables = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );

    expect(skipLink).toHaveAttribute("href", "#shop-preview-content");
    expect(focusables.indexOf(skipLink)).toBeLessThan(
      focusables.indexOf(starterPurchase),
    );
    expect(focusables.indexOf(starterPurchase)).toBeLessThan(
      focusables.indexOf(founderPurchase),
    );
    expect(skipLink.className).toContain("focus:not-sr-only");
  });

  test("tracks a valid item and announces the result", async () => {
    const user = userEvent.setup();
    render(<ShopPage />);

    await user.click(
      screen.getByRole("button", { name: "Track purchase for Starter Pack" }),
    );

    expect(track).toHaveBeenCalledWith("purchase_click", {
      route: "/shop",
      item_id: "starter-pack",
      item_name: "Starter Pack",
      item_category: "bundle",
      currency: "USD",
      value: 20,
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Purchase tracking event recorded.",
    );
  });

  test("keeps the page usable when analytics is unavailable", async () => {
    const user = userEvent.setup();
    track.mockImplementationOnce(() => {
      throw new Error("analytics unavailable");
    });
    render(<ShopPage />);

    await user.click(
      screen.getByRole("button", { name: "Track purchase for Founder Badge" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Purchase tracking is temporarily unavailable.",
    );
    expect(
      screen.getByRole("button", { name: "Track purchase for Starter Pack" }),
    ).toBeEnabled();
  });
});

describe("isPurchasablePreviewItem", () => {
  test("rejects missing and invalid preview data before it reaches analytics", () => {
    expect(isPurchasablePreviewItem(null)).toBe(false);
    expect(isPurchasablePreviewItem(undefined)).toBe(false);
    expect(
      isPurchasablePreviewItem({
        id: "bad-price",
        name: "Bad price",
        category: "bundle",
        price: Number.NaN,
      }),
    ).toBe(false);
  });
});
