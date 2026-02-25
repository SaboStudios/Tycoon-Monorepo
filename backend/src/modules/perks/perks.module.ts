import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PerksService } from './perks.service';
import { PerksController } from './perks.controller';
import { PerksAdminController } from './perks-admin.controller';
import { Perk } from './entities/perk.entity';
import { Boost } from './entities/boost.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Perk, Boost]),
  ],
  controllers: [PerksController, PerksAdminController],
  providers: [PerksService],
  exports: [PerksService],
})
export class PerksModule {}
