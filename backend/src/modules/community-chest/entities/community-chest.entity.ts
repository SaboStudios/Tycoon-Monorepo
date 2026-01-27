import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChanceType } from '../../chance/enums/chance-type.enum';

@Entity('community_chests')
export class CommunityChest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  instruction: string;

  @Column({
    type: 'enum',
    enum: ChanceType,
  })
  type: ChanceType;

  @Column({
    type: 'int',
    nullable: true,
  })
  amount: number | null;

  @Column({
    type: 'int',
    nullable: true,
  })
  position: number | null;

  @Column({
    type: 'json',
    nullable: true,
    default: null,
  })
  extra: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
