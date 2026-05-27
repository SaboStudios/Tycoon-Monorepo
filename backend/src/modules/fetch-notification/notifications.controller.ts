// src/notifications/notifications.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginatedNotificationsResponseDto } from './dto/paginated-notifications-response.dto';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import { UnreadCountResponseDto } from './dto/unread-count-response.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

function resolveUserId(user: JwtPayload): string {
  return String(user.sub ?? user.id);
}

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /api/notifications
   * Returns a paginated list of notifications for the authenticated user.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get paginated notifications for the authenticated user',
    description:
      'Returns a paginated list of notifications. Supports filtering by read status and notification type.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'isRead',
    required: false,
    type: Boolean,
    description: 'Filter by read/unread status',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    description: 'Filter by notification type',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated notifications list',
    type: PaginatedNotificationsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getNotifications(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetNotificationsQueryDto,
  ): Promise<PaginatedNotificationsResponseDto> {
    return this.notificationsService.findAllForUser(resolveUserId(user), query);
  }

  /**
   * GET /api/notifications/count
   * Returns the unread notification count for the authenticated user.
   */
  @Get('count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get unread notification count',
    description:
      'Returns a simple count object representing the number of unread notifications. Used for UI badge indicators.',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread notification count',
    type: UnreadCountResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCount(
    @CurrentUser() user: JwtPayload,
  ): Promise<UnreadCountResponseDto> {
    const count = await this.notificationsService.getUnreadCount(
      resolveUserId(user),
    );
    return { count };
  }

  /**
   * PATCH /api/notifications/:id
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a notification as read',
    description:
      'Marks a specific notification as read. User can only update their own notifications.',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated notification',
    type: NotificationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAsRead(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    const updated = await this.notificationsService.markAsRead(
      id,
      resolveUserId(user),
    );

    if (!updated) {
      throw new NotFoundException(
        'Notification not found or not owned by user',
      );
    }

    return updated;
  }

  /**
   * POST /api/notifications/read-all
   */
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description:
      'Marks all unread notifications for the authenticated user as read.',
  })
  @ApiResponse({
    status: 200,
    description: 'Number of notifications marked as read',
    schema: {
      properties: {
        modifiedCount: { type: 'number', example: 5 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllAsRead(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ modifiedCount: number }> {
    return this.notificationsService.markAllAsRead(resolveUserId(user));
  }
}
