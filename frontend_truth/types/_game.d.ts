export interface GameContextProps {
  isAppearanceModalOpen: boolean;
  setAppearanceModalOpen: (isOpen: boolean) => void;
  players: any[]; // Replace 'any' with your Player type
  setPlayers: (players: any[]) => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  // Add other game states and functions here (e.g., currentTurn, properties, etc.)
}

export interface BoardSquare {
  id: number;
  type: "corner" | "property" | "luxury_tax" | "income_tax" | "chance" | "community_chest";
  name: string;
  price: number;
  rent_site_only: number;
  rent_one_house: number;
  rent_two_houses: number;
  rent_three_houses: number;
  rent_four_houses: number;
  rent_hotel: number;
  cost_of_house: number;
  is_mortgaged: boolean;
  group_id: number;
  color: string;
  position: "top" | "bottom" | "left" | "right";
  gridPosition: { row: number; col: number };
  icon: string;
}