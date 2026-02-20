export interface PlayerSymbol {
  name: string;
  emoji: string;
  value: string;
}

export const symbols: PlayerSymbol[] = [
  { name: "Hat", emoji: "🧢", value: "hat" },               // Casual & sharp
  { name: "Car", emoji: "🚗", value: "car" },
  { name: "Dog", emoji: "🐶", value: "dog" },
  { name: "Thimble", emoji: "🧵", value: "thimble" },       // Spool of thread: Quintessential sewing tool – round, tidy, finger-safe vibe!
  { name: "Iron", emoji: "🛠️", value: "iron" },             // Hammer + wrench: Industrial tool power – presses out wrinkles like a boss ⚙️
  { name: "Battleship", emoji: "🚢", value: "battleship" },
  { name: "Boot", emoji: "👞", value: "boot" },
  { name: "Wheelbarrow", emoji: "🛒", value: "wheelbarrow" }, // Shopping cart: Hauls loads with handles & wheels – construction/garden cart perfection!
];

export const getPlayerSymbolData = (value: string) => {
  return symbols.find((s) => s.value === value);
};

export const getPlayerSymbol = (value: string) => {
  const symbol = symbols.find((s) => s.value === value);
  return symbol?.emoji;
};
