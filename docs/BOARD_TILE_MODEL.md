# Board Tile Model: 40 positions, stable IDs, and frontend mapping

## Purpose

This document defines the contract between the backend board tile tables and the frontend tile model used by `useGameBoardLogic` and related UI logic.

It keeps the canonical tile order stable so deck mapping, board rendering, and property ownership logic stay in sync.

## Canonical board layout

The board is a 40-tile Monopoly-style loop indexed from `0` to `39`.

| Index | Tile | Type | Backend property id |
| --- | --- | --- | --- |
| 0 | GO | corner | — |
| 1 | Mediterranean Ave | property | 1 |
| 2 | Community Chest | community | — |
| 3 | Baltic Ave | property | 2 |
| 4 | Income Tax | tax | — |
| 5 | Reading Railroad | railroad | 3 |
| 6 | Oriental Ave | property | 4 |
| 7 | Chance | chance | — |
| 8 | Vermont Ave | property | 5 |
| 9 | Connecticut Ave | property | 6 |
| 10 | Jail / Just Visiting | corner | — |
| 11 | St. Charles Place | property | 7 |
| 12 | Electric Company | utility | 8 |
| 13 | States Ave | property | 9 |
| 14 | Virginia Ave | property | 10 |
| 15 | Pennsylvania Railroad | railroad | 11 |
| 16 | St. James Place | property | 12 |
| 17 | Community Chest | community | — |
| 18 | Tennessee Ave | property | 13 |
| 19 | New York Ave | property | 14 |
| 20 | Free Parking | corner | — |
| 21 | Kentucky Ave | property | 15 |
| 22 | Chance | chance | — |
| 23 | Indiana Ave | property | 16 |
| 24 | Illinois Ave | property | 17 |
| 25 | B&O Railroad | railroad | 18 |
| 26 | Atlantic Ave | property | 19 |
| 27 | Ventnor Ave | property | 20 |
| 28 | Water Works | utility | 21 |
| 29 | Marvin Gardens | property | 22 |
| 30 | Go To Jail | corner | — |
| 31 | Pacific Ave | property | 23 |
| 32 | North Carolina Ave | property | 24 |
| 33 | Community Chest | community | — |
| 34 | Pennsylvania Ave | property | 25 |
| 35 | Short Line Railroad | railroad | 26 |
| 36 | Chance | chance | — |
| 37 | Park Place | property | 27 |
| 38 | Luxury Tax | tax | — |
| 39 | Boardwalk | property | 28 |

## Seed contract and deck mapping

The backend seed data is authoritative for placement and uniqueness:

- `backend/src/database/seeds/seed-board-tiles.ts` seeds the board tile tables.
- `properties`, `chances`, and `community_chests` each use a `position` column with unique constraints.
- The property ids above are the stable backend property ids referenced by the frontend tile model.

The deck cards are intentionally sparse and use the same tile positions for event triggers:

- Chance positions: `7`, `22`, `36`
- Community Chest positions: `2`, `17`, `33`

The frontend must never invent a new board index or reorder the array. The `index` value is the canonical coordinate for the board loop and must remain stable across patches.

## Frontend Tile contract

The frontend model in `frontend/src/hooks/useGameBoardLogic.ts` exposes:

```ts
export interface Tile {
  index: number;
  name: string;
  type: 'property' | 'railroad' | 'utility' | 'tax' | 'corner' | 'chance' | 'community';
  propertyId: number | null;
  ownerId: string | null;
}
```

The canonical exported array is `BOARD_TILES`.

This lets future code import the same board constant without re-encoding the mapping in each screen or hook.

## Acceptance criteria summary

- 40 positions are defined and stable.
- `Chance` and `Community Chest` positions are represented at the correct indexes.
- `propertyId` values map to the backend property ids and remain stable.
- Frontend types can import the constant and avoid drift between the UI and backend.
- The documentation matches the backend seed contract.
