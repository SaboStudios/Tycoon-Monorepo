import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export enum PerkBoostEvent {
    PLAYER_LANDED = 'player.landed',
    DICE_ROLLED = 'dice.rolled',
    PROPERTY_PURCHASE = 'property.purchase',
}

export interface IPerkBoostEventData {
    playerId: number;
    gameId: number;
    metadata?: any;
}

@Injectable()
export class PerksBoostsEvents {
    private eventSubject = new Subject<{ type: PerkBoostEvent; data: IPerkBoostEventData }>();

    events$ = this.eventSubject.asObservable();

    emit(type: PerkBoostEvent, data: IPerkBoostEventData) {
        this.eventSubject.next({ type, data });
    }
}
