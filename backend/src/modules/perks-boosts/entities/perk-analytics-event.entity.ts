import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Perk } from './perk.entity';

export enum PerkEventType {
    PURCHASE = 'purchase',
    ACTIVATION = 'activation',
    USAGE = 'usage',
    EXPIRATION = 'expiration'
}

@Entity('perk_analytics_events')
export class PerkAnalyticsEvent {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    perk_id: number;

    @ManyToOne(() => Perk)
    @JoinColumn({ name: 'perk_id' })
    perk: Perk;

    @Column()
    user_id: number;

    @Column({ nullable: true })
    game_id: number;

    @Column({
        type: 'enum',
        enum: PerkEventType,
    })
    event_type: PerkEventType;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    revenue: number;

    @Column({ type: 'jsonb', nullable: true })
    metadata: any;

    @CreateDateColumn()
    created_at: Date;
}
