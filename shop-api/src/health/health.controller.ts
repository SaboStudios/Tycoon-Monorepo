import { Controller, Get } from '@nestjs/common';

/**
 * Basic liveness endpoint used by the Docker HEALTHCHECK and orchestrators.
 * Deliberately does not check DB connectivity so it stays fast and never
 * flaps the container when Postgres is briefly unreachable.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
