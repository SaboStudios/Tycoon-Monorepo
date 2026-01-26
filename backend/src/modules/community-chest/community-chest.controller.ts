import { Controller, Get } from '@nestjs/common';
import { CommunityChestService } from './community-chest.service';
import { CommunityChest } from './entities/community-chest.entity';

@Controller('community-chest')
export class CommunityChestController {
    constructor(private readonly communityChestService: CommunityChestService) { }

    @Get('draw')
    async draw(): Promise<CommunityChest | null> {
        return this.communityChestService.drawCard();
    }
}
