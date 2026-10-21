import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import JoinRoomPage from "./page";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

// next/navigation is only used for router.push on success; validation-error
// paths never reach it, but mock it so the client component mounts in jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JoinRoomPage error focus management (#1960)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const submitInvalid = (code: string) => {
    const input = screen.getByLabelText(/room code/i);
    const button = screen.getByRole("button", { name: /join room/i });
    fireEvent.change(input, { target: { value: code } });
    fireEvent.click(button);
  };

  it("moves focus to the error element after a validation failure", () => {
    render(<JoinRoomPage />);
    submitInvalid("abc!"); // pattern failure: non-alphanumeric

    const error = screen.getByRole("alert");
    expect(error).toBeInTheDocument();
    expect(document.activeElement).toBe(error);
  });

  it("exposes the error as an alert referenced by the input via aria-describedby", () => {
    render(<JoinRoomPage />);
    submitInvalid("abc!");

    const input = screen.getByLabelText(/room code/i);
    const error = screen.getByRole("alert");
    expect(error).toHaveAttribute("role", "alert");
    expect(input).toHaveAttribute("aria-describedby", error.id);
    expect(error).toHaveTextContent(/letters and numbers/);
  });

  it("renders the second error message when submitting two different invalid codes", () => {
    // NOTE: the focus effect is keyed on state.status, so a second submission
    // that keeps status === 'error' does not move focus again. This test
    // documents that current behaviour and only asserts the message updates.
    render(<JoinRoomPage />);
    submitInvalid("abc!");
    expect(screen.getByRole("alert")).toHaveTextContent(/letters and numbers/);

    submitInvalid("");
    expect(screen.getByRole("alert")).toHaveTextContent(/Enter a room code/);
  });
});

describe("JoinRoomPage request outcomes (#1954)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(["ab", "ABC-123", "ABCDEFGHIJKLM"]) (
    "rejects malformed or oversized code %s without a request",
    (code) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      render(<JoinRoomPage />);

      fireEvent.change(screen.getByLabelText(/room code/i), { target: { value: code } });
      fireEvent.submit(screen.getByRole("button", { name: /join room/i }).closest("form")!);

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    [401, "Your session expired. Please sign in again."],
    [403, "You do not have access to this room."],
    [500, "Something went wrong on our end. Please try again."],
  ])("shows the specific message for HTTP %i without navigating", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
    render(<JoinRoomPage />);
    fireEvent.change(screen.getByLabelText(/room code/i), { target: { value: "ROOM123" } });
    fireEvent.submit(screen.getByRole("button", { name: /join room/i }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText("No room found for that code.")).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("keeps a missing room in the empty state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    render(<JoinRoomPage />);
    fireEvent.change(screen.getByLabelText(/room code/i), { target: { value: "ROOM123" } });
    fireEvent.submit(screen.getByRole("button", { name: /join room/i }).closest("form")!);

    expect(await screen.findByText("No room found for that code.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("ignores another submit while the first request is pending", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve; }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<JoinRoomPage />);

    fireEvent.change(screen.getByLabelText(/room code/i), { target: { value: "ROOM123" } });
    const form = screen.getByRole("button", { name: /join room/i }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch(new Response(JSON.stringify({ roomId: "room-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/rooms/room-1"));
  });
});
