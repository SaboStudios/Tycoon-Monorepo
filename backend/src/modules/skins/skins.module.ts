import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkinsService } from './skins.service';
import { SkinsController } from './skins.controller';
import { Skin } from './entities/skin.entity';
import { UserSkin } from './entities/user-skin.entity';
import { UserSkinsService } from './user-skins.service';
import { UserSkinsController } from './user-skins.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Skin, UserSkin])],
  controllers: [SkinsController, UserSkinsController],
  providers: [SkinsService, UserSkinsService],
  exports: [SkinsService, UserSkinsService],
})
export class SkinsModule {}
