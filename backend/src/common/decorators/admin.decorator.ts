import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../guards/admin.guard';

export function RequireAdmin() {
  return UseGuards(AdminGuard);
}
