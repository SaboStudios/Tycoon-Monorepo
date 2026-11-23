import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import LandingPage from "./page";

vi.mock("next/dynamic", () => ({
  default: () => function MockDynamicComponent() {
    return null;
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LandingPage hero loading (#1957)", () => {
  it("ignores the duplicate effect request while the first request is pending", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve; }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <StrictMode>
        <LandingPage />
      </StrictMode>,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch(new Response(JSON.stringify({
      headline: "Build your empire",
      subheadline: "A player-owned economy.",
      ctaLabel: "Start playing",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    expect(await screen.findByRole("heading", { name: "Build your empire" })).toBeInTheDocument();
  });

  it("renders the empty fallback for a successful but invalid payload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ headline: "" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ));
    render(<LandingPage />);

    expect(await screen.findByText(/Nothing to show yet/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Own the board. Roll the dice." })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("renders the retry error for a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    render(<LandingPage />);

    expect(await screen.findByText("We could not load the hero right now. Please retry.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText(/Nothing to show yet/)).not.toBeInTheDocument();
  });

  it("renders the network error and retry button when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<LandingPage />);

    expect(await screen.findByText("Network error. Check your connection and retry.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders exactly one h1 on the landing page (#2169)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      headline: "Own the board. Roll the dice.",
      subheadline: "Tycoon is a player-owned economy on NEAR.",
      ctaLabel: "Play now",
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    render(<LandingPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Own the board. Roll the dice.",
    );
  });

  it("renders fetched content when the hero payload is valid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      headline: "A new headline",
      subheadline: "Fresh content from the service.",
      ctaLabel: "Enter the game",
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    render(<LandingPage />);

    expect(await screen.findByRole("heading", { name: "A new headline" })).toBeInTheDocument();
    expect(screen.getByText("Fresh content from the service.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter the game" })).toHaveAttribute("href", "/play");
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });
});
