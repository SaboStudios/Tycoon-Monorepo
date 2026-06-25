import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PropertyCard } from "./PropertyCard";

describe("PropertyCard", () => {
  const defaultProps = {
    name: "Park Place",
  };

  it("renders without throwing with required props", () => {
    const { container } = render(<PropertyCard {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it("displays property name", () => {
    render(<PropertyCard {...defaultProps} />);
    expect(screen.getByText("Park Place")).toBeInTheDocument();
  });

  it("renders with default variant expanded", () => {
    const { container } = render(<PropertyCard {...defaultProps} />);
    expect(container.querySelector("[class*='w-48']")).toBeInTheDocument();
  });

  it("renders with compact variant when specified", () => {
    const { container } = render(<PropertyCard {...defaultProps} variant="compact" />);
    expect(container.querySelector("[class*='w-32']")).toBeInTheDocument();
  });

  it("displays price when provided", () => {
    render(<PropertyCard {...defaultProps} price={350} />);
    expect(screen.getByText("$350")).toBeInTheDocument();
  });

  it("does not display price when not provided", () => {
    const { container } = render(<PropertyCard {...defaultProps} variant="expanded" />);
    expect(container.textContent).not.toMatch(/\$[0-9]+/);
  });

  it("displays rent information in expanded view", () => {
    render(
      <PropertyCard {...defaultProps} variant="expanded" rent={50} houses={2} />
    );
    expect(screen.getByText(/RENT \$50/i)).toBeInTheDocument();
  });

  it("calls onSelect when clicked and isSelectable is true", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <PropertyCard {...defaultProps} isSelectable={true} onSelect={onSelect} />
    );
    const card = container.querySelector("[role='button']");
    if (card instanceof HTMLElement) {
      fireEvent.click(card);
      expect(onSelect).toHaveBeenCalledOnce();
    }
  });

  it("does not call onSelect when not selectable", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <PropertyCard {...defaultProps} isSelectable={false} onSelect={onSelect} />
    );
    const card = container.firstChild as HTMLElement;
    fireEvent.click(card);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("has role button when isSelectable is true", () => {
    const { container } = render(<PropertyCard {...defaultProps} isSelectable={true} />);
    expect(container.querySelector("[role='button']")).toBeInTheDocument();
  });

  it("does not have role button when isSelectable is false", () => {
    const { container } = render(<PropertyCard {...defaultProps} isSelectable={false} />);
    expect(container.querySelector("[role='button']")).not.toBeInTheDocument();
  });

  it("displays selected styling when isSelected is true", () => {
    const { container } = render(
      <PropertyCard {...defaultProps} isSelected={true} />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("border-blue-500");
  });

  it("handles keyboard enter key for selection", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <PropertyCard {...defaultProps} isSelectable={true} onSelect={onSelect} />
    );
    const card = container.querySelector("[role='button']") as HTMLElement;
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("handles keyboard space key for selection", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <PropertyCard {...defaultProps} isSelectable={true} onSelect={onSelect} />
    );
    const card = container.querySelector("[role='button']") as HTMLElement;
    fireEvent.keyDown(card, { key: " " });
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("displays owner information when provided", () => {
    render(<PropertyCard {...defaultProps} variant="expanded" owner="Alice" />);
    expect(screen.getByText(/Owner:/)).toBeInTheDocument();
  });

  it("displays houses count when greater than zero", () => {
    render(<PropertyCard {...defaultProps} variant="expanded" houses={3} />);
    expect(screen.getByText("3 Houses")).toBeInTheDocument();
  });

  it("renders railroad type with correct icon", () => {
    const { container } = render(<PropertyCard {...defaultProps} type="railroad" />);
    expect(container.textContent).toContain("🚂");
  });

  it("renders utility type with correct icon", () => {
    const { container } = render(<PropertyCard {...defaultProps} type="utility" />);
    expect(container.textContent).toContain("💡");
  });

  it("renders property type with color header", () => {
    const { container } = render(<PropertyCard {...defaultProps} type="property" />);
    expect(container.querySelector("[class*='border-b-2']")).toBeInTheDocument();
  });

  it("handles missing optional props gracefully", () => {
    const { container } = render(
      <PropertyCard
        name="Test Property"
        // All optional props omitted
      />
    );
    expect(container).toBeInTheDocument();
    expect(screen.getByText("Test Property")).toBeInTheDocument();
  });
});
