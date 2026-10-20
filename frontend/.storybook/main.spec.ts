import { describe, expect, it } from "vitest";

import config from "./main";

describe("storybook main config", () => {
  it("keeps the stories glob covering src/**/*.stories with the expected extensions", () => {
    const stories = config.stories as string[];
    expect(stories.some((glob) => glob.includes("src/**/*.stories"))).toBe(
      true,
    );
    expect(
      stories.some((glob) => /ts\|tsx\|js\|jsx/.test(glob)),
    ).toBe(true);
  });

  it("keeps the addon set the Chromatic gate relies on", () => {
    const addons = config.addons as string[];
    expect(addons).toContain("@storybook/addon-essentials");
    expect(addons).toContain("@storybook/addon-interactions");
    expect(addons).toContain("@storybook/addon-a11y");
  });

  it("keeps the Next.js framework", () => {
    const framework =
      typeof config.framework === "string"
        ? config.framework
        : config.framework?.name;
    expect(framework).toBe("@storybook/nextjs");
  });
});
