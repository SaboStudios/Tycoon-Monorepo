import { render, screen } from "@testing-library/react";
import { expect, test, describe } from "vitest";
import { ShopItem } from "./ShopItem";

describe("ShopItem price rendering (#2155)", () => {
  test("renders a normal positive price with the buy button enabled", () => {
    render(
      <ShopItem
        id={1}
        name="Golden House"
        description="Upgrade your property"
        price={100}
      />
    );

    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByTestId("shop-item-buy-1")).not.toBeDisabled();
  });

  test("shows an unavailable state and disables purchase for a negative price", () => {
    render(
      <ShopItem
        id={2}
        name="Broken Deal"
        description="Should never be a discount"
        price={-1}
      />
    );

    expect(screen.getByTestId("shop-item-unavailable-2")).toHaveTextContent(
      "Unavailable"
    );
    expect(screen.queryByText("$-1.00")).not.toBeInTheDocument();
    expect(screen.getByTestId("shop-item-buy-2")).toBeDisabled();
  });

  test("shows an unavailable state and disables purchase for a NaN price", () => {
    render(
      <ShopItem
        id={3}
        name="Corrupt Payload"
        description="Price failed to parse"
        price={NaN}
      />
    );

    expect(screen.getByTestId("shop-item-unavailable-3")).toHaveTextContent(
      "Unavailable"
    );
    expect(screen.queryByText("$NaN")).not.toBeInTheDocument();
    expect(screen.getByTestId("shop-item-buy-3")).toBeDisabled();
  });

  test("shows an unavailable state for a non-finite (Infinity) price", () => {
    render(
      <ShopItem
        id={4}
        name="Infinite Discount Bug"
        description="Should fail closed"
        price={Infinity}
      />
    );

    expect(screen.getByTestId("shop-item-unavailable-4")).toHaveTextContent(
      "Unavailable"
    );
    expect(screen.getByTestId("shop-item-buy-4")).toBeDisabled();
  });

  test("still respects an explicit disabled prop even with a valid price", () => {
    render(
      <ShopItem
        id={5}
        name="Sold Out"
        description="Out of stock"
        price={50}
        disabled
      />
    );

    expect(screen.getByText("$50.00")).toBeInTheDocument();
    expect(screen.getByTestId("shop-item-buy-5")).toBeDisabled();
  });
});
