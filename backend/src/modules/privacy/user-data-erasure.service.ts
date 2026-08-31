import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { GamePlayer } from '../games/entities/game-player.entity';
import { Purchase } from '../shop/entities/purchase.entity';
import { UserInventory } from '../shop/entities/user-inventory.entity';
import { Notification } from '../fetch-notification/entities/notification.entity';
import { AuditTrail } from '../audit-trail/entities/audit-trail.entity';
import { Gift } from '../gifts/entities/gift.entity';

/**
 * User Data Erasure Service (#1438)
 *
 * Handles GDPR-compliant deletion of all user personal data across related tables.
 * Deletes in correct order to respect foreign key constraints.
 */
@Injectable()
export class UserDataErasureService {
  private readonly logger = new Logger(UserDataErasureService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
    @InjectRepository(GamePlayer)
    private readonly gamePlayersRepository: Repository<GamePlayer>,
    @InjectRepository(Purchase)
    private readonly purchasesRepository: Repository<Purchase>,
    @InjectRepository(UserInventory)
    private readonly userInventoriesRepository: Repository<UserInventory>,
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(AuditTrail)
    private readonly auditTrailRepository: Repository<AuditTrail>,
    @InjectRepository(Gift)
    private readonly giftsRepository: Repository<Gift>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Erase a user and all associated PII.
   * Idempotent: returns 200 success even if user is already erased (user not found).
   *
   * Deletion order respects foreign keys:
   * 1. Revoke sessions (refresh_tokens)
   * 2. Delete games the user participated in
   * 3. Delete notifications
   * 4. Delete gifts (sent and received)
   * 5. Delete purchases and inventory
   * 6. Delete audit trail records mentioning the user
   * 7. Finally, delete the user record
   *
   * Returns: { success: true, message: "User erased" | "User already erased" }
   */
  async eraseUserData(userId: number): Promise<{ success: boolean; message: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if user exists
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });

      if (!user) {
        // Idempotent: already erased or never existed
        await queryRunner.commitTransaction();
        return {
          success: true,
          message: 'User already erased or not found',
        };
      }

      // Log audit entry before deletion
      await this.logErasureAudit(queryRunner, userId);

      // Delete in order of foreign key dependencies

      // 1. Revoke sessions
      await queryRunner.manager.delete(RefreshToken, { userId });
      this.logger.debug(`Deleted refresh tokens for user ${userId}`);

      // 2. Delete game participation records
      await queryRunner.manager.delete(GamePlayer, { userId });
      this.logger.debug(`Deleted game players for user ${userId}`);

      // 3. Delete notifications (key: userId)
      await queryRunner.manager.delete(Notification, { userId });
      this.logger.debug(`Deleted notifications for user ${userId}`);

      // 4. Delete gifts sent and received by this user
      await queryRunner.manager.delete(Gift, [
        { senderId: userId },
        { receiverId: userId },
      ]);
      this.logger.debug(`Deleted gifts for user ${userId}`);

      // 5. Delete purchases and inventory
      await queryRunner.manager.delete(Purchase, { userId });
      await queryRunner.manager.delete(UserInventory, { userId });
      this.logger.debug(`Deleted purchases and inventory for user ${userId}`);

      // 6. Delete audit trail records (soft-delete if available, else hard delete)
      await queryRunner.manager.delete(AuditTrail, { userId });
      this.logger.debug(`Deleted audit trails for user ${userId}`);

      // 7. Finally, delete the user
      await queryRunner.manager.delete(User, { id: userId });
      this.logger.info(`User ${userId} erased successfully`);

      await queryRunner.commitTransaction();
      return {
        success: true,
        message: 'User erased',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error erasing user ${userId}: ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Log an audit entry recording the erasure action.
   * Creates a record in the audit_trail table indicating when and that a user was erased.
   */
  private async logErasureAudit(queryRunner: any, userId: number): Promise<void> {
    try {
      await queryRunner.manager.insert(AuditTrail, {
        userId,
        action: 'privacy:user_erasure',
        details: {
          reason: 'GDPR erasure request',
          erasedAt: new Date().toISOString(),
        },
        createdAt: new Date(),
      });
    } catch (err) {
      // If audit logging fails, still proceed with erasure but log the error
      this.logger.warn(`Could not log erasure audit for user ${userId}: ${err}`);
    }
  }
}
