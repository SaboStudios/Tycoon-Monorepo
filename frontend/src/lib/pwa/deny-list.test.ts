import { isCacheExcludedPath } from "./constants";

describe("isCacheExcludedPath", () => {
  // Paths that must be excluded (network-only, never cached)
  it.each([
    ["/api/users", true],
    ["/game-play", true],
    ["/game-waiting/abc", true],
    ["/ai-play/", true],
    ["/join-room", true],
    ["/socket.io/", true],
  ])("returns true for excluded path '%s'", (pathname, expected) => {
    expect(isCacheExcludedPath(pathname)).toBe(expected);
  });

  it("returns true for /socket.io/ (pathname of /socket.io/?EIO=4)", () => {
    // Query strings are not part of pathname; callers must pass url.pathname
    const url = new URL("http://localhost/socket.io/?EIO=4");
    expect(isCacheExcludedPath(url.pathname)).toBe(true);
  });

  // Paths that must be cached (shell assets / navigation fallback)
  it.each([
    ["/offline", false],
    ["/_next/static/main.js", false],
    ["/manifest.json", false],
    ["/shop", false],
  ])("returns false for non-excluded path '%s'", (pathname, expected) => {
    expect(isCacheExcludedPath(pathname)).toBe(expected);
  });
});
