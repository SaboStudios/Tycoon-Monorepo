import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "./mocks/join-room-i18n";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import JoinRoomForm from "@/components/settings/JoinRoomForm";
import { JOIN_ROOM_I18N } from "@/lib/join-room/i18n-keys";

describe("JoinRoomForm i18n rendering (#844)", () => {
  it("does not render raw i18n keys for labels and buttons", () => {
    render(<JoinRoomForm />);
    expect(screen.queryByText(JOIN_ROOM_I18N.form.label)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/room code/i)).toBeInTheDocument();
    expect(screen.queryByText(JOIN_ROOM_I18N.form.submit)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /join/i })).toBeInTheDocument();
  });
});
