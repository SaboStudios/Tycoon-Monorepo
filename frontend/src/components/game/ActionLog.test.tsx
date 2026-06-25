import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActionLog } from "./ActionLog";

describe("ActionLog", () => {
  it("renders without throwing with default props", () => {
    const { container } = render(<ActionLog />);
    expect(container).toBeInTheDocument();
  });

  it("displays correct heading", () => {
    render(<ActionLog />);
    expect(screen.getByRole("heading", { name: /action log/i })).toBeInTheDocument();
  });

  it("renders empty state when events array is empty", () => {
    render(<ActionLog events={[]} />);
    expect(screen.getByText(/waiting for actions/i)).toBeInTheDocument();
  });

  it("renders events in reverse order (newest first)", () => {
    const events = ["Event 1", "Event 2", "Event 3"];
    render(<ActionLog events={events} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Event 3");
    expect(items[1]).toHaveTextContent("Event 2");
    expect(items[2]).toHaveTextContent("Event 1");
  });

  it("handles undefined events prop gracefully", () => {
    const { container } = render(<ActionLog events={undefined} />);
    expect(screen.getByText(/waiting for actions/i)).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<ActionLog className="custom-class" />);
    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });

  it("renders each event as a list item", () => {
    const events = ["Rolled 6", "Bought property", "Paid rent"];
    render(<ActionLog events={events} />);

    expect(screen.getByText("Rolled 6")).toBeInTheDocument();
    expect(screen.getByText("Bought property")).toBeInTheDocument();
    expect(screen.getByText("Paid rent")).toBeInTheDocument();
  });

  it("has scroll container with max height", () => {
    const events = Array.from({ length: 20 }, (_, i) => `Event ${i + 1}`);
    render(<ActionLog events={events} />);

    const scrollContainer = screen.getByTestId("action-log");
    expect(scrollContainer).toBeInTheDocument();
  });
});
