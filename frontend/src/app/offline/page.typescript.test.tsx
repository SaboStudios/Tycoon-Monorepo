import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import OfflinePage from "./page";

describe("Offline Page - TypeScript Strictness", () => {
  test("page resolves to a valid React element", async () => {
    const { container } = render(await OfflinePage());
    expect(container.firstChild).toBeDefined();
  });
});
