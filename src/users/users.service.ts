import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like } from "typeorm";
import * as bcrypt from "bcrypt";
import { User, UserStatus } from "./entities/user.entity";
import { AuditLog, AuditAction } from "./entities/audit-log.entity";
import { QueryUsersDto } from "./dto/query-users.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async findAll(queryDto: QueryUsersDto) {
    const { page = 1, limit = 10, search, role, status } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.usersRepository.createQueryBuilder("user");

    if (search) {
      queryBuilder.where(
        "(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)",
        { search: `%${search}%` },
      );
    }

    if (role) {
      queryBuilder.andWhere("user.role = :role", { role });
    }

    if (status) {
      queryBuilder.andWhere("user.status = :status", { status });
    }

    const [users, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy("user.createdAt", "DESC")
      .getManyAndCount();

    return {
      data: users.map((user) => this.sanitizeUser(user)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.sanitizeUser(user);
  }

  async updateRole(
    id: string,
    updateRoleDto: UpdateUserRoleDto,
    adminId: string,
  ) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const oldRole = user.role;
    user.role = updateRoleDto.role;
    await this.usersRepository.save(user);

    await this.createAuditLog({
      action: AuditAction.ROLE_CHANGED,
      targetUserId: id,
      performedById: adminId,
      metadata: { oldRole, newRole: updateRoleDto.role },
    });

    return this.sanitizeUser(user);
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdateUserStatusDto,
    adminId: string,
  ) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const oldStatus = user.status;
    user.status = updateStatusDto.status;
    await this.usersRepository.save(user);

    const action =
      updateStatusDto.status === UserStatus.SUSPENDED
        ? AuditAction.USER_SUSPENDED
        : AuditAction.USER_ACTIVATED;

    await this.createAuditLog({
      action,
      targetUserId: id,
      performedById: adminId,
      metadata: { oldStatus, newStatus: updateStatusDto.status },
    });

    return this.sanitizeUser(user);
  }

  async resetPassword(
    id: string,
    resetPasswordDto: ResetPasswordDto,
    adminId: string,
  ) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    user.password = hashedPassword;
    await this.usersRepository.save(user);

    await this.createAuditLog({
      action: AuditAction.PASSWORD_RESET,
      targetUserId: id,
      performedById: adminId,
      metadata: { resetBy: "admin" },
    });

    return { message: "Password reset successfully" };
  }

  async getAuditLogs(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [logs, total] = await this.auditLogRepository.findAndCount({
      where: { targetUserId: userId },
      relations: ["performedBy"],
      order: { createdAt: "DESC" },
      skip,
      take: limit,
    });

    return {
      data: logs.map((log) => ({
        id: log.id,
        action: log.action,
        performedBy: {
          id: log.performedBy.id,
          email: log.performedBy.email,
          firstName: log.performedBy.firstName,
          lastName: log.performedBy.lastName,
        },
        metadata: log.metadata,
        createdAt: log.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async createAuditLog(data: {
    action: AuditAction;
    targetUserId: string;
    performedById: string;
    metadata?: Record<string, any>;
  }) {
    const auditLog = this.auditLogRepository.create(data);
    await this.auditLogRepository.save(auditLog);
  }

  private sanitizeUser(user: User) {
    const { password, ...result } = user;
    return result;
  }
}
