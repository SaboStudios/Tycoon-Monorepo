export const useCardModal = (
  _game: { history?: string[] },
  _setShowCardModal: (value: boolean) => void,
  _setCardData: (data: {
    type: "chance" | "community";
    text: string;
    effect?: string;
    isGood: boolean;
  } | null) => void,
  _setCardPlayerName: (name: string) => void
) => {
  // COMMENTED OUT: Chance/Community Chest modal trigger disabled
  // useEffect(() => {
  //   const history = game.history ?? [];
  //   if (history.length <= prevHistoryLength.current) return;

  //   const newEntry = history[history.length - 1];
  //   prevHistoryLength.current = history.length;

  //   if (newEntry == null || typeof newEntry !== "string") return;

  //   const cardRegex = /(.+) drew (Chance|Community Chest): (.+)/i;
  //   const match = (newEntry as string).match(cardRegex);

  //   if (!match) return;

  //   const [, playerName, typeStr, text] = match;
  //   const type = typeStr.toLowerCase().includes("chance") ? "chance" : "community";

  //   const lowerText = text.toLowerCase();
  //   const isGood =
  //     lowerText.includes("collect") ||
  //     lowerText.includes("receive") ||
  //     lowerText.includes("advance") ||
  //     lowerText.includes("get out of jail") ||
  //     lowerText.includes("matures") ||
  //     lowerText.includes("refund") ||
  //     lowerText.includes("prize") ||
  //     lowerText.includes("inherit");

  //   const effectMatch = text.match(/([+-]?\$\d+)|go to jail|move to .+|get out of jail free/i);
  //   const effect = effectMatch ? effectMatch[0] : undefined;

  //   setCardData({ type, text, effect, isGood });
  //   setCardPlayerName(playerName.trim());
  //   setShowCardModal(true);

  //   // Extended timer to account for two-stage animation:
  //   // Stage 1: "drew" message (7 seconds) + Stage 2: card content (8 seconds) = 15 seconds total
  //   const timer = setTimeout(() => setShowCardModal(false), 15000);
  //   return () => clearTimeout(timer);
  // }, [game.history, setShowCardModal, setCardData, setCardPlayerName]);
};