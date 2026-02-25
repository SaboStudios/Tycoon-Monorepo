import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FeatureToggleService {
    private readonly toggles: Map<string, boolean> = new Map();

    constructor(private readonly configService: ConfigService) {
        // Initialize from config or defaults
        this.toggles.set('PERKS_ENABLED', true);
        this.toggles.set('BOOSTS_ENABLED', true);
        this.toggles.set('SEASONAL_PERKS_ENABLED', false); // Future seasonal perks
    }

    isEnabled(feature: string): boolean {
        return this.toggles.get(feature) ?? false;
    }

    setFeature(feature: string, enabled: boolean): void {
        this.toggles.set(feature, enabled);
    }
}
