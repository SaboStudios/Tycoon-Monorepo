import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { Perk } from './perk.entity';

@Entity('active_boosts')
export class ActiveBoost {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    user_id: number;

    @Column()
    game_id: number;

    @Column()
    perk_id: number;

    @ManyToOne(() => Perk)
    @JoinColumn({ name: 'perk_id' })
    perk: Perk;

    @Column({ type: 'timestamp' })
    activated_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    expires_at: Date;

    @Column({ default: 0 })
    remaining_uses: number;

    @Column({ default: false })
    is_stackable: boolean;

    @Column({ default: true })
    is_active: boolean;

    @CreateDateColumn()
    created_at: Date;
}
