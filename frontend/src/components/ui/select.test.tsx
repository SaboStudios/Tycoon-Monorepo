import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, describe } from "vitest";
import { Select } from "./select";

const OPTIONS = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
];

describe("Select - Accessibility", () => {
  describe("ARIA attributes", () => {
    test("trigger has role=combobox", () => {
      render(<Select options={OPTIONS} />);
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    test("trigger has aria-haspopup=listbox", () => {
      render(<Select options={OPTIONS} />);
      expect(screen.getByRole("combobox")).toHaveAttribute(
        "aria-haspopup",
        "listbox",
      );
    });

    test("trigger has aria-expanded=false when closed", () => {
      render(<Select options={OPTIONS} />);
      expect(screen.getByRole("combobox")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    test("trigger has aria-expanded=true when open", () => {
      render(<Select options={OPTIONS} />);
      fireEvent.click(screen.getByRole("combobox"));
      expect(screen.getByRole("combobox")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });

    test("accepts aria-labelledby and passes it to trigger and listbox", () => {
      render(
        <>
          <span id="my-label">My Label</span>
          <Select options={OPTIONS} aria-labelledby="my-label" />
        </>,
      );
      expect(screen.getByRole("combobox")).toHaveAttribute(
        "aria-labelledby",
        "my-label",
      );
      fireEvent.click(screen.getByRole("combobox"));
      expect(screen.getByRole("listbox")).toHaveAttribute(
        "aria-labelledby",
        "my-label",
      );
    });

    test("accepts aria-label and passes it to trigger and listbox", () => {
      render(<Select options={OPTIONS} aria-label="Choose option" />);
      expect(screen.getByRole("combobox")).toHaveAttribute(
        "aria-label",
        "Choose option",
      );
      fireEvent.click(screen.getByRole("combobox"));
      expect(screen.getByRole("listbox")).toHaveAttribute(
        "aria-label",
        "Choose option",
      );
    });

    test("listbox renders with role=listbox when open", () => {
      render(<Select options={OPTIONS} />);
      fireEvent.click(screen.getByRole("combobox"));
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    test("options have role=option", () => {
      render(<Select options={OPTIONS} />);
      fireEvent.click(screen.getByRole("combobox"));
      const opts = screen.getAllByRole("option");
      expect(opts).toHaveLength(3);
    });

    test("selected option has aria-selected=true", () => {
      render(<Select options={OPTIONS} value="b" onChange={() => {}} />);
      fireEvent.click(screen.getByRole("combobox"));
      const opts = screen.getAllByRole("option");
      expect(opts[1]).toHaveAttribute("aria-selected", "true");
      expect(opts[0]).toHaveAttribute("aria-selected", "false");
    });
  });

  describe("Keyboard navigation", () => {
    test("Enter opens the listbox", async () => {
      const user = userEvent.setup();
      render(<Select options={OPTIONS} />);
      const trigger = screen.getByRole("combobox");
      trigger.focus();
      await user.keyboard("{Enter}");
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    test("Space opens the listbox", async () => {
      const user = userEvent.setup();
      render(<Select options={OPTIONS} />);
      const trigger = screen.getByRole("combobox");
      trigger.focus();
      await user.keyboard(" ");
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    test("ArrowDown opens the listbox", async () => {
      const user = userEvent.setup();
      render(<Select options={OPTIONS} />);
      const trigger = screen.getByRole("combobox");
      trigger.focus();
      await user.keyboard("{ArrowDown}");
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    test("Escape closes the listbox", async () => {
      render(<Select options={OPTIONS} />);
      const trigger = screen.getByRole("combobox");
      fireEvent.click(trigger);
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      fireEvent.keyDown(trigger, { key: "Escape" });
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    test("ArrowDown moves active index down", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Select options={OPTIONS} onChange={onChange} />);
      const trigger = screen.getByRole("combobox");
      trigger.focus();
      await user.keyboard("{ArrowDown}");
      // listbox open, first item active (index 0)
      await user.keyboard("{ArrowDown}");
      // index 1 now active
      await user.keyboard("{Enter}");
      expect(onChange).toHaveBeenCalledWith("b");
    });

    test("ArrowUp moves active index up", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Select options={OPTIONS} value="c" onChange={onChange} />);
      const trigger = screen.getByRole("combobox");
      trigger.focus();
      await user.keyboard("{ArrowDown}");
      // open, active = index of "c" = 2
      await user.keyboard("{ArrowUp}");
      // active = 1
      await user.keyboard("{Enter}");
      expect(onChange).toHaveBeenCalledWith("b");
    });

    test("Home moves to first option", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Select options={OPTIONS} value="c" onChange={onChange} />);
      const trigger = screen.getByRole("combobox");
      trigger.focus();
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Home}");
      await user.keyboard("{Enter}");
      expect(onChange).toHaveBeenCalledWith("a");
    });

    test("End moves to last option", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Select options={OPTIONS} value="a" onChange={onChange} />);
      const trigger = screen.getByRole("combobox");
      trigger.focus();
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{End}");
      await user.keyboard("{Enter}");
      expect(onChange).toHaveBeenCalledWith("c");
    });

    test("Tab closes the listbox", () => {
      render(<Select options={OPTIONS} />);
      const trigger = screen.getByRole("combobox");
      fireEvent.click(trigger);
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      fireEvent.keyDown(trigger, { key: "Tab" });
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    test("disabled select does not open on keyboard", async () => {
      const user = userEvent.setup();
      render(<Select options={OPTIONS} disabled />);
      const trigger = screen.getByRole("combobox");
      trigger.focus();
      await user.keyboard("{Enter}");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });
});
