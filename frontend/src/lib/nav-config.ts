export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/play-ai", label: "Play AI" },
  { href: "/game-settings", label: "Game Settings" },
  { href: "/join-room", label: "Join Room" },
] as const;

export type NavLink = (typeof NAV_LINKS)[number];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/(home)");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
