import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn, Index } from 'typeorm';
import { Perk } from './perk.entity';

@Entity('player_perks')
@Index(['user_id', 'perk_id'], { unique: true })
export class PlayerPerk {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    user_id: number;

    @Column()
    perk_id: number;

    @ManyToOne(() => Perk)
    @JoinColumn({ name: 'perk_id' })
    perk: Perk;

    @Column({ default: 1 })
    quantity: number;

    @Column({ default: false })
    is_equipped: boolean;

    @CreateDateColumn()
    acquired_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
