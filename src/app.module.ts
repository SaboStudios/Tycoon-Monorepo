import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { LoggerModule } from "./logger/logger.module";
import { User } from "./users/entities/user.entity";
import { AuditLog } from "./users/entities/audit-log.entity";
import { IdempotencyRecord } from "./idempotency/idempotency-record.entity";
import { CorrelationIdMiddleware } from "./logger/correlation-id.middleware";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

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
    LoggerModule,
    UsersModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
