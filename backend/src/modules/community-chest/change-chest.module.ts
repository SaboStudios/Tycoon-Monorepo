import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunityChest } from './entities/change-chest.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CommunityChest])],
  exports: [TypeOrmModule],
})
export class CommunityChestModule {}
