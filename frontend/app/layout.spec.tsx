import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import RootLayout, { metadata } from "./layout";

// layout.tsx imports ./globals.css which is not present in the repo; mock it
// so the component can be rendered under jsdom.
vi.mock("./globals.css", () => ({}));

describe("RootLayout (#1959)", () => {
  it("renders its children", () => {
    render(<RootLayout><p>child</p></RootLayout>);
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("skip link href matches the main id and the main has tabIndex -1", () => {
    render(<RootLayout><p>child</p></RootLayout>);
    const link = screen.getByRole("link", { name: /skip to main content/i });
    const main = screen.getByRole("main");
    expect(link.getAttribute("href")).toBe("#" + main.id);
    expect(main.tabIndex).toBe(-1);
  });

  it("renders banner, main and contentinfo landmarks with aria-labels", () => {
    render(<RootLayout><p>child</p></RootLayout>);
    expect(screen.getByRole("banner", { name: "Site header" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo", { name: "Site footer" })).toBeInTheDocument();
  });

  it("metadata.title.template is '%s | Tycoon'", () => {
    const title = metadata.title as unknown as { template?: string } | undefined;
    expect(title).toBeDefined();
    expect(title?.template).toBe("%s | Tycoon");
  });
});
