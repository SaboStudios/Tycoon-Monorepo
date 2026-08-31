import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardSquare, SquareType } from "./BoardSquare";

// Mock next/image to render a plain img tag in tests
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, sizes, loading, ...rest } = props;
    return <img {...rest} data-testid="next-image" />;
  },
}));

describe("BoardSquare", () => {
  const defaultProps = {
    name: "Park Place",
    color: "bg-blue-700",
  };

  it("renders without throwing with required props", () => {
    const { container } = render(<BoardSquare {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it("displays square name correctly", () => {
    render(<BoardSquare {...defaultProps} name="Boardwalk" />);
    expect(screen.getByText("Boardwalk")).toBeInTheDocument();
  });

  it("renders null when name is missing", () => {
    const { container } = render(<BoardSquare name="" color="bg-blue-700" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when color is missing", () => {
    const { container } = render(<BoardSquare name="Park Place" color="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders with default type 'property' when not specified", () => {
    render(<BoardSquare {...defaultProps} />);
    const gridcell = screen.getByRole("gridcell");
    expect(gridcell).toHaveAttribute("data-type", "property");
  });

  it("applies correct styling for different square types", () => {
    const types: SquareType[] = ["go", "jail", "corner", "chance", "community", "tax", "property"];

    types.forEach((type) => {
      const { container } = render(
        <BoardSquare {...defaultProps} type={type} key={type} />
      );
      const gridcell = container.querySelector("[role='gridcell']");
      expect(gridcell).toHaveAttribute("data-type", type);
    });
  });

  it("displays position number when provided", () => {
    render(<BoardSquare {...defaultProps} position={5} />);
    expect(screen.getByText("#5")).toBeInTheDocument();
  });

  it("does not display position when not provided", () => {
    const { container } = render(<BoardSquare {...defaultProps} />);
    // When position is not provided, # text should not appear in the component
    expect(container.textContent).not.toMatch(/#\d+/);
  });

  it("has accessible aria-label", () => {
    render(
      <BoardSquare {...defaultProps} position={1} type="property" />
    );
    const gridcell = screen.getByRole("gridcell");
    expect(gridcell).toHaveAttribute("aria-label", expect.stringContaining("Park Place"));
  });

  it("calls onFocus when focused", () => {
    const onFocus = vi.fn();
    const { container } = render(
      <BoardSquare {...defaultProps} isFocused={true} onFocus={onFocus} />
    );
    const gridcell = container.querySelector("[role='gridcell']");
    if (gridcell instanceof HTMLElement) {
      fireEvent.focus(gridcell);
      expect(onFocus).toHaveBeenCalled();
    }
  });

  it("has tabIndex 0 when isFocused is true, -1 otherwise", () => {
    const { rerender, container: container1 } = render(
      <BoardSquare {...defaultProps} isFocused={true} />
    );
    let gridcell = container1.querySelector("[role='gridcell']");
    expect(gridcell).toHaveAttribute("tabIndex", "0");

    rerender(<BoardSquare {...defaultProps} isFocused={false} />);
    gridcell = container1.querySelector("[role='gridcell']");
    expect(gridcell).toHaveAttribute("tabIndex", "-1");
  });

  it("renders type-specific icons correctly", () => {
    const { container: container1 } = render(
      <BoardSquare {...defaultProps} type="chance" />
    );
    expect(container1.textContent).toContain("?");

    const { container: container2 } = render(
      <BoardSquare {...defaultProps} type="community" />
    );
    expect(container2.textContent).toContain("📦");

    const { container: container3 } = render(
      <BoardSquare {...defaultProps} type="tax" />
    );
    expect(container3.textContent).toContain("💰");

    const { container: container4 } = render(
      <BoardSquare {...defaultProps} type="jail" />
    );
    expect(container4.textContent).toContain("🔒");
  });

  it("handles focus ring styling when isFocused is true", () => {
    const { container } = render(
      <BoardSquare {...defaultProps} isFocused={true} />
    );
    const gridcell = container.querySelector("[role='gridcell']");
    expect(gridcell?.className).toContain("ring-2");
  });

  // --- Image lazy-loading tests ---
  describe("image support", () => {
    it("renders an image when imageUrl is provided for property type", () => {
      render(
        <BoardSquare {...defaultProps} imageUrl="/tiles/park-place.png" />
      );
      const img = screen.getByTestId("next-image");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "/tiles/park-place.png");
      expect(img).toHaveAttribute("alt", "Park Place");
    });

    it("does not render an image when imageUrl is not provided", () => {
      render(<BoardSquare {...defaultProps} />);
      expect(screen.queryByTestId("next-image")).toBeNull();
    });

    it("does not render an image for non-property types even with imageUrl", () => {
      render(
        <BoardSquare {...defaultProps} type="chance" imageUrl="/tiles/chance.png" />
      );
      expect(screen.queryByTestId("next-image")).toBeNull();
    });

    it("keeps color strip as background behind image", () => {
      const { container } = render(
        <BoardSquare {...defaultProps} imageUrl="/tiles/park-place.png" />
      );
      const header = container.querySelector(".bg-blue-700");
      expect(header).toBeInTheDocument();
    });
  });
});
