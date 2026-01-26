import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chance } from './entities/chance.entity';
import { ChanceService } from './chance.service';
import { ChanceController } from './chance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Chance])],
  providers: [ChanceService],
  controllers: [ChanceController],
  exports: [TypeOrmModule],
})
export class ChanceModule {}