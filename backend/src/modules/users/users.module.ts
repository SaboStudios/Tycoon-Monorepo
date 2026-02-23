import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { GamesModule } from '../games/games.module';
import { AdminLogsModule } from '../admin-logs/admin-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), GamesModule, AdminLogsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
