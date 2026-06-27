import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const usePathnameMock = vi.fn<string | null, []>();
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

import { RouteFocusProvider } from "@/components/providers/route-focus-provider";

describe("RouteFocusProvider", () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
    document.body.innerHTML = "";
  });

  it("focuses the route focus anchor when the pathname changes", async () => {
    usePathnameMock.mockReturnValue("/first-route");

    const { rerender } = render(
      <RouteFocusProvider>
        <div>content</div>
      </RouteFocusProvider>,
    );

    const anchor = screen.getByTestId("route-focus-anchor");
    await waitFor(() => expect(document.activeElement).toBe(anchor));

    usePathnameMock.mockReturnValue("/second-route");
    rerender(
      <RouteFocusProvider>
        <div>content</div>
      </RouteFocusProvider>,
    );

    await waitFor(() => expect(document.activeElement).toBe(anchor));
  });

  it("does not crash when pathname is unavailable", async () => {
    usePathnameMock.mockReturnValue(null);

    render(
      <RouteFocusProvider>
        <div>content</div>
      </RouteFocusProvider>,
    );

    expect(screen.getByTestId("route-focus-anchor")).toBeInTheDocument();
  });
});
