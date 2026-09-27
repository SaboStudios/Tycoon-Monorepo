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

export function sanitizeAnalyticsPayload(
  event: AnalyticsEventName,
  payload: Record<string, unknown> = {},
): AnalyticsEventPayload {
  const allowedKeys = new Set<string>(analyticsEventSchema[event]);

  return Object.entries(payload).reduce<AnalyticsEventPayload>((safePayload, [key, value]) => {
    if (!allowedKeys.has(key) || blockedPiiKeys.has(key.toLowerCase())) {
      return safePayload;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      safePayload[key as keyof AnalyticsEventPayload] = value;
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
