import { BaseBoostStrategy } from './base-boost.strategy';
import { IBoostContext } from '../interfaces/boost-strategy.interface';
import { BoostType, StackingRule } from '../enums/perk-boost.enums';

export class MultiplierStrategy extends BaseBoostStrategy {
    constructor(
        type: BoostType,
        private readonly multiplier: number,
        stackingRule: StackingRule = StackingRule.MULTIPLICATIVE
    ) {
        super(type, stackingRule);
    }

    apply(context: IBoostContext, value: number): number {
        return value * this.multiplier;
    }
}
