import { IBoostStrategy, IBoostContext } from '../interfaces/boost-strategy.interface';
import { BoostType, StackingRule } from '../enums/perk-boost.enums';

export abstract class BaseBoostStrategy implements IBoostStrategy {
    constructor(
        public readonly type: BoostType,
        protected readonly stackingRule: StackingRule = StackingRule.ADDITIVE,
    ) { }

    abstract apply(context: IBoostContext, value: number): number;

    canApply(context: IBoostContext): boolean {
        return true; // Default implementation
    }

    getStackingRule(): StackingRule {
        return this.stackingRule;
    }
}
