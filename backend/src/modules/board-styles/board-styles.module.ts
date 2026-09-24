import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { BoardStylesService } from './board-styles.service';
import { BoardStylesController } from './board-styles.controller';
import { BoardStyle } from './entities/board-style.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([BoardStyle]),
    CacheModule.register(), // Local memory cache for rapid specific access
  ],
  controllers: [BoardStylesController],
  providers: [BoardStylesService],
  exports: [BoardStylesService],
})
export class BoardStylesModule {}
