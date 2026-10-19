/**
 * Farcaster mini app manifest served at /.well-known/farcaster.json (#1760).
 *
 * Security model (deny-by-default):
 * - The manifest is only served when a complete account association is
 *   configured AND its signed payload names exactly this deployment's host.
 *   Anything missing, malformed, or mismatched returns 404, never a partial
 *   or placeholder manifest.
 * - Every URL is built from NEXT_PUBLIC_APP_URL plus a fixed path in this
 *   file, so the manifest cannot point players (or clients) at a third-party
 *   host or an open redirect. `validateFarcasterManifest` re-checks this.
 * - No webhookUrl: a webhook is an unauthenticated inbound entrypoint and
 *   needs signature verification + rate limiting before it can be added.
 * - The account association is public (it ships in the manifest) but is
 *   deployment-specific, so it comes from server env, not the repo.
 *
 * The signature itself is verified by Farcaster clients; this module checks
 * shape and domain binding so a mismatched association is never published.
 */

export const FARCASTER_MANIFEST_PATH = "/.well-known/farcaster.json";

const MAX_ASSOCIATION_PART_LENGTH = 2048;
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const TAG = /^[a-z0-9-]{1,20}$/;
const PLAIN_TEXT = /^[A-Za-z0-9 .,:;!?'&()-]+$/;

/** Fixed, same-origin asset paths (see frontend/public). */
const ASSET_PATHS = {
  home: "/",
  icon: "/blue-icon.png", // 1024x1024 PNG, no alpha
  splash: "/splash.png", // 200x200
  hero: "/thumbnail.png", // 1200x630
  ogImage: "/thumbnail.png", // 1200x630
  screenshots: ["/screenshot.png"], // 1284x2778 portrait
} as const;

/** Player-facing copy. NEAR is the only supported chain UI (ADR-003). */
const COPY = {
  name: "Tycoon",
  subtitle: "Build your board game empire",
  description:
    "A multiplayer strategy board game. Buy properties, trade with friends, and outplay rivals or AI opponents.",
  tagline: "Buy, trade, and win",
  ogTitle: "Tycoon",
  ogDescription: "A multiplayer strategy board game. Buy properties, trade, and win.",
  primaryCategory: "games",
  tags: ["strategy", "board-game", "multiplayer"],
  splashBackgroundColor: "#010F10",
} as const;

export interface FarcasterAccountAssociation {
  header: string;
  payload: string;
  signature: string;
}

export interface FarcasterMiniApp {
  version: "1";
  name: string;
  homeUrl: string;
  iconUrl: string;
  splashImageUrl: string;
  splashBackgroundColor: string;
  subtitle: string;
  description: string;
  screenshotUrls: string[];
  primaryCategory: string;
  tags: string[];
  heroImageUrl: string;
  tagline: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  noindex: boolean;
}

export interface FarcasterManifest {
  accountAssociation: FarcasterAccountAssociation;
  miniapp: FarcasterMiniApp;
}

/** Failure reasons are fixed codes so logs never echo env values. */
export type FarcasterManifestError =
  | "app_url_missing"
  | "app_url_invalid"
  | "app_url_not_https"
  | "app_url_not_origin"
  | "app_url_local"
  | "association_missing"
  | "association_incomplete"
  | "association_malformed"
  | "association_header_invalid"
  | "association_payload_invalid"
  | "association_domain_mismatch"
  | "manifest_url_not_same_origin"
  | "manifest_field_invalid";

export type FarcasterManifestResult =
  | { ok: true; manifest: FarcasterManifest }
  | { ok: false; reason: FarcasterManifestError };

export interface FarcasterManifestEnv {
  NEXT_PUBLIC_APP_URL?: string;
  NEXT_PUBLIC_APP_ENV?: string;
  FARCASTER_ACCOUNT_ASSOCIATION_HEADER?: string;
  FARCASTER_ACCOUNT_ASSOCIATION_PAYLOAD?: string;
  FARCASTER_ACCOUNT_ASSOCIATION_SIGNATURE?: string;
}

type ParsedOrigin = { ok: true; origin: string; host: string } | { ok: false; reason: FarcasterManifestError };

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]" ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

/** The app URL must be a bare public https origin (no path, query, or credentials). */
export function parseAppOrigin(raw: string | undefined): ParsedOrigin {
  const value = (raw ?? "").trim();
  if (value === "") {
    return { ok: false, reason: "app_url_missing" };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "app_url_invalid" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "app_url_not_https" };
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    return { ok: false, reason: "app_url_not_origin" };
  }
  if (isLocalHost(url.hostname)) {
    return { ok: false, reason: "app_url_local" };
  }

  return { ok: true, origin: url.origin, host: url.host };
}

function decodeBase64UrlJson(value: string): unknown {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Check the JSON Farcaster Signature envelope: header names a positive fid and
 * a known key type; payload's domain must equal this deployment's host.
 */
export function validateAccountAssociation(
  association: FarcasterAccountAssociation,
  expectedHost: string,
): FarcasterManifestError | null {
  const parts = [association.header, association.payload, association.signature];
  if (parts.some((part) => part.length === 0 || part.length > MAX_ASSOCIATION_PART_LENGTH || !BASE64URL.test(part))) {
    return "association_malformed";
  }

  const header = decodeBase64UrlJson(association.header);
  if (
    !isRecord(header) ||
    typeof header.fid !== "number" ||
    !Number.isSafeInteger(header.fid) ||
    header.fid <= 0 ||
    (header.type !== "custody" && header.type !== "auth" && header.type !== "app_key") ||
    typeof header.key !== "string" ||
    header.key.length === 0
  ) {
    return "association_header_invalid";
  }

  const payload = decodeBase64UrlJson(association.payload);
  if (!isRecord(payload) || typeof payload.domain !== "string") {
    return "association_payload_invalid";
  }

  if (payload.domain.toLowerCase() !== expectedHost.toLowerCase()) {
    return "association_domain_mismatch";
  }

  return null;
}

function isSameOriginHttps(value: string, origin: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === origin && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Defence in depth: re-validate the assembled manifest before serving it. */
export function validateFarcasterManifest(
  manifest: FarcasterManifest,
  origin: string,
): FarcasterManifestError | null {
  const { miniapp } = manifest;
  const urls = [
    miniapp.homeUrl,
    miniapp.iconUrl,
    miniapp.splashImageUrl,
    miniapp.heroImageUrl,
    miniapp.ogImageUrl,
    ...miniapp.screenshotUrls,
  ];
  if (urls.some((url) => url.length > 1024 || !isSameOriginHttps(url, origin))) {
    return "manifest_url_not_same_origin";
  }

  const textLimits: Array<[string, number]> = [
    [miniapp.name, 32],
    [miniapp.subtitle, 30],
    [miniapp.description, 170],
    [miniapp.tagline, 30],
    [miniapp.ogTitle, 30],
    [miniapp.ogDescription, 100],
  ];
  if (textLimits.some(([text, max]) => text.length === 0 || text.length > max || !PLAIN_TEXT.test(text))) {
    return "manifest_field_invalid";
  }

  if (
    miniapp.version !== "1" ||
    !HEX_COLOR.test(miniapp.splashBackgroundColor) ||
    miniapp.screenshotUrls.length > 3 ||
    miniapp.tags.length > 5 ||
    miniapp.tags.some((tag) => !TAG.test(tag))
  ) {
    return "manifest_field_invalid";
  }

  return null;
}

/**
 * Build the manifest from env. Returns a failure reason (never throws) so the
 * route can fail closed with a 404.
 */
export function buildFarcasterManifest(env: FarcasterManifestEnv): FarcasterManifestResult {
  const parsedOrigin = parseAppOrigin(env.NEXT_PUBLIC_APP_URL);
  if (!parsedOrigin.ok) {
    return parsedOrigin;
  }
  const { origin, host } = parsedOrigin;

  const header = (env.FARCASTER_ACCOUNT_ASSOCIATION_HEADER ?? "").trim();
  const payload = (env.FARCASTER_ACCOUNT_ASSOCIATION_PAYLOAD ?? "").trim();
  const signature = (env.FARCASTER_ACCOUNT_ASSOCIATION_SIGNATURE ?? "").trim();

  const provided = [header, payload, signature].filter((part) => part !== "").length;
  if (provided === 0) {
    return { ok: false, reason: "association_missing" };
  }
  if (provided < 3) {
    return { ok: false, reason: "association_incomplete" };
  }

  const accountAssociation: FarcasterAccountAssociation = { header, payload, signature };
  const associationError = validateAccountAssociation(accountAssociation, host);
  if (associationError) {
    return { ok: false, reason: associationError };
  }

  const url = (path: string) => new URL(path, origin).toString();
  const appEnv = (env.NEXT_PUBLIC_APP_ENV ?? "").trim();

  const manifest: FarcasterManifest = {
    accountAssociation,
    miniapp: {
      version: "1",
      name: COPY.name,
      homeUrl: url(ASSET_PATHS.home),
      iconUrl: url(ASSET_PATHS.icon),
      splashImageUrl: url(ASSET_PATHS.splash),
      splashBackgroundColor: COPY.splashBackgroundColor,
      subtitle: COPY.subtitle,
      description: COPY.description,
      screenshotUrls: ASSET_PATHS.screenshots.map(url),
      primaryCategory: COPY.primaryCategory,
      tags: [...COPY.tags],
      heroImageUrl: url(ASSET_PATHS.hero),
      tagline: COPY.tagline,
      ogTitle: COPY.ogTitle,
      ogDescription: COPY.ogDescription,
      ogImageUrl: url(ASSET_PATHS.ogImage),
      // Keep non-production deployments out of Farcaster app discovery.
      noindex: appEnv !== "production",
    },
  };

  const manifestError = validateFarcasterManifest(manifest, origin);
  if (manifestError) {
    return { ok: false, reason: manifestError };
  }

  return { ok: true, manifest };
}
