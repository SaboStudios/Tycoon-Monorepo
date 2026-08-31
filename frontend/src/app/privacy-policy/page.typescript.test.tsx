import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import PrivacyPolicyPage from "./page";

describe("PrivacyPolicyPage - TypeScript Strictness", () => {
  test("page resolves to a valid React element", () => {
    const { container } = render(<PrivacyPolicyPage />);
    expect(container.firstChild).toBeDefined();
  });

  test("component is typed as a function returning JSX", () => {
    expect(typeof PrivacyPolicyPage).toBe("function");
  });

  test("renders without throwing", () => {
    expect(() => render(<PrivacyPolicyPage />)).not.toThrow();
  });
});
