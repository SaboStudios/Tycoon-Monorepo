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
    // Cache audit actions (SW-CACHE-001)
    CACHE_SET = 'CACHE_SET',
    CACHE_DEL = 'CACHE_DEL',
    CACHE_INVALIDATE = 'CACHE_INVALIDATE',
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
