export const analyticsEventSchema = {
  view_home: ["route", "source"],
  view_shop: ["route", "shop_section", "source"],
  purchase_click: ["route", "item_id", "item_name", "item_category", "currency", "value"],
  continue_game_click: ["route", "destination"],
  multiplayer_click: ["route", "destination"],
  join_room_click: ["route", "destination"],
  play_ai_click: ["route", "destination"],
} as const;

export type AnalyticsEventName = keyof typeof analyticsEventSchema;

export type AnalyticsEventPayload = Partial<
  Record<(typeof analyticsEventSchema)[AnalyticsEventName][number], string | number | boolean>
>;

const blockedPiiKeys = new Set([
  "address",
  "email",
  "full_name",
  "ip",
  "ip_address",
  "mail",
  "name",
  "password",
  "phone",
  "secret",
  "session",
  "session_id",
  "token",
  "user_id",
  "wallet",
  "wallet_address",
]);

/** Longest string value forwarded to a provider; longer values are dropped. */
const MAX_VALUE_LENGTH = 200;

/**
 * Values that identify a person or account even when the key looks harmless
 * (e.g. an item_name that is actually an email). Matching values are dropped.
 */
const piiValuePatterns: readonly RegExp[] = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/, // email
  /\b[a-z0-9_-]+(\.[a-z0-9_-]+)*\.(near|testnet)\b/i, // NEAR named account
  /\b[a-f0-9]{64}\b/i, // NEAR implicit account / raw key
  /\b0x[a-f0-9]{16,}\b/i, // hex address or hash
  /\bG[A-Z2-7]{55}\b/, // base32 public account key
  /\beyJ[\w-]+\.[\w-]+\.[\w-]+/, // JWT
];

function sanitizeValue(key: string, value: unknown): string | number | boolean | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  // Query strings and fragments can carry tokens or invite codes.
  const text = key === "route" ? (value.split(/[?#]/, 1)[0] ?? "") : value;
  if (text.length > MAX_VALUE_LENGTH) {
    return undefined;
  }
  if (piiValuePatterns.some((pattern) => pattern.test(text))) {
    return undefined;
  }
  return text;
}

export function sanitizeAnalyticsPayload(
  event: AnalyticsEventName,
  payload: Record<string, unknown> = {},
): AnalyticsEventPayload {
  const schema = analyticsEventSchema[event] as readonly string[] | undefined;
  if (!schema || payload === null || typeof payload !== "object") {
    return {};
  }
  const allowedKeys = new Set<string>(schema);

  return Object.entries(payload).reduce<AnalyticsEventPayload>((safePayload, [key, value]) => {
    if (!allowedKeys.has(key) || blockedPiiKeys.has(key.toLowerCase())) {
      return safePayload;
    }

    const safeValue = sanitizeValue(key, value);
    if (safeValue !== undefined) {
      safePayload[key as keyof AnalyticsEventPayload] = safeValue;
    }

    return safePayload;
  }, {});
}

export function getViewEventForPath(pathname: string): AnalyticsEventName | null {
  if (pathname === "/") {
    return "view_home";
  }

  if (pathname.startsWith("/shop")) {
    return "view_shop";
  }

  return null;
}
