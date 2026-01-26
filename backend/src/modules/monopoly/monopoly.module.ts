import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chance } from './entities/chance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Chance])],
  providers: [],
  controllers: [],
  exports: [TypeOrmModule],
})
export class MonopolyModule {}