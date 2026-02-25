import { BaseBoostStrategy } from './base-boost.strategy';
import { IBoostContext } from '../interfaces/boost-strategy.interface';
import { BoostType, StackingRule } from '../enums/perk-boost.enums';

export class FlatAddStrategy extends BaseBoostStrategy {
    constructor(
        type: BoostType,
        private readonly increment: number,
        stackingRule: StackingRule = StackingRule.ADDITIVE
    ) {
        super(type, stackingRule);
    }

    apply(context: IBoostContext, value: number): number {
        return value + this.increment;
    }
}
