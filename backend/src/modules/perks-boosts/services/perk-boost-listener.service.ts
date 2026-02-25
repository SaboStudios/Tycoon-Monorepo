import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PerksBoostsEvents, PerkBoostEvent } from './perks-boosts-events.service';
import { BoostActivationService } from './boost-activation.service';
import { NotificationsService } from '../../fetch-notification/notifications.service';
import { NotificationType } from '../../fetch-notification/entities/notification.entity';

@Injectable()
export class PerkBoostListener implements OnModuleInit {
    private readonly logger = new Logger(PerkBoostListener.name);
    constructor(
        private readonly events: PerksBoostsEvents,
        private readonly boostActivationService: BoostActivationService,
        private readonly notificationsService: NotificationsService,
    ) { }

    onModuleInit() {
        this.events.events$.subscribe(({ type, data }) => {
            this.handleEvent(type, data);
        });
    }

    private async handleEvent(type: PerkBoostEvent, data: any) {
        switch (type) {
            case PerkBoostEvent.PROPERTY_PURCHASE:
                this.logger.log(`Player ${data.playerId} purchased property. Checking for triggers...`);
                // Logic to activate "Builder" boost if property count reaches a threshold
                break;
            case PerkBoostEvent.DICE_ROLLED:
                // Logic to potentially trigger a temporary "Speed" boost on high rolls
                break;
            case PerkBoostEvent.PLAYER_LANDED:
                // Logic for landing-specific boosts (e.g., "Safe Haven" on Go to Jail)
                break;
            case PerkBoostEvent.BOOST_ACTIVATED:
                this.logger.log(`Boost activated for player ${data.playerId}: ${data.metadata?.boostId}`);
                break;
            case PerkBoostEvent.BOOST_EXPIRED:
                this.logger.log(`Boost expired for player ${data.playerId}: ${data.metadata?.boostId}`);
                await this.notificationsService.create({
                    userId: data.playerId.toString(),
                    type: NotificationType.BOOST_EXPIRED,
                    title: 'Boost Expired',
                    content: `Your boost ${data.metadata?.perkName || ''} has expired.`,
                });
                break;
            case PerkBoostEvent.GAME_PHASE_CHANGED:
                this.logger.log(`Game phase changed to ${data.metadata?.phase}. Checking for phase-specific boosts...`);
                break;
        }
    }
}
