import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("idempotency_records")
export class IdempotencyRecord {
  /** Composite: "{method}:{path}:{idempotency-key}" */
  @PrimaryColumn({ length: 512 })
  id: string;

  @Column({ length: 64 })
  payloadHash: string;

  @Column({ type: "jsonb" })
  response: Record<string, unknown>;

  @Column({ type: "int" })
  statusCode: number;

  @Index()
  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
