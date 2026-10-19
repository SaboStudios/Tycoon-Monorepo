import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Krona_One: vi.fn((options: unknown) => options),
  Orbitron: vi.fn((options: unknown) => options),
  DM_Sans: vi.fn((options: unknown) => options),
}));

import { Krona_One, Orbitron, DM_Sans } from "next/font/google";
import { kronaOne, orbitron, dmSans } from "./fonts";

describe("lib/fonts", () => {
  it("loads Krona One with the expected CSS variable, weight and subset", () => {
    expect(Krona_One).toHaveBeenCalledWith({
      variable: "--font-krona-one",
      subsets: ["latin"],
      weight: "400",
    });
    expect(kronaOne).toMatchObject({
      variable: "--font-krona-one",
      subsets: ["latin"],
      weight: "400",
    });
  });

  it("loads Orbitron with the expected CSS variable, weights and subset", () => {
    expect(Orbitron).toHaveBeenCalledWith({
      variable: "--font-orbitron",
      subsets: ["latin"],
      weight: ["400", "500", "600", "700", "800", "900"],
    });
    expect(orbitron).toMatchObject({
      variable: "--font-orbitron",
      subsets: ["latin"],
      weight: ["400", "500", "600", "700", "800", "900"],
    });
  });

  it("loads DM Sans with the expected CSS variable, weights and subset", () => {
    expect(DM_Sans).toHaveBeenCalledWith({
      variable: "--font-dm-sans",
      subsets: ["latin"],
      weight: ["400", "500", "600", "700"],
    });
    expect(dmSans).toMatchObject({
      variable: "--font-dm-sans",
      subsets: ["latin"],
      weight: ["400", "500", "600", "700"],
    });
  });
});
