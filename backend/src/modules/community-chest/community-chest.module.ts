import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunityChest } from './entities/community-chest.entity';
import { CommunityChestService } from './community-chest.service';
import { CommunityChestController } from './community-chest.controller';
import { CommunityChestObservabilityService } from './community-chest-observability.service';
import { CommunityChestObservabilityInterceptor } from './community-chest-observability.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([CommunityChest])],
  providers: [
    CommunityChestService,
    CommunityChestObservabilityService,
    CommunityChestObservabilityInterceptor,
  ],
  controllers: [CommunityChestController],
  exports: [CommunityChestService, TypeOrmModule, CommunityChestObservabilityService],
})
export class CommunityChestModule {}
