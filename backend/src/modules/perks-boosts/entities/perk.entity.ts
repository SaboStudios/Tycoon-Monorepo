import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { PerkType } from '../enums/perk-boost.enums';

@Entity('perks')
export class Perk {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    description: string;

    @Column({ type: 'varchar', length: 50 })
    type: PerkType;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    price: number;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: false })
    isPaid: boolean;

    @Column({ default: false })
    isRewarded: boolean;

    @Column({ type: 'jsonb', nullable: true })
    metadata: any;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
