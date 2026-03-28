import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PerksService } from './perks.service';
import { PerksController } from './perks.controller';
import { PerksAdminController } from './perks-admin.controller';
import { Perk } from './entities/perk.entity';
import { Boost } from './entities/boost.entity';
import { CommonModule } from '../../common/common.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Perk, Boost]),
    CommonModule,
    RedisModule,
  ],
  controllers: [PerksController, PerksAdminController],
  providers: [PerksService],
  exports: [PerksService],
})
export class PerksModule {}
