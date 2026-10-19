import { GameState, PlayerState, GameEvent } from './board-tile-model';

export const GO_SALARY = 200;
export const GO_TILE_INDEX = 0;

export interface PassGoResult {
  salaryAwarded: boolean;
  amount: number;
  newCash: number;
  events: GameEvent[];
}

export function handlePassGo(
  previousPosition: number,
  newPosition: number,
  player: PlayerState
): PassGoResult {
  const events: GameEvent[] = [];
  let salaryAwarded = false;
  let amount = 0;

  if (newPosition >= GO_TILE_INDEX && previousPosition > newPosition) {
    salaryAwarded = true;
    amount = GO_SALARY;
    events.push({
      type: 'cash_changed',
      playerId: player.id,
      delta: GO_SALARY,
      reason: 'pass_go',
    });
  }

  if (newPosition === GO_TILE_INDEX) {
    salaryAwarded = true;
    amount = GO_SALARY;
    events.push({
      type: 'cash_changed',
      playerId: player.id,
      delta: GO_SALARY,
      reason: 'land_on_go',
    });
  }

  return {
    salaryAwarded,
    amount,
    newCash: player.cash + amount,
    events,
  };
}

export function calculateGoSalary(
  positions: number[],
  player: PlayerState
): PassGoResult {
  const events: GameEvent[] = [];
  let totalSalary = 0;

  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];

    if (curr < prev || curr === GO_TILE_INDEX) {
      totalSalary += GO_SALARY;
      events.push({
        type: 'cash_changed',
        playerId: player.id,
        delta: GO_SALARY,
        reason: 'pass_go',
      });
    }
  }

  return {
    salaryAwarded: totalSalary > 0,
    amount: totalSalary,
    newCash: player.cash + totalSalary,
    events,
  };
}

export interface GoEdgeCase {
  name: string;
  description: string;
  positions: number[];
  expectedSalary: number;
}

export const GO_EDGE_CASES: GoEdgeCase[] = [
  {
    name: 'normal_pass_go',
    description: 'Player moves from position 38 to position 3',
    positions: [38, 3],
    expectedSalary: GO_SALARY,
  },
  {
    name: 'land_on_go',
    description: 'Player moves from position 39 to position 0',
    positions: [39, 0],
    expectedSalary: GO_SALARY,
  },
  {
    name: 'multiple_laps',
    description: 'Player passes GO twice in one turn',
    positions: [35, 10],
    expectedSalary: GO_SALARY * 2,
  },
  {
    name: 'no_pass',
    description: 'Player moves forward without passing GO',
    positions: [5, 10],
    expectedSalary: 0,
  },
  {
    name: 'backward_movement',
    description: 'Player moves backward (e.g., from Chance card)',
    positions: [10, 5],
    expectedSalary: 0,
  },
  {
    name: 'start_at_go',
    description: 'Player starts at GO and moves forward',
    positions: [0, 5],
    expectedSalary: 0,
  },
];
