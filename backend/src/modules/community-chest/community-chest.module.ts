import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunityChestService } from './community-chest.service';
import { CommunityChestController } from './community-chest.controller';
import { CommunityChest } from './entities/community-chest.entity';

@Module({
    imports: [TypeOrmModule.forFeature([CommunityChest])],
    controllers: [CommunityChestController],
    providers: [CommunityChestService],
    exports: [CommunityChestService],
})
export class CommunityChestModule { }
