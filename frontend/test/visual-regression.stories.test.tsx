import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as visualRegressionStories from "@/stories/visual-regression.stories";

describe("Visual regression stories (#1253)", () => {
  const requiredStories = [
    "MarketingLanding",
    "LandingHero",
    "HUDBoardSquares",
    "HUDShopGrid",
    "JoinRoomIdle",
    "JoinRoomLoading",
    "JoinRoomRoomNotFound",
    "JoinRoomInviteExpired",
    "JoinRoomFull",
    "JoinRoomUnauthorized",
    "JoinRoomSuccess",
  ] as const;

  it.each(requiredStories)("exports %s story", (storyName) => {
    expect(visualRegressionStories[storyName]).toBeDefined();
    expect(typeof visualRegressionStories[storyName]).toBe("function");
  });

  it("HUDShopGrid renders ShopItemData-typed sample items without crashing", () => {
    const { HUDShopGrid } = visualRegressionStories;
    expect(() => render(<HUDShopGrid />)).not.toThrow();
  });
});
