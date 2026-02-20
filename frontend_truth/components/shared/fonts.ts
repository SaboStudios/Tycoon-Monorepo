/**
 * Google Fonts (DM Sans, Krona One, Orbitron).
 * If NEXT_PUBLIC_USE_SYSTEM_FONTS=true (e.g. offline/CI build), exports system-font fallbacks
 * so the build succeeds without fetching Google Fonts.
 */
import { DM_Sans, Orbitron, Krona_One } from "next/font/google";

const useSystemFonts = process.env.NEXT_PUBLIC_USE_SYSTEM_FONTS === "true";

function systemFontFallback(variable: string, className = "font-sans") {
  return {
    variable: `${variable} font-system-fallback`,
    className,
  };
}

const dmSansLoaded = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});
const kronaOneLoaded = Krona_One({
  variable: "--font-krona-one",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const orbitronLoaded = Orbitron({
  variable: "--font-orbitron-sans",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const dmSans = useSystemFonts ? systemFontFallback("--font-dm-sans") : dmSansLoaded;
export const kronaOne = useSystemFonts ? systemFontFallback("--font-krona-one", "font-sans") : kronaOneLoaded;
export const orbitron = useSystemFonts ? systemFontFallback("--font-orbitron-sans", "font-sans") : orbitronLoaded;
