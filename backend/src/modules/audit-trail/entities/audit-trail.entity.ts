import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

export enum AuditAction {
    USER_CREATED = 'USER_CREATED',
    USER_UPDATED = 'USER_UPDATED',
    USER_SOFT_DELETED = 'USER_SOFT_DELETED',
    USER_RESTORED = 'USER_RESTORED',
    USER_HARD_DELETED = 'USER_HARD_DELETED',
    // Admin mutation audit trail (#1840). Recorded by AuditTrailInterceptor
    // for handlers tagged with @AuditLog(...).
    ADMIN_MUTATION = 'ADMIN_MUTATION',
    ADMIN_LOGS_EXPORTED = 'ADMIN_LOGS_EXPORTED',
    ADMIN_DATA_EXPORTED = 'ADMIN_DATA_EXPORTED',
    // User data export (#1766). See docs/support/user-data-export-runbook.md.
    DATA_EXPORT_REQUESTED = 'DATA_EXPORT_REQUESTED',
    DATA_EXPORT_STEP_UP_FAILED = 'DATA_EXPORT_STEP_UP_FAILED',
    DATA_EXPORT_DOWNLOADED = 'DATA_EXPORT_DOWNLOADED',
}

@Entity({ name: 'audit_trails' })
@Index(['userId'])
@Index(['action'])
@Index(['createdAt'])
@Index(['userId', 'action'])
export class AuditTrail {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int', nullable: true })
    @Index()
    userId: number;

    @Column({ type: 'varchar', length: 50 })
    @Index()
    action: AuditAction;

    @Column({ type: 'varchar', length: 255, nullable: true })
    userEmail: string;

    @Column({ type: 'int', nullable: true })
    performedBy: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    performedByEmail: string;

    @Column({ type: 'jsonb', nullable: true })
    changes: Record<string, any>;

    @Column({ type: 'varchar', length: 45, nullable: true })
    ipAddress: string;

    @Column({ type: 'text', nullable: true })
    userAgent: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    reason: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
