import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { BoardStylesService } from './board-styles.service';
import { BoardStylesController } from './board-styles.controller';
import { BoardStyle } from './entities/board-style.entity';
import { RedisModule } from '../redis/redis.module';
import { LoggerModule } from '../../common/logger/logger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BoardStyle]),
    CacheModule.register(), // Local memory cache for rapid specific access
    RedisModule,
    LoggerModule,
  ],
  controllers: [BoardStylesController],
  providers: [BoardStylesService],
  exports: [BoardStylesService],
})
export class BoardStylesModule {}
