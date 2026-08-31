import {
  Controller,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as express from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDataErasureService } from './user-data-erasure.service';

interface RequestWithUser extends express.Request {
  user: { id: number };
}

/**
 * User Data Erasure Controller (#1438)
 *
 * Handles GDPR erasure requests. Authenticated users can request permanent deletion
 * of their personal data.
 */
@Controller('users/me')
export class UserDataErasureController {
  private readonly logger = new Logger(UserDataErasureController.name);

  constructor(private readonly erasureService: UserDataErasureService) {}

  /**
   * Erase the authenticated user's data.
   *
   * POST /users/me/erase
   *
   * Idempotent: returns 200 even if user is already erased.
   *
   * Response:
   * {
   *   "success": true,
   *   "message": "User erased" | "User already erased or not found"
   * }
   */
  @Delete('erase')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async eraseUserData(@Request() req: RequestWithUser) {
    const userId = req.user.id;
    this.logger.log(`Erasure request received for user ${userId}`);

    const result = await this.erasureService.eraseUserData(userId);
    this.logger.log(`Erasure completed for user ${userId}: ${result.message}`);

    return result;
  }
}
