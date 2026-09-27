import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ApiKeyAuthGuard } from '../common/guards/api-key.guard';

@Module({
  imports: [
    JwtModule.register({
      // If JWT_SECRET is unset the guard simply never attempts JWT verification
      // (the API-key path still works); a real secret must come from the env.
      secret: process.env.JWT_SECRET ?? 'shop-api-unset-secret',
    }),
  ],
  providers: [ApiKeyAuthGuard],
  exports: [ApiKeyAuthGuard, JwtModule],
})
export class AuthModule {}
