import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ActiveBoost } from './active-boost.entity';

@Entity('boost_usage_tracking')
export class BoostUsage {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    active_boost_id: number;

    @ManyToOne(() => ActiveBoost)
    @JoinColumn({ name: 'active_boost_id' })
    activeBoost: ActiveBoost;

    @Column()
    game_id: number;

    @Column()
    user_id: number;

    @Column({ type: 'jsonb', nullable: true })
    event_data: any;

    @CreateDateColumn()
    created_at: Date;
}
