import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  Patch,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Types } from 'mongoose';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  NotificationsService,
  PaginatedNotificationsResult,
} from './notifications.service';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import { NotificationCountDto } from './dto/notification-count.dto';

/**
 * Helper to extract the authenticated user's ID from the JWT payload.
 * Handles both `id` (custom) and `sub` (standard JWT claim) formats.
 */
function extractUserId(req: Request): string {
  const user = req.user as Record<string, unknown>;
  const id = (user?.id ?? user?.sub) as string | undefined;
  if (!id) throw new Error('User ID not found in JWT payload');
  return id;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /api/notifications
   *
   * Returns a paginated list of all notifications for the authenticated user,
   * sorted newest-first.
   *
   * NOTE: /count must be declared BEFORE any /:id param route to avoid NestJS
   * treating the string "count" as an ID.
   */
  @Get('count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get unread notification count',
    description:
      'Returns a simple { count } object representing the number of unread notifications. Designed for badge/indicator UI elements.',
  })
  @ApiOkResponse({ type: NotificationCountDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
  async getUnreadCount(@Req() req: Request): Promise<NotificationCountDto> {
    const userId = extractUserId(req);
    return this.notificationsService.countUnreadForUser(userId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get paginated notifications',
    description:
      'Returns a paginated list of notifications for the authenticated user. Sorted by createdAt descending (newest first).',
  })
  @ApiOkResponse({
    description: 'Paginated notifications',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of notification objects',
        },
        total: { type: 'number', example: 42 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
        totalPages: { type: 'number', example: 3 },
        hasNextPage: { type: 'boolean', example: true },
        hasPreviousPage: { type: 'boolean', example: false },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
  async getNotifications(
    @Req() req: Request,
    @Query() query: GetNotificationsQueryDto,
  ): Promise<PaginatedNotificationsResult> {
    const userId = extractUserId(req);
    return this.notificationsService.findAllForUser(userId, query);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a notification as read',
    description:
      'Marks a specific notification as read. User can only update their own notifications.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
  async markAsRead(@Req() req: Request, @Param('id') id: string) {
    const userId = extractUserId(req);

    const updated = await this.notificationsService.markAsRead(id, userId);

    if (!updated) {
      throw new NotFoundException(
        'Notification not found or not owned by user',
      );
    }

    return updated;
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description:
      'Marks all unread notifications for the authenticated user as read.',
  })
  @ApiOkResponse({
    schema: {
      properties: {
        modifiedCount: { type: 'number', example: 5 },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
  async markAllAsRead(@Req() req: Request) {
    const userId = extractUserId(req);

    return this.notificationsService.markAllAsRead(userId);
  }
}
