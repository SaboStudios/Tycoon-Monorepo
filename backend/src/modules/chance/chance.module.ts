import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chance } from './entities/chance.entity';
import { ChancesController } from './chance.controller';
import { ChancesService } from './chance.service';

@Module({
  imports: [TypeOrmModule.forFeature([Chance])],
  providers: [ChancesService],
  controllers: [ChancesController],
  exports: [TypeOrmModule],
})
export class ChanceModule {}