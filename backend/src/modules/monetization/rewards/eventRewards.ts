import { Injectable, BadRequestException } from '@nestjs/common';
import { RewardEngine } from './rewardEngine';

export type MonetizationEvent =
  | 'level.up'
  | 'first.purchase'
  | 'daily.login'
  | 'admin.promotional.grant';

interface EventRewardPayload {
  userId: number;
  level?: number;
  perkId?: number;
  quantity?: number;
  grantedBy?: string;
}

@Injectable()
export class EventRewards {
  constructor(private readonly rewardEngine: RewardEngine) {}

  async processEvent(event: MonetizationEvent, payload: EventRewardPayload) {
    switch (event) {
      case 'level.up':
        if ((payload.level || 0) < 10 || !payload.perkId) {
          return { granted: false, reason: 'No reward rule matched' };
        }
        return this.rewardEngine.earnPerk({
          userId: payload.userId,
          perkId: payload.perkId,
          quantity: payload.quantity || 1,
          source: 'event:level.up',
        });

      case 'first.purchase':
      case 'daily.login':
        if (!payload.perkId) {
          return { granted: false, reason: 'perkId required for event reward' };
        }
        return this.rewardEngine.earnPerk({
          userId: payload.userId,
          perkId: payload.perkId,
          quantity: payload.quantity || 1,
          source: `event:${event}`,
        });

      case 'admin.promotional.grant':
        if (!payload.perkId || !payload.grantedBy) {
          throw new BadRequestException(
            'perkId and grantedBy are required for promotional grants',
          );
        }
        return this.rewardEngine.grantPromotionalPerk({
          userId: payload.userId,
          perkId: payload.perkId,
          quantity: payload.quantity || 1,
          grantedBy: payload.grantedBy,
        });

      default:
        return { granted: false, reason: 'Unsupported event' };
    }
  }
}
