import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { User } from "./entities/user.entity";
import { AuditLog } from "./entities/audit-log.entity";
import { IdempotencyModule } from "../idempotency/idempotency.module";

@Module({
  imports: [TypeOrmModule.forFeature([User, AuditLog]), IdempotencyModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
