import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum DiscrepancyType {
  AMOUNT_MISMATCH = 'amount_mismatch',
  MISSING_IN_LEDGER = 'missing_in_ledger',
  MISSING_IN_PROVIDER = 'missing_in_provider',
  STATUS_MISMATCH = 'status_mismatch',
}

export enum DiscrepancyStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  IGNORED = 'ignored',
}

@Entity({ name: 'ledger_discrepancies' })
@Index(['runId'])
@Index(['type'])
@Index(['status'])
@Index(['purchaseId'])
export class LedgerDiscrepancy {
  @PrimaryGeneratedColumn()
  id: number;

  /** Unique ID for each reconciliation run */
  @Column({ type: 'varchar', length: 100 })
  runId: string;

  @Column({ type: 'int', nullable: true })
  purchaseId: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  transactionId: string | null;

  @Column({ type: 'varchar', length: 50 })
  type: DiscrepancyType;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  ledgerAmount: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  providerAmount: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ledgerStatus: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  providerStatus: string | null;

  @Column({ type: 'varchar', length: 50, default: DiscrepancyStatus.OPEN })
  status: DiscrepancyStatus;

  @Column({ type: 'text', nullable: true })
  resolutionNote: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
