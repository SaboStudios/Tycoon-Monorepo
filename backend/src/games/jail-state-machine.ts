export enum JailStatus {
  NOT_IN_JAIL = 'not_in_jail',
  JUST_VISITING = 'just_visiting',
  IN_JAIL = 'in_jail',
  PAYING_FINE = 'paying_fine',
  USING_GET_OUT_CARD = 'using_get_out_card',
  ROLLING_FOR_DOUBLES = 'rolling_for_doubles',
}

export interface JailState {
  status: JailStatus;
  turnsInJail: number;
  hasGetOutOfJailCard: boolean;
  doublesCount: number;
  fineAmount: number;
}

export interface JailTransition {
  from: JailStatus;
  to: JailStatus;
  action: string;
  condition?: (state: JailState) => boolean;
}

export const JAIL_FINE_AMOUNT = 50;
export const MAX_JAIL_TURNS = 3;

const JAIL_TRANSITIONS: JailTransition[] = [
  {
    from: JailStatus.IN_JAIL,
    to: JailStatus.PAYING_FINE,
    action: 'pay_fine',
  },
  {
    from: JailStatus.IN_JAIL,
    to: JailStatus.USING_GET_OUT_CARD,
    action: 'use_get_out_card',
    condition: (state) => state.hasGetOutOfJailCard,
  },
  {
    from: JailStatus.IN_JAIL,
    to: JailStatus.ROLLING_FOR_DOUBLES,
    action: 'roll_for_doubles',
  },
  {
    from: JailStatus.ROLLING_FOR_DOUBLES,
    to: JailStatus.NOT_IN_JAIL,
    action: 'doubles_rolled',
    condition: (state) => state.doublesCount >= 1,
  },
  {
    from: JailStatus.ROLLING_FOR_DOUBLES,
    to: JailStatus.IN_JAIL,
    action: 'no_doubles',
    condition: (state) => state.turnsInJail < MAX_JAIL_TURNS,
  },
  {
    from: JailStatus.ROLLING_FOR_DOUBLES,
    to: JailStatus.PAYING_FINE,
    action: 'forced_pay',
    condition: (state) => state.turnsInJail >= MAX_JAIL_TURNS,
  },
  {
    from: JailStatus.PAYING_FINE,
    to: JailStatus.NOT_IN_JAIL,
    action: 'fine_paid',
  },
  {
    from: JailStatus.USING_GET_OUT_CARD,
    to: JailStatus.NOT_IN_JAIL,
    action: 'card_used',
  },
];

export class JailStateMachine {
  private state: JailState;

  constructor(initialState?: Partial<JailState>) {
    this.state = {
      status: JailStatus.NOT_IN_JAIL,
      turnsInJail: 0,
      hasGetOutOfJailCard: false,
      doublesCount: 0,
      fineAmount: JAIL_FINE_AMOUNT,
      ...initialState,
    };
  }

  getState(): JailState {
    return { ...this.state };
  }

  canPerformAction(action: string): boolean {
    const transition = JAIL_TRANSITIONS.find(
      (t) => t.from === this.state.status && t.action === action
    );

    if (!transition) return false;

    if (transition.condition) {
      return transition.condition(this.state);
    }

    return true;
  }

  performAction(action: string): JailState {
    const transition = JAIL_TRANSITIONS.find(
      (t) => t.from === this.state.status && t.action === action
    );

    if (!transition) {
      throw new Error(`Invalid transition: ${action} from ${this.state.status}`);
    }

    if (transition.condition && !transition.condition(this.state)) {
      throw new Error(`Condition not met for transition: ${action}`);
    }

    this.state = this.applyTransition(transition);
    return this.getState();
  }

  private applyTransition(transition: JailTransition): JailState {
    const newState = { ...this.state, status: transition.to };

    switch (transition.action) {
      case 'roll_for_doubles':
        newState.turnsInJail++;
        break;
      case 'doubles_rolled':
        newState.doublesCount = 0;
        break;
      case 'use_get_out_card':
        newState.hasGetOutOfJailCard = false;
        break;
      case 'pay_fine':
      case 'forced_pay':
        break;
    }

    return newState;
  }

  processDiceRoll(dice1: number, dice2: number): JailState {
    const isDoubles = dice1 === dice2;

    if (this.state.status === JailStatus.ROLLING_FOR_DOUBLES) {
      if (isDoubles) {
        this.state.doublesCount++;
        return this.performAction('doubles_rolled');
      } else {
        if (this.state.turnsInJail >= MAX_JAIL_TURNS) {
          return this.performAction('forced_pay');
        }
        return this.performAction('no_doubles');
      }
    }

    return this.getState();
  }

  enterJail(hasCard: boolean = false): JailState {
    this.state = {
      ...this.state,
      status: JailStatus.IN_JAIL,
      turnsInJail: 0,
      hasGetOutOfJailCard: hasCard,
      doublesCount: 0,
    };
    return this.getState();
  }

  getAvailableActions(): string[] {
    return JAIL_TRANSITIONS
      .filter((t) => t.from === this.state.status)
      .filter((t) => !t.condition || t.condition(this.state))
      .map((t) => t.action);
  }
}
