import { Injectable, OnModuleInit } from '@nestjs/common';
import { PerksBoostsEvents, PerkBoostEvent } from './perks-boosts-events.service';
import { BoostActivationService } from './boost-activation.service';

@Injectable()
export class PerkBoostListener implements OnModuleInit {
    constructor(
        private readonly events: PerksBoostsEvents,
        private readonly boostActivationService: BoostActivationService,
    ) { }

    onModuleInit() {
        this.events.events$.subscribe(({ type, data }) => {
            this.handleEvent(type, data);
        });
    }

    private async handleEvent(type: PerkBoostEvent, data: any) {
        switch (type) {
            case PerkBoostEvent.PROPERTY_PURCHASE:
                console.log(`Player ${data.playerId} purchased property. Checking for rewards...`);
                // Example: Reward a "First Purchase" perk if they don't have it
                break;
            case PerkBoostEvent.DICE_ROLLED:
                // Logic to potentially trigger a temporary boost
                break;
            case PerkBoostEvent.PLAYER_LANDED:
                // Logic for landing-specific boosts
                break;
        }
    }
}
