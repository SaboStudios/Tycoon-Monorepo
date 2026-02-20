export interface RollResult {
  die1: number;
  die2: number;
  total: number;
}

export function rollDice(): RollResult | null {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;

  // In classic Monopoly doubles = roll again, but here we simulate "12 = invalid"
  return total === 12 ? null : { die1, die2, total };
}