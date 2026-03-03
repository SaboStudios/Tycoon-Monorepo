import { BoostType, StackingRule } from '../enums/perk-boost.enums';

export interface IBoostContext {
    playerId: number;
    gameId: number;
    baseValue: number;
    metadata?: any;
}

export interface IBoostStrategy {
    type: BoostType;
    apply(context: IBoostContext, value: number): number;
    canApply(context: IBoostContext): boolean;
    getStackingRule(): StackingRule;
}
