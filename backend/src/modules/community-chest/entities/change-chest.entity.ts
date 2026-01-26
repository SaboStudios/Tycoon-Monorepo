import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('community_chests')
export class CommunityChest {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'text' })
  instruction: string;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'int' })
  position: number;

  @Column({
    type: 'json',
    nullable: true,
    default: null,
  })
  extra: Record<string, any> | null;
}
