# Game Frontend Refactor Plan

Break large components/pages into smaller hooks, components, and pages without changing behavior.

---

## 1. File inventory (by line count, project files only)

| Lines | File | Notes |
|------:|------|------|
| 1321 | `components/game/board/mobile/board-mobile.tsx` | PvP mobile board – duplicate structure vs ai-board mobile |
| 1181 | `context/ContractProvider.tsx` | Contract/wallet hooks – consider splitting by domain |
| 1160 | `components/game/ai-board/ai-board.tsx` | Desktop AI board – same pattern as mobile refactor |
| 1005 | `app/rewards/page.tsx` | Rewards page – split into sections + hooks |
| 871 | `components/game/ai-player/mobile/ai-player.tsx` | Mobile AI player sidebar |
| 857 | `components/game/ai-player/ai-player.tsx` | Desktop AI player sidebar |
| 816 | `components/game/board/game-board.tsx` | Desktop PvP board |
| 742 | `components/settings/game-waiting-mobile.tsx` | Waiting room mobile |
| 722 | `components/settings/game-waiting.tsx` | Waiting room desktop |
| 699 | `components/game/player/player.tsx` | Desktop PvP player sidebar |
| 688 | `components/game/ai-board/mobile/useMobileAiLogic.ts` | Already extracted |
| 862 | `components/game/ai-board/mobile/ai-board.tsx` | Already refactored |

---

## 2. Refactor priorities

### Tier 1 – Highest impact (do first)

1. **`board/mobile/board-mobile.tsx` (1321 → ~600–700)**
   - Reuse or share: `constants` (same as ai-board mobile), `getDiceValues`, `isAIPlayer` from utils.
   - Extract: `useBoardMobileLogic` (state, sync, dice, turn, buy prompt, modals).
   - Extract components: re-use or adapt from ai-board mobile where possible (e.g. BellNotification, RollDiceSection, MyBalanceBar, BuyPromptModal). Keep board-specific modals (PropertyActionModal, CardModal, VictoryModal, BankruptcyModal) as-is or as wrappers.
   - Result: One hook + shared constants + small UI components; page becomes a thin view.

2. **`ai-board/ai-board.tsx` (1160 → ~500–600)**
   - Extract: `constants` (or import from shared `game/constants.ts`), `calculateBuyScore` and related AI helpers to `utils` or `useAiBoardLogic`.
   - Extract: `useAiBoardLogic` (state, sync, dice, turn, AI strategy, bankruptcy).
   - Extract UI: Bell/trade toast, roll section, balance, buy/property modals, perks modal into presentational components.
   - Result: Same pattern as mobile ai-board.

3. **`context/ContractProvider.tsx` (1181)**
   - Split by domain: e.g. `useRegistration`, `useGameContract`, `usePropertyTransfer`, `useEndGame`, etc., in separate files under `context/` or `hooks/`.
   - Keep one `ContractProvider.tsx` that composes them and exposes a single provider if needed, or migrate to multiple small providers.
   - Result: Smaller, domain-focused hooks; easier to test and change.

### Tier 2 – High impact

4. **`app/rewards/page.tsx` (1005)**
   - Split into: `RewardsHeader`, `RewardsList`, `RewardsFilters`, `useRewardsData` (fetch/filter).
   - Page only composes layout + data hook + sections.

5. **`ai-player/ai-player.tsx` (857) + `ai-player/mobile/ai-player.tsx` (871)**
   - Shared: `useAiPlayerState`, `useAiPlayerTrades`, shared types.
   - Extract: Player list, trade section, my empire, property cards as presentational components (some already exist in subfolders).
   - Reduce duplication between desktop and mobile (shared hooks, different layout components).

6. **`board/game-board.tsx` (816)**
   - Extract: `useGameBoardLogic` (state, sync, dice, turn, buy).
   - Extract: Board-specific modals and action sections into components.
   - Share constants and rent/buy logic with board-mobile where possible.

### Tier 3 – Medium impact

7. **`settings/game-waiting.tsx` (722) + `game-waiting-mobile.tsx` (742)**
   - Shared: `useWaitingRoom` (players, copy link, start game, settings).
   - Extract: Player list, invite section, settings panel, start button as components.
   - One hook, two layout components (desktop / mobile).

8. **`player/player.tsx` (699)**
   - Extract: `usePlayerSidebar` (trades, properties, balance).
   - Extract: Trade list, property list, balance/actions as components.

### Tier 4 – Pages and smaller files

9. **App pages**
   - `play-ai/page.tsx`, `game-settings/page.tsx`, `game-waiting/page.tsx`: Already thin; keep or extract only shared layout (e.g. `GamePageLayout`).
   - `join-room/page.tsx`, `game-stats/page.tsx`, `game-shop/page.tsx`: If any grows, split into sections + one data hook per page.

10. **Modals and cards**
    - `modals/*` and `cards/*`: Already separate files; ensure they receive minimal props (data + callbacks) and no heavy logic.

---

## 3. Shared assets to introduce

- **`components/game/constants.ts`** (or `utils/constants/game.ts`): `BOARD_SQUARES`, `JAIL_POSITION`, `TOKEN_POSITIONS`, `MONOPOLY_STATS`, `BUILD_PRIORITY`, `getDiceValues`. Used by: ai-board (desktop + mobile), board-mobile, game-board.
- **`utils/gameUtils.ts`**: Already has `isAIPlayer`; add `getCurrentRent` and any shared monopoly/rent helpers so both board and ai-board use them.
- **Shared UI (optional)**: e.g. `BellNotification`, `RollDiceSection`, `MyBalanceBar` in `components/game/shared/` if both ai-board and board-mobile use them; otherwise keep in each board folder.

---

## 4. Execution order (recommended)

1. **Shared constants** – Add `components/game/constants.ts` (or reuse ai-board/mobile/constants and re-export). Migrate board-mobile and desktop ai-board to use it.
2. **board-mobile.tsx** – Apply same pattern as ai-board mobile: constants, hook, subcomponents.
3. **ai-board.tsx (desktop)** – Same pattern: constants, `useAiBoardLogic`, subcomponents.
4. **ContractProvider** – Split into 3–5 smaller hooks/files; keep provider composition in one place.
5. **rewards/page.tsx** – Sections + `useRewardsData`.
6. **ai-player (desktop + mobile)** – Shared hooks + layout components.
7. **game-board.tsx** – Hook + components.
8. **game-waiting** – Shared hook + desktop/mobile layouts.
9. **player/player.tsx** – Hook + components.

---

## 5. Rules of thumb

- **One concern per file**: One main hook or one main component per file.
- **No duplicate constants**: One source for board/monopoly constants and dice helpers.
- **Thin pages**: Pages compose layout + one (or few) data/handlers hook + sections.
- **Presentational vs logic**: Keep state and effects in hooks; components receive props and callbacks only.
- **Test as you go**: After each refactor, run the app and key flows (create game, join, roll, buy, trade, end game).

---

## 6. Already done

- **ai-board/mobile/ai-board.tsx**: Refactored with constants, `useMobileAiLogic`, `useMobileAiBankruptcy`, and extracted components (BellNotification, RollDiceSection, MyBalanceBar, BuyPromptModal, PropertyDetailModal, PerksModal).
- **Shared constants**: `components/game/constants.ts` – BOARD_SQUARES, TOKEN_POSITIONS, MONOPOLY_STATS, getDiceValues, etc. Used by ai-board/mobile (re-export) and board/mobile.
- **board/mobile/board-mobile.tsx**: Now uses shared constants and `board/mobile/BellNotification.tsx` (~90 lines removed). Further reduction: extract `useBoardMobileLogic` and more UI components (RollDiceSection, BuyPromptModal, etc.) as in ai-board mobile.
