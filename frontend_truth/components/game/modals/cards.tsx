import React from "react";

interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: {
    type: "chance" | "community";
    text: string;
    effect?: string;
    isGood: boolean;
  } | null;
  playerName: string;
}

export const CardModal: React.FC<CardModalProps> = (_props) => {
  // COMMENTED OUT: Chance/Community Chest modals disabled - return null to prevent popup
  return null;
};
