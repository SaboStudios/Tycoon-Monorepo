import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkinsService } from './skins.service';
import { SkinsController } from './skins.controller';
import { Skin } from './entities/skin.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Skin])],
  controllers: [SkinsController],
  providers: [SkinsService],
  exports: [SkinsService],
})
export class SkinsModule {}
