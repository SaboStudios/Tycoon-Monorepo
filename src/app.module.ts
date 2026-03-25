import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { IdempotencyModule } from "./idempotency/idempotency.module";
import { User } from "./users/entities/user.entity";
import { AuditLog } from "./users/entities/audit-log.entity";
import { IdempotencyRecord } from "./idempotency/idempotency-record.entity";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      username: process.env.DB_USERNAME || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_NAME || "test_db",
      entities: [User, AuditLog, IdempotencyRecord],
      synchronize: true,
    }),
    UsersModule,
    AuthModule,
    IdempotencyModule,
  ],
})
export class AppModule {}
