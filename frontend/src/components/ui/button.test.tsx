import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders as a button with a safe default type", () => {
    render(<Button>Continue</Button>);

    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("respects an explicit button type", () => {
    render(<Button type="submit">Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("applies the requested variant and size classes", () => {
    render(
      <Button variant="outline" size="sm">
        Outline
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Outline" });
    expect(button).toHaveClass("border");
    expect(button).toHaveClass("h-8");
  });
});
