import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "./form-field";

describe("FormField", () => {
  it("connects the field to its hint and error state", () => {
    render(
      <FormField id="email" label="Email" hint="Use your work email" error="Required">
        <input type="email" />
      </FormField>,
    );

    const input = screen.getByLabelText(/email/i);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Use your work email Required");
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });

  it("reserves space for the error message even when it is hidden", () => {
    const { container } = render(
      <FormField id="name" label="Name">
        <input type="text" />
      </FormField>,
    );

    expect(container.querySelector(".min-h-\\[1\\.25rem\\]"))toBeInTheDocument();
  });
});
