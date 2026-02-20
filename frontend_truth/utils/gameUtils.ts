import { Property, GameProperty, Player } from "@/types/game";

export const isMortgaged = (property_id: number, game_properties: GameProperty[]) =>
  game_properties.find((gp) => gp.property_id === property_id)?.mortgaged ?? false;

export const developmentStage = (property_id: number, game_properties: GameProperty[]) =>
  game_properties.find((gp) => gp.property_id === property_id)?.development ?? 0;

export const rentPrice = (
  property_id: number,
  properties: Property[],
  game_properties: GameProperty[]
) => {
  const property = properties.find((p) => p.id === property_id);
  const dev = developmentStage(property_id, game_properties);
  switch (dev) {
    case 1: return property?.rent_one_house || 0;
    case 2: return property?.rent_two_houses || 0;
    case 3: return property?.rent_three_houses || 0;
    case 4: return property?.rent_four_houses || 0;
    case 5: return property?.rent_hotel || 0;
    default: return property?.rent_site_only || 0;
  }
};

export const calculateFavorability = (trade: any, properties: Property[]) => {
  const offerValue =
    trade.offer_properties.reduce(
      (sum: number, id: number) =>
        sum + (properties.find((p) => p.id === id)?.price || 0),
      0
    ) + (trade.offer_amount || 0);

  const requestValue =
    trade.requested_properties.reduce(
      (sum: number, id: number) =>
        sum + (properties.find((p) => p.id === id)?.price || 0),
      0
    ) + (trade.requested_amount || 0);

  if (requestValue === 0) return 100;
  const ratio = ((offerValue - requestValue) / requestValue) * 100;
  return Math.min(100, Math.max(-100, Math.round(ratio)));
};

export const calculateAiFavorability = (trade: any, properties: Property[]) => {
  const aiGetsValue =
    (trade.offer_amount || 0) +
    trade.offer_properties.reduce(
      (sum: number, id: number) =>
        sum + (properties.find((p) => p.id === id)?.price || 0),
      0
    );

  const aiGivesValue =
    (trade.requested_amount || 0) +
    trade.requested_properties.reduce(
      (sum: number, id: number) =>
        sum + (properties.find((p) => p.id === id)?.price || 0),
      0
    );

  if (aiGivesValue === 0) return 100;
  const ratio = ((aiGetsValue - aiGivesValue) / aiGivesValue) * 100;
  return Math.min(100, Math.max(-100, Math.round(ratio)));
};

export const isAIPlayer = (player: Player) => {
  const username = (player.username || "").toLowerCase();
  return username.includes("ai_") || username.includes("bot") || username.includes("computer");
};

/** Derive AI slot (2–8) from player username (e.g. AI_2 -> 2) for Celo agent registry. */
export function getAiSlotFromPlayer(player: Player): number | null {
  const username = player.username || "";
  const match = username.match(/ai_(\d+)/i);
  if (match) return Math.min(8, Math.max(2, parseInt(match[1], 10)));
  if (isAIPlayer(player) && player.turn_order != null) return Math.min(8, Math.max(2, player.turn_order));
  return null;
}