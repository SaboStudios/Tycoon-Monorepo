import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunityChest } from './entities/community-chest.entity';
import { CommunityChestService } from './community-chest.service';
import { CommunityChestController } from './community-chest.controller';
import { CommunityChestObservabilityService } from './community-chest-observability.service';
import { CommunityChestObservabilityInterceptor } from './community-chest-observability.interceptor';
import { RANDOM_PROVIDER, SecureRandomProvider } from '../../common/random-provider';
import { CommunityChestErrorMapperService } from './community-chest-error-mapper.service';

@Module({
  imports: [TypeOrmModule.forFeature([CommunityChest])],
  providers: [
    CommunityChestService,
    CommunityChestObservabilityService,
    CommunityChestObservabilityInterceptor,
    { provide: RANDOM_PROVIDER, useClass: SecureRandomProvider },
    CommunityChestErrorMapperService,
  ],
  controllers: [CommunityChestController],
  exports: [CommunityChestService, TypeOrmModule, CommunityChestObservabilityService, CommunityChestErrorMapperService],
})
export class CommunityChestModule {}
