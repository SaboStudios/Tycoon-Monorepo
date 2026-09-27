import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UserPreference } from './entities/user-preference.entity';
import { UserSuspension } from './entities/user-suspension.entity';
import { UserPreferencesService } from './user-preferences.service';
import { GamesModule } from '../games/games.module';
import { AdminLogsModule } from '../admin-logs/admin-logs.module';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserPreference, UserSuspension]),
    GamesModule,
    AdminLogsModule,
    AuditTrailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UserPreferencesService],
  exports: [UsersService, UserPreferencesService],
})
export class UsersModule {}
