/**
 * Tycoon shared typography
 * Exports Krona One, Orbitron, and DM Sans from next/font/google.
 * Use via className or CSS var(--font-*).
 */
import { Krona_One, Orbitron, DM_Sans } from "next/font/google";

export const kronaOne = Krona_One({
  variable: "--font-krona-one",
  subsets: ["latin"],
  weight: "400",
});

export const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
