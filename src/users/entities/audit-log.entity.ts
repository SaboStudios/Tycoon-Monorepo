import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

export enum AuditAction {
  USER_CREATED = "user_created",
  USER_UPDATED = "user_updated",
  USER_SUSPENDED = "user_suspended",
  USER_ACTIVATED = "user_activated",
  ROLE_CHANGED = "role_changed",
  PASSWORD_RESET = "password_reset",
}

@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: AuditAction,
  })
  action: AuditAction;

  @Column("uuid")
  targetUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "targetUserId" })
  targetUser: User;

  @Column("uuid")
  performedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "performedById" })
  performedBy: User;

  @Column("jsonb", { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
