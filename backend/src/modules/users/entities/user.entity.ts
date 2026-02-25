import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
} from 'typeorm';
import { Role } from '../../auth/enums/role.enum';
import { UserPreference } from './user-preference.entity';

@Entity({ name: 'users' })
@Index(['address', 'chain'])
@Index(['email'])
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName: string;

  @Column({ type: 'varchar', length: 20, default: Role.USER })
  role: Role;

  @Column({ type: 'boolean', default: false })
  is_admin: boolean;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  username: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 50, default: 'BASE' })
  chain: string;

  @Column({ type: 'int', default: 0 })
  games_played: number;

  @Column({ type: 'int', default: 0 })
  game_won: number;

  @Column({ type: 'int', default: 0 })
  game_lost: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0,
  })
  total_staked: string;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0,
  })
  total_earned: string;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0,
  })
  total_withdrawn: string;

  @Column({ type: 'boolean', default: false })
  is_suspended: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @OneToOne(() => UserPreference, (preference) => preference.user, {
    cascade: true,
  })
  preference: UserPreference;
}
