// Keep your existing constants and calculation logic here
const MONOPOLY_STATS = {
  landingRank: {
    5: 1, 6: 2, 7: 3, 8: 4, 9: 5, 11: 6, 13: 7, 14: 8, 16: 9, 18: 10,
    19: 11, 21: 12, 23: 13, 24: 14, 26: 15, 27: 16, 29: 17, 31: 18, 32: 19, 34: 20, 37: 21, 39: 22,
    1: 30, 2: 25, 3: 29, 4: 35, 12: 32, 17: 28, 22: 26, 28: 33, 33: 27, 36: 24, 38: 23,
  } as { [key: number]: number },

  colorGroups: {
    brown: [1, 3],
    lightblue: [6, 8, 9],
    pink: [11, 13, 14],
    orange: [16, 18, 19],
    red: [21, 23, 24],
    yellow: [26, 27, 29],
    green: [31, 32, 34],
    darkblue: [37, 39],
    railroad: [5, 15, 25, 35],
    utility: [12, 28],
  },
};

export function calculateBuyScore(
  property: any,
  player: any,
  gameProperties: any[],
  allProperties: any[]
): number {
   if (!property.price || property.type !== "property") return 0;

  const price = property.price!;
  const baseRent = property.rent_site_only || 0;
  const cash = player.balance;
  let score = 50;

  if (cash < price * 1.3) score -= 70;
  else if (cash > price * 3) score += 20;
  else if (cash > price * 2) score += 10;

  const group = Object.values(MONOPOLY_STATS.colorGroups).find(g => g.includes(property.id));
  if (group && !["railroad", "utility"].includes(property.color!)) {
    const owned = group.filter(id =>
      gameProperties.find(gp => gp.property_id === id)?.address === player.address
    ).length;

    if (owned === group.length - 1) score += 90;
    else if (owned >= 1) score += 35;
  }

  if (property.color === "railroad") {
    const owned = gameProperties.filter(gp =>
      gp.address === player.address &&
      allProperties.find(p => p.id === gp.property_id)?.color === "railroad"
    ).length;
    score += owned * 28;
  }
  if (property.color === "utility") {
    const owned = gameProperties.filter(gp =>
      gp.address === player.address &&
      allProperties.find(p => p.id === gp.property_id)?.type === "utility"
    ).length;
    score += owned * 35;
  }

  const rank = (MONOPOLY_STATS.landingRank as Record<number, number>)[property.id] ?? 25;
  score += (30 - rank);

  const roi = baseRent / price;
  if (roi > 0.12) score += 25;
  else if (roi > 0.08) score += 12;

  if (group) {
    const opponentOwns = group.some(id => {
      const gp = gameProperties.find(gp => gp.property_id === id);
      return gp && gp.address !== player.address;
    });
    if (opponentOwns && group.length <= 3) score += 30;
  }

  return Math.max(5, Math.min(98, score));
}

export const BUILD_PRIORITY = ["orange", "red", "yellow", "pink", "lightblue", "green", "brown", "darkblue"];
